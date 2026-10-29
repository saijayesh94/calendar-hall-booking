import { format, parseISO } from 'date-fns'
import { EVENT_TYPES, OTHER_EVENT, slotLabel } from '../../shared/constants'
import type { Booking } from '../../shared/types'

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
export const formatMoney = (n: number) => inr.format(n)

/** Local date as YYYY-MM-DD (toISOString would shift to UTC). */
export const toISODate = (d: Date) => format(d, 'yyyy-MM-dd')
export const todayISO = () => toISODate(new Date())

export const fmtDate = (iso: string, pattern = 'EEE, d MMM yyyy') => format(parseISO(iso), pattern)
export const fmtDateTime = (iso: string) => format(new Date(iso), "d MMM yyyy, h:mm a")

function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return format(new Date(2000, 0, 1, h, m), 'h:mm a')
}

export function timeLabel(slot: Booking['startSlot'], time: string | null) {
  if (slot === 'full') return null
  if (slot === 'time') return time ? fmtTime(time) : null
  return slotLabel(slot)
}

/** e.g. "Wed, 5 Feb 2026 · Evening" or "12 Mar (Evening) → 13 Mar 2026 (Evening)" */
export function whenLabel(b: Pick<Booking, 'startDate' | 'endDate' | 'startSlot' | 'startTime' | 'endSlot' | 'endTime'>) {
  const st = timeLabel(b.startSlot, b.startTime)
  const et = timeLabel(b.endSlot, b.endTime)
  if (b.startDate === b.endDate) {
    const times = st && et && st !== et ? `${st} – ${et}` : (st ?? et)
    return `${fmtDate(b.startDate)}${times ? ` · ${times}` : ''}`
  }
  const sameYear = b.startDate.slice(0, 4) === b.endDate.slice(0, 4)
  const start = fmtDate(b.startDate, sameYear ? 'd MMM' : 'd MMM yyyy') + (st ? ` (${st})` : '')
  const end = fmtDate(b.endDate, 'd MMM yyyy') + (et ? ` (${et})` : '')
  return `${start} → ${end}`
}

export const bookingTitle = (b: Pick<Booking, 'customerName' | 'eventType'>) => b.customerName || b.eventType

export const isKnownEventType = (t: string) => (EVENT_TYPES as readonly string[]).includes(t)
export const eventTypeGroup = (t: string) => (isKnownEventType(t) ? t : OTHER_EVENT)

export const dayCount = (b: Pick<Booking, 'startDate' | 'endDate'>) =>
  Math.round((parseISO(b.endDate).getTime() - parseISO(b.startDate).getTime()) / 86_400_000) + 1
