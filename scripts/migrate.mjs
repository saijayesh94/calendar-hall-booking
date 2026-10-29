import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { loadDevVars } from './env.mjs'

const sql = neon(loadDevVars().DATABASE_URL)
const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')
const statements = schema
  .split(/;\s*$/m)
  .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
  .filter(Boolean)

for (const stmt of statements) {
  await sql.query(stmt)
}
console.log(`Applied ${statements.length} statements.`)
