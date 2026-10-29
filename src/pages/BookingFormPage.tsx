import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import {
  EVENT_TYPES,
  OTHER_EVENT,
  SLOTS,
  SPACE_OPTIONS,
  spaceOptionFor,
  type SlotId,
  type SpaceOptionId,
} from '../../shared/constants'
import type { Booking, BookingFields } from '../../shared/types'
import { WarningIcon } from '../components/icons'
import { ErrorBox, Field, PageHeader, Spinner, btnPrimary, inputCls, useUi } from '../components/ui'
import { SPACE_COLORS } from '../lib/colors'
import { bookingTitle, formatMoney, isKnownEventType, todayISO, whenLabel } from '../lib/format'
import { useBooking, useOverlaps, useSaveBooking } from '../lib/queries'

interface FormState {
  eventChoice: string // one of EVENT_TYPES, or OTHER_EVENT
  customEvent: string
  customerName: string
  phone: string
  startDate: string
  startSlot: SlotId
  startTime: string
  endDate: string
  endSlot: SlotId
  endTime: string
  space: SpaceOptionId
  amount: string
  notes: string
}

function initialState(date: string, b?: Booking): FormState {
  if (!b) {
    return {
      eventChoice: EVENT_TYPES[0],
      customEvent: '',
      customerName: '',
      phone: '',
      startDate: date,
      startSlot: 'full',
      startTime: '',
      endDate: date,
      endSlot: 'full',
      endTime: '',
      space: 'full',
      amount: '',
      notes: '',
    }
  }
  const known = isKnownEventType(b.eventType)
  return {
    eventChoice: known ? b.eventType : OTHER_EVENT,
    customEvent: known ? '' : b.eventType === OTHER_EVENT ? '' : b.eventType,
    customerName: b.customerName ?? '',
    phone: b.phone ?? '',
    startDate: b.startDate,
    startSlot: b.startSlot,
    startTime: b.startTime ?? '',
    endDate: b.endDate,
    endSlot: b.endSlot,
    endTime: b.endTime ?? '',
    space: spaceOptionFor(b.spaces),
    amount: b.amount != null ? String(b.amount) : '',
    notes: b.notes ?? '',
  }
}

const spacesFor = (id: SpaceOptionId) => [...SPACE_OPTIONS.find((o) => o.id === id)!.spaces]

function toFields(f: FormState): BookingFields {
  const amount = f.amount.replace(/[^\d]/g, '')
  return {
    eventType: f.eventChoice === OTHER_EVENT ? f.customEvent.trim() || OTHER_EVENT : f.eventChoice,
    customerName: f.customerName.trim() || null,
    phone: f.phone.trim() || null,
    startDate: f.startDate,
    startSlot: f.startSlot,
    startTime: f.startSlot === 'time' ? f.startTime || null : null,
    endDate: f.endDate,
    endSlot: f.endSlot,
    endTime: f.endSlot === 'time' ? f.endTime || null : null,
    spaces: spacesFor(f.space),
    amount: amount ? Number(amount) : null,
    notes: f.notes.trim() || null,
  }
}

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {}
  if (!f.startDate) e.startDate = 'Pick a start date'
  if (!f.endDate) e.endDate = 'Pick an end date'
  else if (f.endDate < f.startDate) e.endDate = 'End date is before start date'
  if (f.startSlot === 'time' && !f.startTime) e.startTime = 'Pick a start time'
  if (f.endSlot === 'time' && !f.endTime) e.endTime = 'Pick an end time'
  return e
}

export default function BookingFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const existing = useBooking(id)

  if (id && existing.isPending) return <><PageHeader title="Edit booking" back /><Spinner /></>
  if (id && existing.isError) return <><PageHeader title="Edit booking" back /><ErrorBox error={existing.error} /></>
  return <BookingForm key={id ?? 'new'} booking={existing.data} date={params.get('date') ?? todayISO()} />
}

function BookingForm({ booking, date }: { booking?: Booking; date: string }) {
  const navigate = useNavigate()
  const { toast } = useUi()
  const save = useSaveBooking()
  const [f, setF] = useState(() => initialState(date, booking))
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validate(f) : {}

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }))

  // Keep the end date from falling before the start date when the start moves.
  useEffect(() => {
    setF((prev) => (prev.startDate && prev.endDate < prev.startDate ? { ...prev, endDate: prev.startDate } : prev))
  }, [f.startDate])

  const overlaps = useOverlaps({ start: f.startDate, end: f.endDate, spaces: spacesFor(f.space), exclude: booking?.id })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(validate(f)).length) return
    try {
      const saved = await save.mutateAsync({ id: booking?.id, data: toFields(f) })
      toast(booking ? 'Booking updated' : 'Booking saved')
      navigate(`/bookings/${saved.id}`, { replace: true })
    } catch {
      // error shown below
    }
  }

  const amountNum = Number(f.amount.replace(/[^\d]/g, ''))

  return (
    <form onSubmit={onSubmit} className="pb-28">
      <PageHeader title={booking ? 'Edit booking' : 'New booking'} back />
      <div className="space-y-4 p-4">
        <Field label="Event type">
          <select className={inputCls} value={f.eventChoice} onChange={(e) => set('eventChoice', e.target.value)}>
            {EVENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
            <option value={OTHER_EVENT}>Other (type your own)</option>
          </select>
        </Field>
        {f.eventChoice === OTHER_EVENT && (
          <Field label="Event name">
            <input
              className={inputCls}
              value={f.customEvent}
              onChange={(e) => set('customEvent', e.target.value)}
              placeholder="e.g. Rakshabandhan"
              maxLength={80}
            />
          </Field>
        )}

        <Field label="Customer name">
          <input
            className={inputCls}
            value={f.customerName}
            onChange={(e) => set('customerName', e.target.value)}
            placeholder="e.g. Pavan"
            autoComplete="off"
            maxLength={120}
          />
        </Field>

        <Field label="Phone">
          <input
            className={inputCls}
            type="tel"
            inputMode="tel"
            value={f.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="Optional"
            autoComplete="off"
            maxLength={40}
          />
        </Field>

        <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <legend className="px-1 text-sm font-semibold text-slate-700">Start</legend>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date" error={errors.startDate}>
              <input className={inputCls} type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label="Time">
              <select className={inputCls} value={f.startSlot} onChange={(e) => set('startSlot', e.target.value as SlotId)}>
                {SLOTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {f.startSlot === 'time' && (
            <Field label="Start time" error={errors.startTime}>
              <input className={inputCls} type="time" value={f.startTime} onChange={(e) => set('startTime', e.target.value)} />
            </Field>
          )}
        </fieldset>

        <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <legend className="px-1 text-sm font-semibold text-slate-700">End</legend>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date" error={errors.endDate}>
              <input
                className={inputCls}
                type="date"
                value={f.endDate}
                min={f.startDate}
                onChange={(e) => set('endDate', e.target.value)}
              />
            </Field>
            <Field label="Time">
              <select className={inputCls} value={f.endSlot} onChange={(e) => set('endSlot', e.target.value as SlotId)}>
                {SLOTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {f.endSlot === 'time' && (
            <Field label="End time" error={errors.endTime}>
              <input className={inputCls} type="time" value={f.endTime} onChange={(e) => set('endTime', e.target.value)} />
            </Field>
          )}
        </fieldset>

        <div role="radiogroup" aria-label="Space">
          <span className="mb-1 block text-sm font-medium text-slate-700">Space</span>
          <div className="grid grid-cols-2 gap-2">
            {SPACE_OPTIONS.map((o) => {
              const on = f.space === o.id
              return (
                <button
                  type="button"
                  role="radio"
                  key={o.id}
                  onClick={() => set('space', o.id)}
                  aria-checked={on}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium ${
                    on ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SPACE_COLORS[o.id] }} />
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>

        {overlaps.data && overlaps.data.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
            <p className="flex items-center gap-2 font-semibold">
              <WarningIcon width={18} height={18} /> Already booked in the same space
            </p>
            <ul className="mt-1 space-y-1">
              {overlaps.data.map((b) => (
                <li key={b.id}>
                  <span className="font-medium">{bookingTitle(b)}</span> ({b.eventType}) · {whenLabel(b)}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-amber-800">You can still save this booking.</p>
          </div>
        )}

        <Field label="Amount (₹)">
          <input
            className={inputCls}
            inputMode="numeric"
            value={f.amount}
            onChange={(e) => set('amount', e.target.value.replace(/[^\d]/g, ''))}
            placeholder="Optional, e.g. 30000"
          />
          {amountNum > 0 && <span className="mt-1 block text-sm text-slate-500">{formatMoney(amountNum)}</span>}
        </Field>

        <Field label="Notes">
          <textarea
            className={`${inputCls} min-h-24`}
            value={f.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Anything else to remember"
            maxLength={2000}
          />
        </Field>

        {save.isError && <ErrorBox error={save.error} />}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button type="submit" className={`${btnPrimary} w-full`} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : booking ? 'Save changes' : 'Save booking'}
        </button>
      </div>
    </form>
  )
}
