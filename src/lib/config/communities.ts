import type { SubwayLine } from '$lib/types'

/**
 * Community Types
 * NYC represents all communities, others are grouped by MTA color
 */
export type CommunityType =
  | 'nyc'      // All communities
  | 'blue'     // A, C, E lines
  | 'orange'   // B, D, F, M lines
  | 'yellow'   // N, Q, R, W lines
  | 'red'      // 1, 2, 3 lines
  | 'green'    // 4, 5, 6 lines
  | 'purple'   // 7 line
  | 'turquoise' // T line (SIR)
  | 'lime'     // G line
  | 'gray'     // L line
  | 'brown'    // J, Z lines

/**
 * Community Interface
 */
export interface Community {
  id: CommunityType
  name: string
  emoji: string
  subwayLines: SubwayLine[]
  description: string
}

/**
 * All 11 communities with NYC subway line groupings
 */
export const COMMUNITIES: Record<CommunityType, Community> = {
  nyc: {
    id: 'nyc',
    name: 'NYC',
    emoji: '🗽',
    subwayLines: [],
    description: 'All communities'
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    emoji: '🔵',
    subwayLines: ['A', 'C', 'E'],
    description: 'A, C, E Lines'
  },
  orange: {
    id: 'orange',
    name: 'Orange',
    emoji: '🟠',
    subwayLines: ['B', 'D', 'F', 'M'],
    description: 'B, D, F, M Lines'
  },
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    emoji: '🟡',
    subwayLines: ['N', 'Q', 'R', 'W'],
    description: 'N, Q, R, W Lines'
  },
  red: {
    id: 'red',
    name: 'Red',
    emoji: '🔴',
    subwayLines: ['1', '2', '3'],
    description: '1, 2, 3 Lines'
  },
  green: {
    id: 'green',
    name: 'Green',
    emoji: '🟢',
    subwayLines: ['4', '5', '6'],
    description: '4, 5, 6 Lines'
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    emoji: '🟣',
    subwayLines: ['7'],
    description: '7 Line'
  },
  turquoise: {
    id: 'turquoise',
    name: 'Turquoise',
    emoji: '🔷',
    subwayLines: ['T'],
    description: 'T Line (SIR)'
  },
  lime: {
    id: 'lime',
    name: 'Lime',
    emoji: '🟩',
    subwayLines: ['G'],
    description: 'G Line'
  },
  gray: {
    id: 'gray',
    name: 'Gray',
    emoji: '⚪',
    subwayLines: ['L'],
    description: 'L Line'
  },
  brown: {
    id: 'brown',
    name: 'Brown',
    emoji: '🟤',
    subwayLines: ['J', 'Z'],
    description: 'J, Z Lines'
  }
}

/**
 * Get all communities as an array
 */
export function getAllCommunities(): Community[] {
  return Object.values(COMMUNITIES)
}

/**
 * Get a specific community by ID
 */
export function getCommunity(id: CommunityType): Community {
  return COMMUNITIES[id]
}

/**
 * Get subway lines for a community
 */
export function getSubwayLinesForCommunity(id: CommunityType): SubwayLine[] {
  return COMMUNITIES[id].subwayLines
}

/**
 * Get community for a subway line
 */
export function getCommunityForSubwayLine(line: SubwayLine): Community | null {
  for (const community of Object.values(COMMUNITIES)) {
    if (community.subwayLines.includes(line)) {
      return community
    }
  }
  return null
}

/**
 * Check if a subway line belongs to a community
 */
export function isLineInCommunity(line: SubwayLine, communityId: CommunityType): boolean {
  if (communityId === 'nyc') return true
  return COMMUNITIES[communityId].subwayLines.includes(line)
}
