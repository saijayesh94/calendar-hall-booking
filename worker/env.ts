import { neon } from '@neondatabase/serverless'

export interface Env {
  DATABASE_URL: string
  JWT_SECRET: string
}

export interface AppEnv {
  Bindings: Env
  Variables: { userId: string; sessionId: string }
}

export const db = (env: Env) => neon(env.DATABASE_URL)
export type Sql = ReturnType<typeof db>

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 429,
    message: string,
  ) {
    super(message)
  }
}
