import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { HttpError, type AppEnv } from './env'

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw new HttpError(401, 'Not logged in')
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256')
    c.set('userId', payload.sub as string)
    c.set('sessionId', payload.sid as string)
  } catch {
    throw new HttpError(401, 'Session expired')
  }
  await next()
})
