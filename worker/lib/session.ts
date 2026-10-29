import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { sign } from 'hono/jwt'
import type { AppEnv, Sql } from '../env'
import { randomToken, sha256 } from './crypto'

const COOKIE = 'hb_session'
const COOKIE_PATH = '/api/auth'
const ACCESS_TTL_SEC = 15 * 60
const SESSION_TTL_DAYS = 365
// A token that was just rotated still works this long, so two tabs refreshing at once don't log the user out.
const ROTATION_GRACE_SEC = 30

export async function issueAccessToken(c: Context<AppEnv>, userId: string, sessionId: string) {
  const now = Math.floor(Date.now() / 1000)
  return sign({ sub: userId, sid: sessionId, iat: now, exp: now + ACCESS_TTL_SEC }, c.env.JWT_SECRET, 'HS256')
}

function setSessionCookie(c: Context<AppEnv>, token: string) {
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: COOKIE_PATH,
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
}

export function clearSessionCookie(c: Context<AppEnv>) {
  deleteCookie(c, COOKIE, { path: COOKIE_PATH, secure: true })
}

export async function createSession(c: Context<AppEnv>, sql: Sql, userId: string) {
  const token = randomToken()
  const ua = c.req.header('user-agent')?.slice(0, 300) ?? null
  const [row] = await sql`
    insert into sessions (user_id, token_hash, expires_at, user_agent)
    values (${userId}, ${await sha256(token)}, now() + make_interval(days => ${SESSION_TTL_DAYS}), ${ua})
    returning id`
  setSessionCookie(c, token)
  return issueAccessToken(c, userId, row.id)
}

/**
 * Rotates the refresh cookie and returns a fresh access token, or null if the session is gone.
 * Re-use of an old token outside the grace window is treated as theft and kills every session of that user.
 */
export async function refreshSession(c: Context<AppEnv>, sql: Sql) {
  const token = getCookie(c, COOKIE)
  if (!token) return null
  const hash = await sha256(token)

  const [s] = await sql`
    select id, user_id, token_hash = ${hash} as is_current,
           revoked_at is not null or expires_at < now() as dead,
           rotated_at > now() - make_interval(secs => ${ROTATION_GRACE_SEC}) as in_grace
    from sessions
    where token_hash = ${hash} or prev_token_hash = ${hash}
    limit 1`
  if (!s || s.dead) return null

  if (s.is_current) {
    const next = randomToken()
    const rotated = await sql`
      update sessions
      set prev_token_hash = token_hash, token_hash = ${await sha256(next)}, rotated_at = now(),
          last_used_at = now(), expires_at = now() + make_interval(days => ${SESSION_TTL_DAYS})
      where id = ${s.id} and token_hash = ${hash}
      returning id`
    if (rotated.length) {
      setSessionCookie(c, next)
      return { userId: s.user_id as string, accessToken: await issueAccessToken(c, s.user_id, s.id) }
    }
    // Another request rotated it between our select and update; it now counts as the previous token.
  } else if (!s.in_grace) {
    await sql`update sessions set revoked_at = now() where user_id = ${s.user_id} and revoked_at is null`
    return null
  }
  return { userId: s.user_id as string, accessToken: await issueAccessToken(c, s.user_id, s.id) }
}

export async function revokeCurrentSession(c: Context<AppEnv>, sql: Sql) {
  const token = getCookie(c, COOKIE)
  if (token) {
    const hash = await sha256(token)
    await sql`update sessions set revoked_at = now() where token_hash = ${hash} or prev_token_hash = ${hash}`
  }
  clearSessionCookie(c)
}
