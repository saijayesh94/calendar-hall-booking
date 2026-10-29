import { eachDayOfInterval, endOfMonth, endOfWeek, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { useMemo, useRef } from 'react'
import type { Booking } from '../../shared/types'
import { bookingColor } from '../lib/colors'
import { bookingTitle, toISODate } from '../lib/format'

const LANES = 2
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function gridRange(month: Date) {
  const start = startOfWeek(startOfMonth(month))
  const end = endOfWeek(endOfMonth(month))
  return { start: toISODate(start), end: toISODate(end), days: eachDayOfInterval({ start, end }) }
}

interface Segment {
  booking: Booking
  col: number // 0–6
  span: number
  lane: number
  startsHere: boolean
  endsHere: boolean
}

/** Places each booking that touches this week into the first free lane, like a Google Calendar month view. */
function layoutWeek(week: string[], bookings: Booking[]) {
  const first = week[0]
  const last = week[6]
  const touching = bookings
    .filter((b) => b.startDate <= last && b.endDate >= first)
    .map((b) => {
      const col = b.startDate <= first ? 0 : week.indexOf(b.startDate)
      const endCol = b.endDate >= last ? 6 : week.indexOf(b.endDate)
      return { booking: b, col, span: endCol - col + 1, startsHere: b.startDate >= first, endsHere: b.endDate <= last }
    })
    .sort((a, b) => a.col - b.col || b.span - a.span)

  const laneEnds: number[] = []
  const hiddenPerDay = Array(7).fill(0)
  const segments: Segment[] = []
  for (const s of touching) {
    let lane = laneEnds.findIndex((end) => end < s.col)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = s.col + s.span - 1
    if (lane < LANES) segments.push({ ...s, lane })
    else for (let i = s.col; i < s.col + s.span; i++) hiddenPerDay[i]++
  }
  return { segments, hiddenPerDay }
}

interface Props {
  month: Date
  bookings: Booking[]
  selected: string | null
  today: string
  onSelect: (date: string) => void
  onSwipe: (dir: 1 | -1) => void
}

export function MonthGrid({ month, bookings, selected, today, onSelect, onSwipe }: Props) {
  const weeks = useMemo(() => {
    const days = gridRange(month).days.map((d) => ({ iso: toISODate(d), date: d }))
    const out = []
    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7)
      out.push({ days: week, ...layoutWeek(week.map((d) => d.iso), bookings) })
    }
    return out
  }, [month, bookings])

  const touchX = useRef<number | null>(null)

  return (
    <div
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > 60) onSwipe(dx < 0 ? 1 : -1)
      }}
    >
      <div className="grid grid-cols-7 border-b border-slate-200 pb-1 text-center text-xs font-medium text-slate-500">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      {weeks.map((week) => (
        <div
          key={week.days[0].iso}
          className="grid grid-cols-7 border-b border-slate-100"
          style={{ gridTemplateRows: `26px repeat(${LANES}, 18px) 15px` }}
        >
          {week.days.map((d, i) => {
            const inMonth = isSameMonth(d.date, month)
            const isToday = d.iso === today
            return (
              <button
                key={d.iso}
                onClick={() => onSelect(d.iso)}
                aria-label={d.iso}
                className={`flex justify-center border-slate-100 pt-1 active:bg-slate-100 ${i > 0 ? 'border-l' : ''} ${
                  selected === d.iso ? 'bg-indigo-50' : ''
                }`}
                style={{ gridColumn: i + 1, gridRow: '1 / -1' }}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                    isToday ? 'bg-indigo-600 font-semibold text-white' : inMonth ? 'text-slate-800' : 'text-slate-300'
                  }`}
                >
                  {d.date.getDate()}
                </span>
              </button>
            )
          })}
          {week.segments.map((s) => {
            const color = bookingColor(s.booking.spaces)
            return (
              <div
                key={s.booking.id}
                className={`pointer-events-none z-10 my-px truncate px-1 text-[10px] leading-4 font-medium text-slate-800 ${
                  s.startsHere ? 'ml-0.5 rounded-l' : ''
                } ${s.endsHere ? 'mr-0.5 rounded-r' : ''}`}
                style={{
                  gridColumn: `${s.col + 1} / span ${s.span}`,
                  gridRow: s.lane + 2,
                  background: `${color}33`,
                  borderLeft: s.startsHere ? `3px solid ${color}` : undefined,
                }}
              >
                {bookingTitle(s.booking)}
              </div>
            )
          })}
          {week.hiddenPerDay.map((n, i) =>
            n ? (
              <span
                key={i}
                className="pointer-events-none z-10 text-center text-[10px] leading-4 font-semibold text-slate-500"
                style={{ gridColumn: i + 1, gridRow: LANES + 2 }}
              >
                +{n}
              </span>
            ) : null,
          )}
        </div>
      ))}
    </div>
  )
}
