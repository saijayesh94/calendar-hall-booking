import type { AuthResponse } from '../../shared/types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

let accessToken: string | null = null
let refreshing: Promise<AuthResponse | null> | null = null
let onSessionLost: () => void = () => {}

export function setSession(auth: AuthResponse | null) {
  accessToken = auth?.accessToken ?? null
}

export function onUnauthorized(handler: () => void) {
  onSessionLost = handler
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`)
  return body as T
}

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((res) => (res.ok ? (res.json() as Promise<AuthResponse>) : null))
    .then((auth) => {
      setSession(auth)
      return auth
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

interface Options {
  method?: string
  body?: unknown
  query?: Record<string, string | number | undefined | null>
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const qs = opts.query
    ? new URLSearchParams(
        Object.entries(opts.query)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : ''
  const url = `/api${path}${qs ? `?${qs}` : ''}`

  const send = () =>
    fetch(url, {
      method: opts.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        ...(opts.body !== undefined && { 'content-type': 'application/json' }),
        ...(accessToken && { authorization: `Bearer ${accessToken}` }),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })

  let res = await send()
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await send()
    if (res.status === 401) onSessionLost()
  }
  return parse<T>(res)
}
