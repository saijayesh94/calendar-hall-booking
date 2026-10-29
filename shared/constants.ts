export const EVENT_TYPES = [
  'Marriage',
  'Reception',
  'Engagement',
  'Naming Ceremony',
  'Cradle Ceremony',
  'Baby Shower',
  'Half Saree Function',
  'Gasti',
  'Birthday',
  'Meeting',
  'College Function',
  'Temple / Religious Function',
] as const

/** Any event type not in EVENT_TYPES is stored as its custom text and shown under "Other". */
export const OTHER_EVENT = 'Other'

export const SPACES = [
  { id: 'main', label: 'Main Hall' },
  { id: 'dining', label: 'Dining Hall' },
  { id: 'rooms', label: 'Rooms' },
] as const
export type SpaceId = (typeof SPACES)[number]['id']
export const SPACE_IDS = SPACES.map((s) => s.id) as [SpaceId, ...SpaceId[]]

/** What the user actually picks; each choice maps to the spaces it occupies (used for clash checks). */
export const SPACE_OPTIONS = [
  { id: 'full', label: 'Full (with rooms)', spaces: ['main', 'dining', 'rooms'] },
  { id: 'halls', label: 'Without rooms', spaces: ['main', 'dining'] },
  { id: 'dining', label: 'Dining hall only', spaces: ['dining'] },
  { id: 'rooms', label: 'Rooms only', spaces: ['rooms'] },
] as const satisfies readonly { id: string; label: string; spaces: readonly SpaceId[] }[]
export type SpaceOptionId = (typeof SPACE_OPTIONS)[number]['id']
export const SPACE_OPTION_IDS = SPACE_OPTIONS.map((o) => o.id) as [SpaceOptionId, ...SpaceOptionId[]]

/** Keep in sync with SPACE_OPTION_SQL in worker/lib/bookings.ts. */
export function spaceOptionFor(spaces: readonly string[]): SpaceOptionId {
  const has = (s: SpaceId) => spaces.includes(s)
  if (has('rooms') && (has('main') || has('dining'))) return 'full'
  if (has('main')) return 'halls'
  if (has('dining')) return 'dining'
  return 'rooms'
}
export const spaceOptionLabel = (id: string) => SPACE_OPTIONS.find((o) => o.id === id)?.label ?? id
export const spacesLabel = (spaces: readonly string[]) => spaceOptionLabel(spaceOptionFor(spaces))

export const SLOTS = [
  { id: 'full', label: 'Full day' },
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'time', label: 'Exact time' },
] as const
export type SlotId = (typeof SLOTS)[number]['id']
export const SLOT_IDS = SLOTS.map((s) => s.id) as [SlotId, ...SlotId[]]

export const spaceLabel = (id: string) => SPACES.find((s) => s.id === id)?.label ?? id
export const slotLabel = (id: string) => SLOTS.find((s) => s.id === id)?.label ?? id
