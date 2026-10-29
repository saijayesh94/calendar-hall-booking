import { Link } from 'react-router'
import { spacesLabel } from '../../shared/constants'
import type { Booking } from '../../shared/types'
import { bookingColor } from '../lib/colors'
import { bookingTitle, formatMoney, whenLabel } from '../lib/format'

export function BookingCard({ booking: b, to }: { booking: Booking; to?: string }) {
  const showType = !!b.customerName
  return (
    <Link
      to={to ?? `/bookings/${b.id}`}
      className="flex items-stretch gap-3 rounded-xl border border-slate-200 bg-white p-3 active:bg-slate-50"
    >
      <span className="w-1 shrink-0 rounded-full" style={{ background: bookingColor(b.spaces) }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-semibold text-slate-900">{bookingTitle(b)}</p>
          {b.amount != null && <p className="shrink-0 font-medium text-slate-700">{formatMoney(b.amount)}</p>}
        </div>
        <p className="truncate text-sm text-slate-600">
          {showType && <>{b.eventType} · </>}
          {spacesLabel(b.spaces)}
        </p>
        <p className="text-sm text-slate-500">{whenLabel(b)}</p>
      </div>
    </Link>
  )
}
