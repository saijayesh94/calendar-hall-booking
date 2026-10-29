import { useState } from 'react'
import { ChevronLeft, ChevronRight } from './icons'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Year stepper plus a 12-month grid, for jumping straight to any month. */
export function MonthPicker({ value, onPick }: { value: Date; onPick: (month: Date) => void }) {
  const [year, setYear] = useState(value.getFullYear())
  const now = new Date()

  return (
    <div className="px-4 pb-2">
      <div className="flex items-center justify-between py-2">
        <button className="rounded-full p-2 active:bg-slate-100" onClick={() => setYear(year - 1)} aria-label="Previous year">
          <ChevronLeft />
        </button>
        <span className="text-xl font-semibold text-slate-900 tabular-nums">{year}</span>
        <button className="rounded-full p-2 active:bg-slate-100" onClick={() => setYear(year + 1)} aria-label="Next year">
          <ChevronRight />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {MONTHS.map((name, i) => {
          const isSelected = year === value.getFullYear() && i === value.getMonth()
          const isCurrent = year === now.getFullYear() && i === now.getMonth()
          return (
            <button
              key={name}
              onClick={() => onPick(new Date(year, i, 1))}
              className={`rounded-xl py-3 font-medium ${
                isSelected
                  ? 'bg-indigo-600 text-white'
                  : isCurrent
                    ? 'border border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'bg-slate-100 text-slate-800 active:bg-slate-200'
              }`}
            >
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
