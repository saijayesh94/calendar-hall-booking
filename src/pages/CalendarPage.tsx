import { addDays, addMonths, format, parse, startOfMonth } from 'date-fns'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { SPACE_OPTIONS } from '../../shared/constants'
import { BookingCard } from '../components/BookingCard'
import { ChevronDown, ChevronLeft, ChevronRight, PlusIcon } from '../components/icons'
import { gridRange, MonthGrid } from '../components/MonthGrid'
import { MonthPicker } from '../components/MonthPicker'
import { Empty, ErrorBox, Sheet, Spinner, btnPrimary } from '../components/ui'
import { SPACE_COLORS } from '../lib/colors'
import { fmtDate, todayISO, toISODate } from '../lib/format'
import { useBookings } from '../lib/queries'

export default function CalendarPage() {
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const month = useMemo(() => {
    const m = params.get('m')
    return m ? parse(m, 'yyyy-MM', new Date()) : startOfMonth(new Date())
  }, [params])
  const selected = params.get('d')
  const [pickerOpen, setPickerOpen] = useState(false)

  const range = gridRange(month)
  const monthQuery = useBookings({ from: range.start, to: range.end })
  const upcoming = useBookings({ from: today, to: toISODate(addDays(new Date(), 30)), today, scope: 'upcoming' })

  const update = (next: { m?: Date; d?: string | null }) => {
    const p = new URLSearchParams(params)
    if (next.m) p.set('m', format(next.m, 'yyyy-MM'))
    if (next.d === null) p.delete('d')
    else if (next.d) p.set('d', next.d)
    setParams(p, { replace: true })
  }

  const dayBookings = (monthQuery.data ?? []).filter((b) => selected && b.startDate <= selected && b.endDate >= selected)

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-slate-200 bg-white px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button className="rounded-full p-2 active:bg-slate-100" onClick={() => update({ m: addMonths(month, -1) })} aria-label="Previous month">
          <ChevronLeft />
        </button>
        <h1 className="flex flex-1 justify-center">
          <button
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-lg font-semibold text-slate-900 active:bg-slate-100"
            onClick={() => setPickerOpen(true)}
            aria-label="Choose month and year"
          >
            {format(month, 'MMMM yyyy')}
            <ChevronDown width={18} height={18} className="text-slate-500" />
          </button>
        </h1>
        <button className="rounded-full p-2 active:bg-slate-100" onClick={() => update({ m: addMonths(month, 1) })} aria-label="Next month">
          <ChevronRight />
        </button>
        <button
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-100"
          onClick={() => update({ m: startOfMonth(new Date()) })}
        >
          Today
        </button>
      </header>

      <div className="bg-white px-1 pt-2">
        {monthQuery.isError ? (
          <ErrorBox error={monthQuery.error} />
        ) : (
          <MonthGrid
            month={month}
            bookings={monthQuery.data ?? []}
            selected={selected}
            today={today}
            onSelect={(d) => update({ d })}
            onSwipe={(dir) => update({ m: addMonths(month, dir) })}
          />
        )}
        <div className="flex flex-wrap justify-center gap-4 py-2 text-xs text-slate-600">
          {SPACE_OPTIONS.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SPACE_COLORS[s.id] }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <section className="px-4 pt-4">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">Next 30 days</h2>
        {upcoming.isPending ? (
          <Spinner />
        ) : upcoming.isError ? (
          <ErrorBox error={upcoming.error} />
        ) : upcoming.data.length === 0 ? (
          <Empty>No bookings in the next 30 days.</Empty>
        ) : (
          <div className="space-y-2">
            {upcoming.data.map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>

      <Link
        to={`/bookings/new?date=${selected ?? today}`}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg active:bg-indigo-700"
        aria-label="Add booking"
      >
        <PlusIcon width={28} height={28} />
      </Link>

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <MonthPicker
          value={month}
          onPick={(m) => {
            setPickerOpen(false)
            update({ m, d: null })
          }}
        />
      </Sheet>

      <Sheet open={!!selected} onClose={() => update({ d: null })}>
        {selected && (
          <div className="px-4">
            <h2 className="py-2 text-lg font-semibold text-slate-900">{fmtDate(selected, 'EEEE, d MMMM yyyy')}</h2>
            {dayBookings.length === 0 ? (
              <p className="py-4 text-slate-500">No bookings. The hall is free on this day.</p>
            ) : (
              <div className="space-y-2 pb-3">
                {dayBookings.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </div>
            )}
            <Link to={`/bookings/new?date=${selected}`} className={`${btnPrimary} mt-2 w-full`}>
              <PlusIcon /> Add booking
            </Link>
          </div>
        )}
      </Sheet>
    </div>
  )
}
