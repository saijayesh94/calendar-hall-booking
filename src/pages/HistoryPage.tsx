import { Link, useSearchParams } from 'react-router'
import { BookingCard } from '../components/BookingCard'
import { Empty, ErrorBox, PageHeader, Spinner, useUi } from '../components/ui'
import { bookingTitle, fmtDateTime, whenLabel } from '../lib/format'
import { useAllHistory, useRestoreFromTrash, useTrash } from '../lib/queries'
import { ACTION_LABELS } from './BookingDetailPage'

const ACTION_STYLES = {
  created: 'bg-emerald-50 text-emerald-800',
  updated: 'bg-indigo-50 text-indigo-800',
  deleted: 'bg-red-50 text-red-800',
  restored: 'bg-amber-50 text-amber-900',
} as const

function Changes() {
  const history = useAllHistory()
  if (history.isPending) return <Spinner />
  if (history.isError) return <ErrorBox error={history.error} />
  if (!history.data.length) return <Empty>No changes yet.</Empty>
  return (
    <ol className="space-y-2 p-4">
      {history.data.map((h) => (
        <li key={h.id}>
          <Link to={`/bookings/${h.bookingId}`} className="block rounded-xl border border-slate-200 bg-white p-3 active:bg-slate-50">
            <div className="flex items-center justify-between gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ACTION_STYLES[h.action]}`}>{ACTION_LABELS[h.action]}</span>
              <span className="text-xs text-slate-500">{fmtDateTime(h.changedAt)}</span>
            </div>
            <p className="mt-1 truncate font-medium text-slate-900">
              {bookingTitle(h.snapshot)}
              {h.snapshot.customerName && <span className="font-normal text-slate-500"> · {h.snapshot.eventType}</span>}
            </p>
            <p className="text-sm text-slate-500">{whenLabel(h.snapshot)}</p>
          </Link>
        </li>
      ))}
    </ol>
  )
}

function Trash() {
  const trash = useTrash()
  const restore = useRestoreFromTrash()
  const { toast } = useUi()
  if (trash.isPending) return <Spinner />
  if (trash.isError) return <ErrorBox error={trash.error} />
  if (!trash.data.length) return <Empty>Trash is empty.</Empty>
  return (
    <div className="space-y-3 p-4">
      {trash.data.map((b) => (
        <div key={b.id}>
          <BookingCard booking={b} />
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-xs text-slate-500">Deleted {fmtDateTime(b.deletedAt!)}</span>
            <button
              className="text-sm font-semibold text-indigo-600"
              disabled={restore.isPending}
              onClick={async () => {
                await restore.mutateAsync(b.id)
                toast('Booking restored')
              }}
            >
              Restore
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HistoryPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'trash' ? 'trash' : 'changes'
  return (
    <div className="pb-24">
      <PageHeader title="History" />
      <div className="border-b border-slate-200 bg-white p-3">
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          {(['changes', 'trash'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setParams(t === 'trash' ? { tab: t } : {}, { replace: true })}
              className={`rounded-lg py-1.5 text-sm font-medium ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            >
              {t === 'changes' ? 'All changes' : 'Trash'}
            </button>
          ))}
        </div>
      </div>
      {tab === 'changes' ? <Changes /> : <Trash />}
    </div>
  )
}
