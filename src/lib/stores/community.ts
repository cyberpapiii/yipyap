import { writable, get } from 'svelte/store'
import { browser } from '$app/environment'
import type { CommunityType, CommunityState } from '$lib/types'

const STORAGE_KEY = 'yipyap_selected_community'
const DEFAULT_COMMUNITY: CommunityType = 'nyc'

/**
 * Get initial community from localStorage or default
 */
function getInitialCommunity(): CommunityType {
  if (!browser) return DEFAULT_COMMUNITY

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return stored as CommunityType
    }
  } catch (error) {
    console.warn('Failed to load community from localStorage:', error)
  }

  return DEFAULT_COMMUNITY
}

/**
 * Save community to localStorage
 */
function saveCommunity(community: CommunityType): void {
  if (!browser) return

  try {
    localStorage.setItem(STORAGE_KEY, community)
  } catch (error) {
    console.warn('Failed to save community to localStorage:', error)
  }
}

/**
 * Create community store
 */
function createCommunityStore() {
  const { subscribe, set, update } = writable<CommunityState>({
    selectedCommunity: getInitialCommunity(),
    isPickerOpen: false
  })

  return {
    subscribe,

    /**
     * Select a community and persist to localStorage
     */
    selectCommunity: (community: CommunityType) => {
      update(state => {
        saveCommunity(community)
        return {
          ...state,
          selectedCommunity: community,
          isPickerOpen: false
        }
      })
    },

    /**
     * Open the community picker modal
     */
    openPicker: () => {
      update(state => ({
        ...state,
        isPickerOpen: true
      }))
    },

    /**
     * Close the community picker modal
     */
    closePicker: () => {
      update(state => ({
        ...state,
        isPickerOpen: false
      }))
    },

    /**
     * Get current selected community
     */
    getSelectedCommunity: (): CommunityType => {
      return get({ subscribe }).selectedCommunity
    },

    /**
     * Reset to default community
     */
    reset: () => {
      set({
        selectedCommunity: DEFAULT_COMMUNITY,
        isPickerOpen: false
      })
      saveCommunity(DEFAULT_COMMUNITY)
    }
  }
}

// Create singleton instance
export const communityStore = createCommunityStore()
