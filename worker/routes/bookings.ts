import { Hono } from 'hono'
import { z } from 'zod'
import { EVENT_TYPES, OTHER_EVENT, SPACE_IDS, SPACE_OPTION_IDS } from '../../shared/constants'
import { bookingInput, type Booking, type HistoryEntry } from '../../shared/types'
import { db, HttpError, type AppEnv, type Sql } from '../env'
import { BOOKING_COLS, cols, snapshotToBooking, SPACE_OPTION_SQL } from '../lib/bookings'
import { requireAuth } from '../middleware'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const listQuery = z.object({
  from: date.optional(),
  to: date.optional(),
  q: z.string().trim().max(100).optional(),
  type: z.string().max(80).optional(),
  space: z.enum(SPACE_OPTION_IDS).optional(),
  scope: z.enum(['upcoming', 'past', 'all']).default('all'),
  today: date.optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
})
const overlapQuery = z.object({
  start: date,
  end: date,
  spaces: z.string().transform((s) => s.split(',').filter((x) => (SPACE_IDS as string[]).includes(x))),
  exclude: z.uuid().optional(),
})

const bookingId = (raw: string) => {
  const id = z.uuid().safeParse(raw)
  if (!id.success) throw new HttpError(404, 'Booking not found')
  return id.data
}

function toRow(b: z.infer<typeof bookingInput>) {
  return {
    ...b,
    startTime: b.startSlot === 'time' ? b.startTime : null,
    endTime: b.endSlot === 'time' ? b.endTime : null,
  }
}

/** Runs a bookings write and records the resulting row in booking_history, atomically. */
async function writeWithHistory(sql: Sql, action: string, write: ReturnType<Sql>): Promise<Booking> {
  const [row] = await sql`
    with b as (${write}),
    h as (
      insert into booking_history (booking_id, user_id, action, snapshot)
      select id, user_id, ${action}, to_jsonb(b) from b
    )
    select ${cols(sql)} from b`
  if (!row) throw new HttpError(404, 'Booking not found')
  return row as Booking
}

export const bookingRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', async (c) => {
    const f = listQuery.parse(c.req.query())
    const params: unknown[] = [c.get('userId')]
    const p = (v: unknown) => `$${params.push(v)}`
    const where = ['user_id = $1', 'deleted_at is null']

    if (f.from) where.push(`end_date >= ${p(f.from)}`)
    if (f.to) where.push(`start_date <= ${p(f.to)}`)
    if (f.space) where.push(`(${SPACE_OPTION_SQL}) = ${p(f.space)}`)
    if (f.type === OTHER_EVENT) where.push(`not (event_type = any(${p([...EVENT_TYPES])}))`)
    else if (f.type) where.push(`event_type = ${p(f.type)}`)
    if (f.q) {
      const like = p(`%${f.q.replace(/[\\%_]/g, '\\$&')}%`)
      where.push(`(customer_name ilike ${like} or phone ilike ${like} or notes ilike ${like} or event_type ilike ${like})`)
    }
    const today = f.today ?? new Date().toISOString().slice(0, 10)
    if (f.scope === 'upcoming') where.push(`end_date >= ${p(today)}`)
    if (f.scope === 'past') where.push(`end_date < ${p(today)}`)

    const dir = f.scope === 'past' ? 'desc' : 'asc'
    const rows = await db(c.env).query(
      `select ${BOOKING_COLS} from bookings where ${where.join(' and ')}
       order by start_date ${dir}, start_time ${dir} nulls first, created_at limit ${p(f.limit)}`,
      params,
    )
    return c.json(rows as Booking[])
  })

  .get('/overlaps', async (c) => {
    const f = overlapQuery.parse(c.req.query())
    if (!f.spaces.length) return c.json([])
    const sql = db(c.env)
    const rows = await sql`
      select ${cols(sql)} from bookings
      where user_id = ${c.get('userId')} and deleted_at is null
        and start_date <= ${f.end} and end_date >= ${f.start}
        and spaces && ${f.spaces}::text[]
        and id is distinct from ${f.exclude ?? null}::uuid
      order by start_date`
    return c.json(rows as Booking[])
  })

  .get('/:id', async (c) => {
    const sql = db(c.env)
    const [row] = await sql`
      select ${cols(sql)} from bookings where id = ${bookingId(c.req.param('id'))} and user_id = ${c.get('userId')}`
    if (!row) throw new HttpError(404, 'Booking not found')
    return c.json(row as Booking)
  })

  .get('/:id/history', async (c) => {
    const rows = await db(c.env)`
      select id, booking_id, action, changed_at, snapshot from booking_history
      where booking_id = ${bookingId(c.req.param('id'))} and user_id = ${c.get('userId')}
      order by changed_at desc, id desc`
    return c.json(
      rows.map(
        (r): HistoryEntry => ({
          id: Number(r.id),
          bookingId: r.booking_id,
          action: r.action,
          changedAt: r.changed_at,
          snapshot: snapshotToBooking(r.snapshot),
        }),
      ),
    )
  })

  .post('/', async (c) => {
    const b = toRow(bookingInput.parse(await c.req.json()))
    const sql = db(c.env)
    const booking = await writeWithHistory(
      sql,
      'created',
      sql`insert into bookings (user_id, event_type, customer_name, phone, start_date, start_slot, start_time,
                                end_date, end_slot, end_time, spaces, amount, notes)
          values (${c.get('userId')}, ${b.eventType}, ${b.customerName}, ${b.phone}, ${b.startDate}, ${b.startSlot},
                  ${b.startTime}, ${b.endDate}, ${b.endSlot}, ${b.endTime}, ${b.spaces}::text[], ${b.amount}, ${b.notes})
          returning *`,
    )
    return c.json(booking, 201)
  })

  .put('/:id', async (c) => {
    const id = bookingId(c.req.param('id'))
    const b = toRow(bookingInput.parse(await c.req.json()))
    const sql = db(c.env)
    const booking = await writeWithHistory(
      sql,
      'updated',
      sql`update bookings set event_type = ${b.eventType}, customer_name = ${b.customerName}, phone = ${b.phone},
                start_date = ${b.startDate}, start_slot = ${b.startSlot}, start_time = ${b.startTime},
                end_date = ${b.endDate}, end_slot = ${b.endSlot}, end_time = ${b.endTime},
                spaces = ${b.spaces}::text[], amount = ${b.amount}, notes = ${b.notes}, updated_at = now()
          where id = ${id} and user_id = ${c.get('userId')} and deleted_at is null
          returning *`,
    )
    return c.json(booking)
  })

  .delete('/:id', async (c) => {
    const sql = db(c.env)
    const booking = await writeWithHistory(
      sql,
      'deleted',
      sql`update bookings set deleted_at = now(), updated_at = now()
          where id = ${bookingId(c.req.param('id'))} and user_id = ${c.get('userId')} and deleted_at is null
          returning *`,
    )
    return c.json(booking)
  })

  /** Brings a booking back to the state saved in one of its history entries (also un-deletes it). */
  .post('/:id/restore/:historyId', async (c) => {
    const id = bookingId(c.req.param('id'))
    const historyId = Number(c.req.param('historyId'))
    if (!Number.isInteger(historyId)) throw new HttpError(404, 'Version not found')
    const sql = db(c.env)
    const booking = await writeWithHistory(
      sql,
      'restored',
      sql`update bookings set
            event_type = s.j->>'event_type', customer_name = s.j->>'customer_name', phone = s.j->>'phone',
            start_date = (s.j->>'start_date')::date, start_slot = s.j->>'start_slot',
            start_time = (s.j->>'start_time')::time,
            end_date = (s.j->>'end_date')::date, end_slot = s.j->>'end_slot', end_time = (s.j->>'end_time')::time,
            spaces = array(select jsonb_array_elements_text(s.j->'spaces')),
            amount = (s.j->>'amount')::int, notes = s.j->>'notes',
            deleted_at = null, updated_at = now()
          from (select snapshot as j from booking_history
                where id = ${historyId} and booking_id = ${id} and user_id = ${c.get('userId')}) s
          where bookings.id = ${id} and bookings.user_id = ${c.get('userId')}
          returning bookings.*`,
    )
    return c.json(booking)
  })

export const trashRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', async (c) => {
    const sql = db(c.env)
    const rows = await sql`
      select ${cols(sql)} from bookings
      where user_id = ${c.get('userId')} and deleted_at is not null
      order by deleted_at desc`
    return c.json(rows as Booking[])
  })

  .post('/:id/restore', async (c) => {
    const sql = db(c.env)
    const booking = await writeWithHistory(
      sql,
      'restored',
      sql`update bookings set deleted_at = null, updated_at = now()
          where id = ${bookingId(c.req.param('id'))} and user_id = ${c.get('userId')} and deleted_at is not null
          returning *`,
    )
    return c.json(booking)
  })

export const historyRoutes = new Hono<AppEnv>().use(requireAuth).get('/', async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 100, 500)
  const rows = await db(c.env)`
    select h.id, h.booking_id, h.action, h.changed_at, h.snapshot
    from booking_history h
    where h.user_id = ${c.get('userId')}
    order by h.changed_at desc, h.id desc
    limit ${limit}`
  return c.json(
    rows.map(
      (r): HistoryEntry => ({
        id: Number(r.id),
        bookingId: r.booking_id,
        action: r.action,
        changedAt: r.changed_at,
        snapshot: snapshotToBooking(r.snapshot),
      }),
    ),
  )
})
