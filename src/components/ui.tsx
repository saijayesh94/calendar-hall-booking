import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { BackIcon } from './icons'

export const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100'

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white active:bg-indigo-700 disabled:opacity-50'
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-50'
export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700 active:bg-red-100 disabled:opacity-50'

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  )
}

export function PageHeader({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
      {back ? (
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="rounded-full p-2 text-slate-700 active:bg-slate-100"
          aria-label="Back"
        >
          <BackIcon />
        </button>
      ) : (
        <span className="w-2" />
      )}
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-slate-900">{title}</h1>
      {right}
    </header>
  )
}

export const Spinner = () => (
  <div className="flex justify-center py-10" role="status" aria-label="Loading">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
  </div>
)

export const ErrorBox = ({ error }: { error: unknown }) => (
  <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
    {error instanceof Error ? error.message : 'Something went wrong'}
  </div>
)

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="px-4 py-10 text-center text-slate-500">{children}</p>
)

/** Bottom sheet that slides over the page; tap the backdrop to close. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-slate-900/40" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 mb-1 h-1.5 w-10 rounded-full bg-slate-300" />
        {children}
      </div>
    </div>
  )
}

// ---- Toasts and confirm dialog (one provider for both) ----

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}

interface UiContextValue {
  toast: (message: string) => void
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const UiContext = createContext<UiContextValue | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)

  const toast = useCallback((message: string) => {
    setToastMsg(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2500)
  }, [])

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })),
    [],
  )

  const close = (ok: boolean) => {
    dialog?.resolve(ok)
    setDialog(null)
  }

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      {toastMsg && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toastMsg}</div>
        </div>
      )}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6" onClick={() => close(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900">{dialog.title}</h2>
            {dialog.message && <p className="mt-2 text-slate-600">{dialog.message}</p>}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button className={btnSecondary} onClick={() => close(false)}>
                Cancel
              </button>
              <button className={dialog.danger ? btnDanger : btnPrimary} onClick={() => close(true)}>
                {dialog.confirmLabel ?? 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  )
}

export function useUi() {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi must be used inside UiProvider')
  return ctx
}
