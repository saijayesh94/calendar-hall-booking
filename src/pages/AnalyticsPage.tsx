import { addMonths, endOfMonth, format, parse } from 'date-fns'
import { useState } from 'react'
import { spaceOptionLabel, type SpaceOptionId } from '../../shared/constants'
import type { CountRow, Totals } from '../../shared/types'
import { ErrorBox, Field, PageHeader, Spinner, inputCls } from '../components/ui'
import { SPACE_COLORS } from '../lib/colors'
import { formatMoney, todayISO, toISODate } from '../lib/format'
import { useAnalytics, useAnalyticsSummary } from '../lib/queries'

const BAR_COLOR = '#2a78d6'
type Metric = 'events' | 'income'
type Mode = 'dates' | 'months' | 'years'

function TotalsGrid({ t }: { t: Totals }) {
  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      <div>
        <dt className="text-xs text-slate-500">Events</dt>
        <dd className="text-2xl font-semibold text-slate-900 tabular-nums">{t.events}</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Booked days</dt>
        <dd className="text-2xl font-semibold text-slate-900 tabular-nums">{t.bookedDays}</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Income</dt>
        <dd className="pt-1.5 text-base font-semibold text-slate-900 tabular-nums">{formatMoney(t.income)}</dd>
      </div>
    </dl>
  )
}

function SummaryCard({ title, t }: { title: string; t?: Totals }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      {t ? <TotalsGrid t={t} /> : <div className="h-14 animate-pulse rounded-lg bg-slate-100" />}
    </div>
  )
}

/** Single-measure horizontal bars; every row carries its value as text, so colour is never the only cue. */
function BarList({ rows, metric, colorFor, labelFor }: {
  rows: CountRow[]
  metric: Metric
  colorFor?: (key: string) => string
  labelFor?: (key: string) => string
}) {
  if (!rows.length) return <p className="py-3 text-sm text-slate-500">No bookings in this range.</p>
  const max = Math.max(...rows.map((r) => r[metric]), 1)
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-slate-700">{labelFor ? labelFor(r.key) : r.key}</span>
            <span className="shrink-0 text-slate-900 tabular-nums">
              {metric === 'events' ? (
                <>
                  <b className="font-semibold">{r.events}</b>
                  <span className="text-slate-500"> · {formatMoney(r.income)}</span>
                </>
              ) : (
                <>
                  <b className="font-semibold">{formatMoney(r.income)}</b>
                  <span className="text-slate-500"> · {r.events}</span>
                </>
              )}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-r bg-slate-100">
            <div
              className="h-2 rounded-r"
              style={{ width: `${(r[metric] / max) * 100}%`, background: colorFor?.(r.key) ?? BAR_COLOR }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Adds empty months so gaps in the range show up as zero rather than disappearing. */
function fillMonths(rows: CountRow[], from: string, to: string) {
  const start = parse(from.slice(0, 7), 'yyyy-MM', new Date())
  const end = parse(to.slice(0, 7), 'yyyy-MM', new Date())
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const out: CountRow[] = []
  for (let m = start, n = 0; m <= end && n < 120; m = addMonths(m, 1), n++) {
    const key = format(m, 'yyyy-MM')
    out.push(byKey.get(key) ?? { key, events: 0, income: 0 })
  }
  return out
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid rounded-xl bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`rounded-lg py-1.5 text-sm font-medium ${value === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const today = todayISO()
  const year = Number(today.slice(0, 4))
  const summary = useAnalyticsSummary(today)

  const [mode, setMode] = useState<Mode>('months')
  const [dates, setDates] = useState({ from: `${year}-01-01`, to: today })
  const [months, setMonths] = useState({ from: `${year}-01`, to: today.slice(0, 7) })
  const [years, setYears] = useState({ from: year, to: year })
  const [metric, setMetric] = useState<Metric>('events')

  const range =
    mode === 'dates'
      ? dates
      : mode === 'months'
        ? { from: `${months.from}-01`, to: months.to ? toISODate(endOfMonth(parse(months.to, 'yyyy-MM', new Date()))) : '' }
        : { from: `${years.from}-01-01`, to: `${years.to}-12-31` }
  const validRange = !!range.from && !!range.to && range.to >= range.from
  const detail = useAnalytics(range.from, range.to)

  const yearOptions = Array.from({ length: 14 }, (_, i) => year - 10 + i)

  return (
    <div className="pb-24">
      <PageHeader title="Analytics" />
      {summary.isError && <ErrorBox error={summary.error} />}
      <div className="space-y-2 p-4">
        <SummaryCard title="Lifetime" t={summary.data?.lifetime} />
        <SummaryCard title={`This year (${year})`} t={summary.data?.year} />
        <SummaryCard title={`This month (${format(new Date(), 'MMMM')})`} t={summary.data?.month} />
      </div>

      <section className="mx-4 rounded-xl border border-slate-200 bg-white p-3">
        <h2 className="mb-3 font-semibold text-slate-900">Custom range</h2>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            ['dates', 'Dates'],
            ['months', 'Months'],
            ['years', 'Years'],
          ]}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {mode === 'dates' && (
            <>
              <Field label="From">
                <input className={inputCls} type="date" value={dates.from} onChange={(e) => setDates({ ...dates, from: e.target.value })} />
              </Field>
              <Field label="To">
                <input className={inputCls} type="date" value={dates.to} min={dates.from} onChange={(e) => setDates({ ...dates, to: e.target.value })} />
              </Field>
            </>
          )}
          {mode === 'months' && (
            <>
              <Field label="From">
                <input className={inputCls} type="month" value={months.from} onChange={(e) => setMonths({ ...months, from: e.target.value })} />
              </Field>
              <Field label="To">
                <input className={inputCls} type="month" value={months.to} min={months.from} onChange={(e) => setMonths({ ...months, to: e.target.value })} />
              </Field>
            </>
          )}
          {mode === 'years' && (
            <>
              <Field label="From">
                <select className={inputCls} value={years.from} onChange={(e) => setYears({ ...years, from: Number(e.target.value) })}>
                  {yearOptions.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </Field>
              <Field label="To">
                <select className={inputCls} value={years.to} onChange={(e) => setYears({ ...years, to: Number(e.target.value) })}>
                  {yearOptions.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>

        {!validRange ? (
          <p className="mt-4 text-sm text-red-600">"To" must be the same as or after "From".</p>
        ) : detail.isError ? (
          <ErrorBox error={detail.error} />
        ) : !detail.data ? (
          <Spinner />
        ) : (
          <div className={`mt-4 space-y-6 ${detail.isFetching ? 'opacity-60' : ''}`}>
            <TotalsGrid t={detail.data} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-slate-600">Bars show</span>
              <div className="w-48">
                <Segmented
                  value={metric}
                  onChange={setMetric}
                  options={[
                    ['events', 'Events'],
                    ['income', 'Income'],
                  ]}
                />
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">By event type</h3>
              <BarList rows={detail.data.byType} metric={metric} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">By space</h3>
              <BarList
                rows={detail.data.bySpace}
                metric={metric}
                labelFor={spaceOptionLabel}
                colorFor={(k) => SPACE_COLORS[k as SpaceOptionId] ?? BAR_COLOR}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">By month</h3>
              <BarList
                rows={fillMonths(detail.data.byMonth, range.from, range.to)}
                metric={metric}
                labelFor={(k) => format(parse(k, 'yyyy-MM', new Date()), 'MMM yyyy')}
              />
            </div>
            <p className="text-xs text-slate-500">
              An event counts in the month it starts. Booked days count each day the hall is in use, so a 2-day marriage
              is 1 event and 2 booked days.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
