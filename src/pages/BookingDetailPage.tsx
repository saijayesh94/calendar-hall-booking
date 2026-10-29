import { Link, useNavigate, useParams } from 'react-router'
import { spacesLabel } from '../../shared/constants'
import type { Booking, HistoryAction, HistoryEntry } from '../../shared/types'
import { PhoneIcon } from '../components/icons'
import { ErrorBox, PageHeader, Spinner, btnDanger, btnPrimary, btnSecondary, useUi } from '../components/ui'
import { bookingColor } from '../lib/colors'
import { bookingTitle, dayCount, fmtDateTime, formatMoney, timeLabel, whenLabel } from '../lib/format'
import { useBooking, useBookingHistory, useDeleteBooking, useRestoreFromTrash, useRestoreVersion } from '../lib/queries'

export const ACTION_LABELS: Record<HistoryAction, string> = {
  created: 'Created',
  updated: 'Edited',
  deleted: 'Deleted',
  restored: 'Restored',
}

const FIELD_LABELS: [keyof Booking, string, (b: Booking) => string][] = [
  ['eventType', 'Event', (b) => b.eventType],
  ['customerName', 'Name', (b) => b.customerName ?? '—'],
  ['phone', 'Phone', (b) => b.phone ?? '—'],
  ['startDate', 'Start date', (b) => b.startDate],
  ['startSlot', 'Start time', (b) => timeLabel(b.startSlot, b.startTime) ?? 'Full day'],
  ['endDate', 'End date', (b) => b.endDate],
  ['endSlot', 'End time', (b) => timeLabel(b.endSlot, b.endTime) ?? 'Full day'],
  ['spaces', 'Space', (b) => spacesLabel(b.spaces)],
  ['amount', 'Amount', (b) => (b.amount != null ? formatMoney(b.amount) : '—')],
  ['notes', 'Notes', (b) => b.notes ?? '—'],
]

/** Human-readable list of what changed between two versions of a booking. */
export function diffBookings(before: Booking, after: Booking) {
  const changes: { label: string; from: string; to: string }[] = []
  for (const [, label, show] of FIELD_LABELS) {
    const from = show(before)
    const to = show(after)
    if (from !== to) changes.push({ label, from, to })
  }
  return changes
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-slate-100 py-3 last:border-0">
      <dt className="w-24 shrink-0 text-sm text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-slate-900">{children}</dd>
    </div>
  )
}

export default function BookingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast, confirm } = useUi()
  const query = useBooking(id)
  const history = useBookingHistory(id)
  const del = useDeleteBooking()
  const restoreTrash = useRestoreFromTrash()
  const restoreVersion = useRestoreVersion()

  if (query.isPending) return <><PageHeader title="Booking" back /><Spinner /></>
  if (query.isError) return <><PageHeader title="Booking" back /><ErrorBox error={query.error} /></>
  const b = query.data
  const deleted = !!b.deletedAt

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete this booking?',
      message: 'It will move to Trash. You can restore it from History → Trash.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    await del.mutateAsync(b.id)
    toast('Moved to Trash')
    navigate(-1)
  }

  const onRestoreVersion = async (h: HistoryEntry) => {
    const ok = await confirm({
      title: 'Restore this version?',
      message: `The booking will go back to how it was on ${fmtDateTime(h.changedAt)}. The current version stays in history.`,
      confirmLabel: 'Restore',
    })
    if (!ok) return
    await restoreVersion.mutateAsync({ bookingId: b.id, historyId: h.id })
    toast('Version restored')
  }

  return (
    <div className="pb-24">
      <PageHeader
        title={bookingTitle(b)}
        back
        right={
          !deleted && (
            <Link to={`/bookings/${b.id}/edit`} className="rounded-lg px-3 py-1.5 font-semibold text-indigo-600 active:bg-indigo-50">
              Edit
            </Link>
          )
        }
      />

      {deleted && (
        <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          This booking is in Trash.
          <button
            className={`${btnPrimary} mt-2 w-full`}
            disabled={restoreTrash.isPending}
            onClick={async () => {
              await restoreTrash.mutateAsync(b.id)
              toast('Booking restored')
            }}
          >
            Restore booking
          </button>
        </div>
      )}

      <div className="m-4 rounded-xl border border-slate-200 bg-white px-4">
        <dl>
          <Row label="Event">{b.eventType}</Row>
          {b.customerName && <Row label="Name">{b.customerName}</Row>}
          <Row label="When">
            {whenLabel(b)}
            {dayCount(b) > 1 && <span className="ml-1 text-sm text-slate-500">({dayCount(b)} days)</span>}
          </Row>
          <Row label="Space">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: bookingColor(b.spaces) }} />
              {spacesLabel(b.spaces)}
            </span>
          </Row>
          {b.phone && <Row label="Phone">{b.phone}</Row>}
          {b.amount != null && <Row label="Amount">{formatMoney(b.amount)}</Row>}
          {b.notes && <Row label="Notes"><span className="whitespace-pre-wrap">{b.notes}</span></Row>}
        </dl>
      </div>

      {!deleted && (
        <div className={`mx-4 grid gap-3 ${b.phone ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {b.phone && (
            <a href={`tel:${b.phone.replace(/[^\d+]/g, '')}`} className={btnSecondary}>
              <PhoneIcon width={18} height={18} /> Call
            </a>
          )}
          <button className={btnDanger} onClick={onDelete} disabled={del.isPending}>
            Delete
          </button>
        </div>
      )}

      <section className="mx-4 mt-6">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">Change history</h2>
        {history.isPending ? (
          <Spinner />
        ) : history.isError ? (
          <ErrorBox error={history.error} />
        ) : (
          <ol className="space-y-2">
            {history.data.map((h, i) => {
              const older = history.data[i + 1]
              const changes = older && h.action === 'updated' ? diffBookings(older.snapshot, h.snapshot) : []
              return (
                <li key={h.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {ACTION_LABELS[h.action]}
                      {i === 0 && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">Current</span>}
                    </p>
                    <p className="text-xs text-slate-500">{fmtDateTime(h.changedAt)}</p>
                  </div>
                  {changes.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {changes.map((c) => (
                        <li key={c.label} className="text-slate-700">
                          <span className="text-slate-500">{c.label}:</span>{' '}
                          {c.from === '—' ? (
                            <span className="text-slate-500">(empty)</span>
                          ) : (
                            <span className="text-slate-500 line-through">{c.from}</span>
                          )}{' '}
                          → {c.to === '—' ? '(empty)' : c.to}
                        </li>
                      ))}
                    </ul>
                  )}
                  {i > 0 && h.action !== 'deleted' && (
                    <button
                      className="mt-2 text-sm font-semibold text-indigo-600"
                      onClick={() => onRestoreVersion(h)}
                      disabled={restoreVersion.isPending}
                    >
                      Restore this version
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
