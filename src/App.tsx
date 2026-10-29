import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { CalendarIcon, ChartIcon, ClockIcon, GearIcon, ListIcon } from './components/icons'
import { Spinner } from './components/ui'
import { useAuth } from './lib/auth'
import AnalyticsPage from './pages/AnalyticsPage'
import { LoginPage, SignupPage } from './pages/AuthPages'
import BookingDetailPage from './pages/BookingDetailPage'
import BookingFormPage from './pages/BookingFormPage'
import BookingsPage from './pages/BookingsPage'
import CalendarPage from './pages/CalendarPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'

const TABS = [
  { to: '/', label: 'Calendar', icon: CalendarIcon, end: true },
  { to: '/bookings', label: 'Bookings', icon: ListIcon, end: true },
  { to: '/analytics', label: 'Analytics', icon: ChartIcon, end: false },
  { to: '/history', label: 'History', icon: ClockIcon, end: false },
  { to: '/settings', label: 'Settings', icon: GearIcon, end: false },
]

function AppLayout() {
  const { pathname } = useLocation()
  // The booking form has its own fixed Save bar in place of the tabs.
  const hideNav = pathname === '/bookings/new' || pathname.endsWith('/edit')
  return (
    <div className="mx-auto min-h-dvh max-w-xl bg-slate-50">
      <Outlet />
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto grid max-w-xl grid-cols-5">
            {TABS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-indigo-600' : 'text-slate-500'}`
                }
              >
                <Icon />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

export default function App() {
  const { status } = useAuth()
  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (status === 'out') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<CalendarPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="bookings/new" element={<BookingFormPage />} />
        <Route path="bookings/:id" element={<BookingDetailPage />} />
        <Route path="bookings/:id/edit" element={<BookingFormPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
