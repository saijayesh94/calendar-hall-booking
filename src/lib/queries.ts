import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AnalyticsDetail,
  AnalyticsSummary,
  Booking,
  BookingFields,
  HistoryEntry,
} from '../../shared/types'
import { api } from './api'

export interface BookingFilters {
  from?: string
  to?: string
  q?: string
  type?: string
  space?: string
  scope?: 'upcoming' | 'past' | 'all'
  today?: string
  limit?: number
}

export const useBookings = (filters: BookingFilters) =>
  useQuery({
    queryKey: ['bookings', 'list', filters],
    queryFn: () => api<Booking[]>('/bookings', { query: { ...filters } }),
    placeholderData: keepPreviousData,
  })

export const useBooking = (id: string | undefined) =>
  useQuery({
    queryKey: ['bookings', 'one', id],
    queryFn: () => api<Booking>(`/bookings/${id}`),
    enabled: !!id,
  })

export const useOverlaps = (q: { start: string; end: string; spaces: string[]; exclude?: string }) =>
  useQuery({
    queryKey: ['bookings', 'overlaps', q],
    queryFn: () =>
      api<Booking[]>('/bookings/overlaps', {
        query: { start: q.start, end: q.end, spaces: q.spaces.join(','), exclude: q.exclude },
      }),
    enabled: !!q.start && !!q.end && q.end >= q.start && q.spaces.length > 0,
  })

export const useBookingHistory = (id: string | undefined) =>
  useQuery({
    queryKey: ['history', 'booking', id],
    queryFn: () => api<HistoryEntry[]>(`/bookings/${id}/history`),
    enabled: !!id,
  })

export const useAllHistory = () =>
  useQuery({ queryKey: ['history', 'all'], queryFn: () => api<HistoryEntry[]>('/history') })

export const useTrash = () => useQuery({ queryKey: ['trash'], queryFn: () => api<Booking[]>('/trash') })

export const useAnalyticsSummary = (today: string) =>
  useQuery({
    queryKey: ['analytics', 'summary', today],
    queryFn: () => api<AnalyticsSummary>('/analytics/summary', { query: { today } }),
  })

export const useAnalytics = (from: string, to: string) =>
  useQuery({
    queryKey: ['analytics', 'detail', from, to],
    queryFn: () => api<AnalyticsDetail>('/analytics', { query: { from, to } }),
    enabled: !!from && !!to && to >= from,
    placeholderData: keepPreviousData,
  })

/** Any booking change can affect every list, the analytics and the history. */
function useInvalidateAll() {
  const qc = useQueryClient()
  return () =>
    Promise.all(['bookings', 'history', 'trash', 'analytics'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
}

export function useSaveBooking() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: BookingFields }) =>
      id
        ? api<Booking>(`/bookings/${id}`, { method: 'PUT', body: data })
        : api<Booking>('/bookings', { method: 'POST', body: data }),
    onSuccess: invalidate,
  })
}

export function useDeleteBooking() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (id: string) => api<Booking>(`/bookings/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useRestoreFromTrash() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (id: string) => api<Booking>(`/trash/${id}/restore`, { method: 'POST' }),
    onSuccess: invalidate,
  })
}

export function useRestoreVersion() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ bookingId, historyId }: { bookingId: string; historyId: number }) =>
      api<Booking>(`/bookings/${bookingId}/restore/${historyId}`, { method: 'POST' }),
    onSuccess: invalidate,
  })
}
