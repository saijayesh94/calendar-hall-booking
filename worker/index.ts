import { Hono } from 'hono'
import { ZodError } from 'zod'
import { db, HttpError, type AppEnv } from './env'
import { requireAuth } from './middleware'
import { analyticsRoutes } from './routes/analytics'
import { authRoutes } from './routes/auth'
import { bookingRoutes, historyRoutes, trashRoutes } from './routes/bookings'

const app = new Hono<AppEnv>().basePath('/api')

app.route('/auth', authRoutes)

app.get('/me', requireAuth, async (c) => {
  const [user] = await db(c.env)`select id, name, email from users where id = ${c.get('userId')}`
  if (!user) throw new HttpError(401, 'Not logged in')
  return c.json(user)
})
app.route('/bookings', bookingRoutes)
app.route('/trash', trashRoutes)
app.route('/history', historyRoutes)
app.route('/analytics', analyticsRoutes)

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status)
  if (err instanceof ZodError) return c.json({ error: err.issues[0]?.message ?? 'Invalid input' }, 400)
  if (err instanceof SyntaxError) return c.json({ error: 'Invalid request body' }, 400)
  console.error(err)
  return c.json({ error: 'Something went wrong. Please try again.' }, 500)
})

export default app
