import { useState } from 'react'
import { spacesLabel } from '../../shared/constants'
import type { Booking } from '../../shared/types'
import { ErrorBox, Field, PageHeader, btnDanger, btnPrimary, btnSecondary, inputCls, useUi } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dayCount, timeLabel, todayISO } from '../lib/format'

async function exportToExcel() {
  const [{ default: writeExcelFile }, bookings] = await Promise.all([
    import('write-excel-file/browser'),
    api<Booking[]>('/bookings', { query: { scope: 'all', limit: 5000 } }),
  ])
  const text = (header: string, get: (b: Booking) => string | null, width = 16) => ({
    header: { value: header, fontWeight: 'bold' as const },
    cell: (b: Booking) => ({ value: get(b) ?? '' }),
    width,
  })
  const columns = [
    text('Start date', (b) => b.startDate, 12),
    text('Start time', (b) => timeLabel(b.startSlot, b.startTime) ?? 'Full day', 11),
    text('End date', (b) => b.endDate, 12),
    text('End time', (b) => timeLabel(b.endSlot, b.endTime) ?? 'Full day', 11),
    { header: { value: 'Days', fontWeight: 'bold' as const }, cell: (b: Booking) => ({ value: dayCount(b) }), width: 6 },
    text('Event', (b) => b.eventType, 22),
    text('Customer', (b) => b.customerName, 24),
    text('Phone', (b) => b.phone, 14),
    text('Space', (b) => spacesLabel(b.spaces), 18),
    {
      header: { value: 'Amount (₹)', fontWeight: 'bold' as const },
      cell: (b: Booking) => (b.amount != null ? { value: b.amount, format: '#,##0' } : { value: undefined }),
      width: 12,
    },
    text('Notes', (b) => b.notes, 40),
  ]
  await writeExcelFile(bookings, { columns, sheet: 'Bookings', stickyRowsCount: 1 }).toFile(`hall-bookings-${todayISO()}.xlsx`)
  return bookings.length
}

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { toast, confirm } = useUi()
  const [exporting, setExporting] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSaving, setPwSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const onExport = async () => {
    setExporting(true)
    setError(null)
    try {
      const n = await exportToExcel()
      toast(`Exported ${n} bookings`)
    } catch (e) {
      setError(e)
    } finally {
      setExporting(false)
    }
  }

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(null)
    if (pw.next.length < 8) return setPwError('New password must be at least 8 characters')
    if (pw.next !== pw.confirm) return setPwError('New passwords do not match')
    setPwSaving(true)
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: pw.current, newPassword: pw.next } })
      setPw({ current: '', next: '', confirm: '' })
      toast('Password changed. Other devices were logged out.')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="pb-24">
      <PageHeader title="Settings" />
      <div className="space-y-4 p-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-semibold text-slate-900">{user?.name}</p>
          <p className="text-sm text-slate-600">{user?.email}</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Backup</h2>
          <p className="mt-1 text-sm text-slate-600">Download all your bookings as an Excel file.</p>
          <button className={`${btnSecondary} mt-3 w-full`} onClick={onExport} disabled={exporting}>
            {exporting ? 'Preparing…' : 'Export to Excel'}
          </button>
          {error != null && <ErrorBox error={error} />}
        </section>

        <form onSubmit={onChangePassword} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Change password</h2>
          {/* Lets password managers know which account this is for. */}
          <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
          <Field label="Current password">
            <input className={inputCls} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          </Field>
          <Field label="New password">
            <input className={inputCls} type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
          </Field>
          <Field label="Confirm new password">
            <input className={inputCls} type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
          </Field>
          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          <button className={`${btnPrimary} w-full`} disabled={pwSaving}>
            {pwSaving ? 'Saving…' : 'Change password'}
          </button>
        </form>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <button className={`${btnSecondary} w-full`} onClick={() => logout()}>
            Log out
          </button>
          <button
            className={`${btnDanger} w-full`}
            onClick={async () => {
              const ok = await confirm({
                title: 'Log out from all devices?',
                message: 'Every phone or browser logged in to this account, including this one, will need to log in again.',
                confirmLabel: 'Log out all',
                danger: true,
              })
              if (ok) logout(true)
            }}
          >
            Log out from all devices
          </button>
        </section>
      </div>
    </div>
  )
}
