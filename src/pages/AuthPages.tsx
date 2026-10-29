import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CalendarIcon } from '../components/icons'
import { Field, btnPrimary, inputCls } from '../components/ui'
import { useAuth } from '../lib/auth'

function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <CalendarIcon width={30} height={30} />
          </span>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        </div>
        {children}
        <p className="mt-6 text-center text-slate-600">{footer}</p>
      </div>
    </div>
  )
}

function useSubmit() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<void>) => {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setBusy(false)
    }
  }
  return { error, setError, busy, run }
}

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { error, busy, run } = useSubmit()

  return (
    <AuthShell title="Hall Bookings" footer={<>New here? <Link to="/signup" className="font-semibold text-indigo-600">Create an account</Link></>}>
      <form onSubmit={(e) => (e.preventDefault(), run(() => login(email, password)))} className="space-y-4">
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button className={`${btnPrimary} w-full`} disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </AuthShell>
  )
}

export function SignupPage() {
  const { signup } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const { error, setError, busy, run } = useSubmit()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) return setError('Password must be at least 8 characters')
    if (form.password !== form.confirm) return setError('Passwords do not match')
    run(() => signup(form.name, form.email, form.password))
  }

  return (
    <AuthShell title="Create account" footer={<>Already have an account? <Link to="/login" className="font-semibold text-indigo-600">Log in</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Your name">
          <input className={inputCls} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Password (min 8 characters)">
          <input className={inputCls} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
        <Field label="Confirm password">
          <input className={inputCls} type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
        </Field>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button className={`${btnPrimary} w-full`} disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}
