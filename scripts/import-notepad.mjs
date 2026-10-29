// One-time import of the old notepad bookings into an account.
// Usage: npm run db:import -- you@example.com [--force]
import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { loadDevVars } from './env.mjs'

const [email, flag] = process.argv.slice(2)
if (!email) {
  console.error('Usage: npm run db:import -- you@example.com [--force]')
  process.exit(1)
}

const sql = neon(loadDevVars().DATABASE_URL)
const [user] = await sql`select id, name from users where email = ${email.trim().toLowerCase()}`
if (!user) {
  console.error(`No account with email ${email}. Sign up in the app first.`)
  process.exit(1)
}

const NOTE_PREFIX = 'From notepad: '
const [{ n }] = await sql`
  select count(*)::int as n from bookings where user_id = ${user.id} and notes like ${'%' + NOTE_PREFIX + '%'}`
if (n > 0 && flag !== '--force') {
  console.error(`${user.name} already has ${n} imported bookings. Re-run with --force to import again.`)
  process.exit(1)
}

const entries = JSON.parse(readFileSync(new URL('./notepad-data.json', import.meta.url), 'utf8'))
const queries = entries.map((e) => {
  const notes = [e.note, NOTE_PREFIX + e.original].filter(Boolean).join('\n')
  return sql`
    with b as (
      insert into bookings (user_id, event_type, customer_name, phone, start_date, start_slot, start_time,
                            end_date, end_slot, end_time, spaces, amount, notes)
      values (${user.id}, ${e.type}, ${e.name ?? null}, ${e.phone ?? null}, ${e.start}, ${e.startSlot ?? 'full'},
              ${e.startTime ?? null}, ${e.end ?? e.start}, ${e.endSlot ?? 'full'}, ${e.endTime ?? null},
              ${e.spaces ?? ['main', 'dining', 'rooms']}::text[], ${e.amount ?? null}, ${notes})
      returning *
    )
    insert into booking_history (booking_id, user_id, action, snapshot)
    select id, user_id, 'created', to_jsonb(b) from b`
})
await sql.transaction(queries)
console.log(`Imported ${entries.length} bookings into ${user.name}'s account.`)
