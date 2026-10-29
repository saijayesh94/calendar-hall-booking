import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EVENT_TYPES, OTHER_EVENT, SPACE_OPTIONS } from '../../shared/constants'
import type { Booking } from '../../shared/types'
import { BookingCard } from '../components/BookingCard'
import { PlusIcon, SearchIcon } from '../components/icons'
import { Empty, ErrorBox, PageHeader, Spinner, inputCls } from '../components/ui'
import { fmtDate, todayISO } from '../lib/format'
import { useBookings } from '../lib/queries'

const SCOPES = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
] as const
type Scope = (typeof SCOPES)[number]['id']

function groupByMonth(bookings: Booking[]) {
  const groups: { month: string; items: Booking[] }[] = []
  for (const b of bookings) {
    const month = b.startDate.slice(0, 7)
    if (groups.at(-1)?.month !== month) groups.push({ month, items: [] })
    groups.at(-1)!.items.push(b)
  }
  return groups
}

export default function BookingsPage() {
  const [params, setParams] = useSearchParams()
  const scope = (params.get('scope') as Scope) || 'upcoming'
  const type = params.get('type') ?? ''
  const space = params.get('space') ?? ''
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [q, setQ] = useState(search)

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(params)
    if (value) p.set(key, value)
    else p.delete(key)
    setParams(p, { replace: true })
  }

  const list = useBookings({ scope, type, space, q, today: todayISO() })

  return (
    <div className="pb-24">
      <PageHeader title="Bookings" />
      <div className="space-y-3 border-b border-slate-200 bg-white p-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" width={18} height={18} />
          <input
            className={`${inputCls} pl-9`}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, notes"
          />
        </div>
        <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              onClick={() => setParam('scope', s.id)}
              className={`rounded-lg py-1.5 text-sm font-medium ${scope === s.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className={`${inputCls} py-2 text-sm`} value={type} onChange={(e) => setParam('type', e.target.value)} aria-label="Event type">
            <option value="">All events</option>
            {EVENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
            <option value={OTHER_EVENT}>Other</option>
          </select>
          <select className={`${inputCls} py-2 text-sm`} value={space} onChange={(e) => setParam('space', e.target.value)} aria-label="Space">
            <option value="">All spaces</option>
            {SPACE_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorBox error={list.error} />
      ) : list.data.length === 0 ? (
        <Empty>No bookings found.</Empty>
      ) : (
        <div className="px-4">
          <p className="pt-3 text-sm text-slate-500">
            {list.data.length} booking{list.data.length === 1 ? '' : 's'}
          </p>
          {groupByMonth(list.data).map((g) => (
            <section key={g.month}>
              <h2 className="pt-4 pb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
                {fmtDate(`${g.month}-01`, 'MMMM yyyy')}
              </h2>
              <div className="space-y-2">
                {g.items.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Link
        to={`/bookings/new?date=${todayISO()}`}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg active:bg-indigo-700"
        aria-label="Add booking"
      >
        <PlusIcon width={28} height={28} />
      </Link>
    </div>
  )
}
