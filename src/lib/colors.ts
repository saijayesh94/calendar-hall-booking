import { spaceOptionFor, type SpaceOptionId } from '../../shared/constants'

// Categorical slots 1–4, validated for colour-blind separation. Every use also shows a text label.
export const SPACE_COLORS: Record<SpaceOptionId, string> = {
  full: '#2a78d6',
  halls: '#eb6834',
  dining: '#1baf7a',
  rooms: '#eda100',
}

export const bookingColor = (spaces: readonly string[]) => SPACE_COLORS[spaceOptionFor(spaces)]
