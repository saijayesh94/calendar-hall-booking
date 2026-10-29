import type { Booking } from '../../shared/types'
import type { Sql } from '../env'

/** Booking columns as the API returns them (camelCase, dates as plain YYYY-MM-DD strings). */
export const BOOKING_COLS = `
  id, event_type as "eventType", customer_name as "customerName", phone,
  start_date::text as "startDate", start_slot as "startSlot", to_char(start_time, 'HH24:MI') as "startTime",
  end_date::text as "endDate", end_slot as "endSlot", to_char(end_time, 'HH24:MI') as "endTime",
  spaces, amount, notes, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"`

export const cols = (sql: Sql) => sql.unsafe(BOOKING_COLS)

/** SQL version of spaceOptionFor() in shared/constants.ts. */
export const SPACE_OPTION_SQL = `case
  when 'rooms' = any(spaces) and ('main' = any(spaces) or 'dining' = any(spaces)) then 'full'
  when 'main' = any(spaces) then 'halls'
  when 'dining' = any(spaces) then 'dining'
  else 'rooms' end`

/** booking_history.snapshot holds to_jsonb(bookings row); convert it to the API shape. */
export function snapshotToBooking(j: Record<string, any>): Booking {
  return {
    id: j.id,
    eventType: j.event_type,
    customerName: j.customer_name,
    phone: j.phone,
    startDate: j.start_date,
    startSlot: j.start_slot,
    startTime: j.start_time?.slice(0, 5) ?? null,
    endDate: j.end_date,
    endSlot: j.end_slot,
    endTime: j.end_time?.slice(0, 5) ?? null,
    spaces: j.spaces,
    amount: j.amount,
    notes: j.notes,
    createdAt: j.created_at,
    updatedAt: j.updated_at,
    deletedAt: j.deleted_at,
  }
}
