import { Hono } from 'hono'
import { z } from 'zod'
import type { AnalyticsDetail, AnalyticsSummary, CountRow, Totals } from '../../shared/types'
import { db, type AppEnv, type Sql } from '../env'
import { SPACE_OPTION_SQL } from '../lib/bookings'
import { requireAuth } from '../middleware'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const MIN_DATE = '1900-01-01'
const MAX_DATE = '9999-12-31'

// Events and income count in the range their booking *starts* in; booked days count every
// calendar day inside the range that has at least one booking.
function totalsQueries(sql: Sql, userId: string, from: string, to: string) {
  return [
    sql`select count(*)::int as events, coalesce(sum(amount), 0)::float8 as income
        from bookings
        where user_id = ${userId} and deleted_at is null and start_date between ${from} and ${to}`,
    sql`select count(distinct d)::int as days
        from bookings b,
             generate_series(greatest(b.start_date, ${from}::date), least(b.end_date, ${to}::date), interval '1 day') d
        where b.user_id = ${userId} and b.deleted_at is null and b.end_date >= ${from} and b.start_date <= ${to}`,
  ]
}

const toTotals = (sums: any[], days: any[]): Totals => ({
  events: sums[0].events,
  income: sums[0].income,
  bookedDays: days[0].days,
})

const toRows = (rows: any[]): CountRow[] =>
  rows.map((r) => ({ key: r.key, events: r.events, income: r.income }))

export const analyticsRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  /** Lifetime / this year / this month cards. `today` comes from the phone so "this month" uses local time. */
  .get('/summary', async (c) => {
    const today = date.parse(c.req.query('today') ?? new Date().toISOString().slice(0, 10))
    const [y, m] = today.split('-').map(Number)
    const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    const sql = db(c.env)
    const userId = c.get('userId')
    const r = await sql.transaction([
      ...totalsQueries(sql, userId, MIN_DATE, MAX_DATE),
      ...totalsQueries(sql, userId, `${y}-01-01`, `${y}-12-31`),
      ...totalsQueries(sql, userId, `${y}-${String(m).padStart(2, '0')}-01`, monthEnd),
    ])
    const summary: AnalyticsSummary = {
      lifetime: toTotals(r[0], r[1]),
      year: toTotals(r[2], r[3]),
      month: toTotals(r[4], r[5]),
    }
    return c.json(summary)
  })

  .get('/', async (c) => {
    const from = date.optional().parse(c.req.query('from')) ?? MIN_DATE
    const to = date.optional().parse(c.req.query('to')) ?? MAX_DATE
    const sql = db(c.env)
    const userId = c.get('userId')
    const inRange = sql`user_id = ${userId} and deleted_at is null and start_date between ${from} and ${to}`
    const r = await sql.transaction([
      ...totalsQueries(sql, userId, from, to),
      sql`select event_type as key, count(*)::int as events, coalesce(sum(amount), 0)::float8 as income
          from bookings where ${inRange} group by event_type order by events desc, key`,
      sql`select ${sql.unsafe(SPACE_OPTION_SQL)} as key, count(*)::int as events, coalesce(sum(amount), 0)::float8 as income
          from bookings where ${inRange} group by key order by events desc`,
      sql`select to_char(start_date, 'YYYY-MM') as key, count(*)::int as events,
                 coalesce(sum(amount), 0)::float8 as income
          from bookings where ${inRange} group by key order by key`,
    ])
    const detail: AnalyticsDetail = {
      ...toTotals(r[0], r[1]),
      byType: toRows(r[2]),
      bySpace: toRows(r[3]),
      byMonth: toRows(r[4]),
    }
    return c.json(detail)
  })
