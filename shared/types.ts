import { z } from 'zod'
import { SLOT_IDS, SPACE_IDS, type SlotId, type SpaceId } from './constants'

export interface User {
  id: string
  name: string
  email: string
}

export interface AuthResponse {
  accessToken: string
  user: User
}

export interface Booking {
  id: string
  eventType: string
  customerName: string | null
  phone: string | null
  startDate: string // YYYY-MM-DD
  startSlot: SlotId
  startTime: string | null // HH:MM
  endDate: string
  endSlot: SlotId
  endTime: string | null
  spaces: SpaceId[]
  amount: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type BookingFields = Omit<Booking, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>

export type HistoryAction = 'created' | 'updated' | 'deleted' | 'restored'

export interface HistoryEntry {
  id: number
  bookingId: string
  action: HistoryAction
  changedAt: string
  snapshot: Booking
}

export interface CountRow {
  key: string
  events: number
  income: number
}

export interface Totals {
  events: number
  bookedDays: number
  income: number
}

export interface AnalyticsDetail extends Totals {
  byType: CountRow[]
  bySpace: CountRow[]
  byMonth: CountRow[] // key = YYYY-MM
}

export interface AnalyticsSummary {
  lifetime: Totals
  year: Totals
  month: Totals
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
const time = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time')
  .nullable()
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null))

export const bookingInput = z
  .object({
    eventType: z.string().trim().min(1, 'Event type is required').max(80),
    customerName: optionalText(120),
    phone: optionalText(40),
    startDate: date,
    startSlot: z.enum(SLOT_IDS),
    startTime: time,
    endDate: date,
    endSlot: z.enum(SLOT_IDS),
    endTime: time,
    spaces: z.array(z.enum(SPACE_IDS)).min(1, 'Pick at least one space'),
    amount: z.number().int().min(0).max(100_000_000).nullable(),
    notes: optionalText(2000),
  })
  .refine((b) => b.endDate >= b.startDate, { message: 'End date is before start date', path: ['endDate'] })
  .refine((b) => b.startSlot !== 'time' || b.startTime, { message: 'Pick a start time', path: ['startTime'] })
  .refine((b) => b.endSlot !== 'time' || b.endTime, { message: 'Pick an end time', path: ['endTime'] })
