import { Hono } from 'hono'
import { z } from 'zod'
import { db, HttpError, type AppEnv } from '../env'
import { hashPassword, verifyPassword } from '../lib/crypto'
import { clearSessionCookie, createSession, refreshSession, revokeCurrentSession } from '../lib/session'
import { requireAuth } from '../middleware'

const MAX_FAILED_LOGINS = 5
const LOCKOUT_MINUTES = 15

const email = z.string().trim().toLowerCase().email('Enter a valid email').max(200)
const password = z.string().min(8, 'Password must be at least 8 characters').max(200)

const signupInput = z.object({ name: z.string().trim().min(1, 'Name is required').max(80), email, password })
const loginInput = z.object({ email, password: z.string().min(1).max(200) })
const changePasswordInput = z.object({ currentPassword: z.string().min(1), newPassword: password })

export const authRoutes = new Hono<AppEnv>()
  .post('/signup', async (c) => {
    const body = signupInput.parse(await c.req.json())
    const sql = db(c.env)
    const created = await sql`
      insert into users (name, email, password_hash, last_login_at)
      values (${body.name}, ${body.email}, ${await hashPassword(body.password)}, now())
      on conflict (email) do nothing
      returning id, name, email`
    if (!created.length) throw new HttpError(409, 'An account with this email already exists')
    const user = created[0]
    return c.json({ accessToken: await createSession(c, sql, user.id), user })
  })

  .post('/login', async (c) => {
    const body = loginInput.parse(await c.req.json())
    const sql = db(c.env)
    const [{ failures }] = await sql`
      select count(*)::int as failures from login_attempts
      where email = ${body.email} and attempted_at > now() - make_interval(mins => ${LOCKOUT_MINUTES})`
    if (failures >= MAX_FAILED_LOGINS) {
      throw new HttpError(429, `Too many wrong attempts. Try again in ${LOCKOUT_MINUTES} minutes.`)
    }

    const [user] = await sql`select id, name, email, password_hash from users where email = ${body.email}`
    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      await sql`insert into login_attempts (email) values (${body.email})`
      throw new HttpError(401, 'Wrong email or password')
    }

    await sql.transaction([
      sql`delete from login_attempts where email = ${body.email}`,
      sql`update users set last_login_at = now() where id = ${user.id}`,
    ])
    return c.json({
      accessToken: await createSession(c, sql, user.id),
      user: { id: user.id, name: user.name, email: user.email },
    })
  })

  .post('/refresh', async (c) => {
    const sql = db(c.env)
    const result = await refreshSession(c, sql)
    if (!result) {
      clearSessionCookie(c)
      throw new HttpError(401, 'Session expired')
    }
    const [user] = await sql`select id, name, email from users where id = ${result.userId}`
    if (!user) throw new HttpError(401, 'Session expired')
    return c.json({ accessToken: result.accessToken, user })
  })

  .post('/logout', async (c) => {
    await revokeCurrentSession(c, db(c.env))
    return c.json({ ok: true })
  })

  .post('/logout-all', requireAuth, async (c) => {
    await db(c.env)`update sessions set revoked_at = now() where user_id = ${c.get('userId')} and revoked_at is null`
    clearSessionCookie(c)
    return c.json({ ok: true })
  })

  .post('/change-password', requireAuth, async (c) => {
    const body = changePasswordInput.parse(await c.req.json())
    const sql = db(c.env)
    const userId = c.get('userId')
    const [user] = await sql`select password_hash from users where id = ${userId}`
    if (!user || !(await verifyPassword(body.currentPassword, user.password_hash))) {
      throw new HttpError(400, 'Current password is wrong')
    }
    // Keep this device logged in, sign out every other one.
    await sql.transaction([
      sql`update users set password_hash = ${await hashPassword(body.newPassword)} where id = ${userId}`,
      sql`update sessions set revoked_at = now()
          where user_id = ${userId} and id <> ${c.get('sessionId')} and revoked_at is null`,
    ])
    return c.json({ ok: true })
  })
