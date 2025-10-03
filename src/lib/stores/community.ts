import { writable, get } from 'svelte/store'
import { browser } from '$app/environment'
import type { CommunityType, GeographicCommunity, CommunityState } from '$lib/types'
import {
  getCurrentLocation,
  getLocationPermission,
  isWithinGeofence,
  type Coordinates,
  type LocationPermission
} from '$lib/services/geolocation'
import { getGeofence, requiresGeofence } from '$lib/config/communities'

const STORAGE_KEY = 'yipyap_selected_community'
const POST_COMMUNITY_STORAGE_KEY = 'yipyap_post_community'
const LOCATION_PERMISSION_STORAGE_KEY = 'yipyap_location_permission'
const DEFAULT_COMMUNITY: CommunityType = 'nyc'
const DEFAULT_POST_COMMUNITY: GeographicCommunity = 'nyc'

/**
 * Get initial community filter from localStorage or default
 */
function getInitialCommunity(): CommunityType {
  if (!browser) return DEFAULT_COMMUNITY

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const validTypes: CommunityType[] = ['nyc', 'blue', 'orange', 'yellow', 'red', 'green', 'purple', 'turquoise', 'lime', 'gray', 'brown']
    if (stored && validTypes.includes(stored as CommunityType)) {
      return stored as CommunityType
    }
  } catch (error) {
    console.warn('Failed to load community from localStorage:', error)
  }

  return DEFAULT_COMMUNITY
}

/**
 * Get initial post community from localStorage or default
 */
function getInitialPostCommunity(): GeographicCommunity {
  if (!browser) return DEFAULT_POST_COMMUNITY

  try {
    const stored = localStorage.getItem(POST_COMMUNITY_STORAGE_KEY)
    if (stored && (stored === 'nyc' || stored === 'dimes_square')) {
      return stored as GeographicCommunity
    }
  } catch (error) {
    console.warn('Failed to load post community from localStorage:', error)
  }

  return DEFAULT_POST_COMMUNITY
}

/**
 * Get initial location permission from localStorage
 */
function getInitialLocationPermission(): LocationPermission | null {
  if (!browser) return null

  try {
    const stored = localStorage.getItem(LOCATION_PERMISSION_STORAGE_KEY)
    if (stored && ['granted', 'denied', 'prompt'].includes(stored)) {
      return stored as LocationPermission
    }
  } catch (error) {
    console.warn('Failed to load location permission from localStorage:', error)
  }

  return null
}

/**
 * Save location permission to localStorage
 */
function saveLocationPermission(permission: LocationPermission): void {
  if (!browser) return

  try {
    localStorage.setItem(LOCATION_PERMISSION_STORAGE_KEY, permission)
  } catch (error) {
    console.warn('Failed to save location permission to localStorage:', error)
  }
}

/**
 * Save community filter to localStorage
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
 * Save post community to localStorage
 */
function savePostCommunity(community: GeographicCommunity): void {
  if (!browser) return

  try {
    localStorage.setItem(POST_COMMUNITY_STORAGE_KEY, community)
  } catch (error) {
    console.warn('Failed to save post community to localStorage:', error)
  }
}

/**
 * Create community store with location tracking
 */
function createCommunityStore() {
  const { subscribe, set, update } = writable<CommunityState>({
    selectedCommunity: getInitialCommunity(),
    selectedPostCommunity: getInitialPostCommunity(),
    isPickerOpen: false,
    userLocation: null,
    locationPermission: getInitialLocationPermission(),
    isCheckingLocation: false
  })

  return {
    subscribe,

    /**
     * Select a community filter (for viewing feed)
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
     * Select a post community (for posting destination)
     */
    setPostCommunity: (community: GeographicCommunity) => {
      update(state => {
        savePostCommunity(community)
        return {
          ...state,
          selectedPostCommunity: community
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
     * Check and update current location
     */
    checkLocation: async (): Promise<Coordinates | null> => {
      update(state => ({ ...state, isCheckingLocation: true }))

      try {
        const permission = await getLocationPermission()
        const location = await getCurrentLocation()

        saveLocationPermission(permission)
        update(state => ({
          ...state,
          userLocation: location,
          locationPermission: permission,
          isCheckingLocation: false
        }))

        return location
      } catch (error: any) {
        // Distinguish between actual permission denial vs other errors
        const isDenied = error?.message?.includes('permission denied') ||
                         error?.message?.includes('Permission denied')

        const permissionState = isDenied ? 'denied' : 'prompt'
        saveLocationPermission(permissionState)

        update(state => ({
          ...state,
          userLocation: null,
          locationPermission: permissionState,
          isCheckingLocation: false
        }))
        return null
      }
    },

    /**
     * Check if user can post in a specific geographic community
     * Returns true if no geofence required or user is within geofence
     */
    canPostInCommunity: async (communityId: GeographicCommunity): Promise<{
      canPost: boolean
      reason?: string
      distance?: number
    }> => {
      // No geofence required
      if (!requiresGeofence(communityId)) {
        return { canPost: true }
      }

      const geofence = getGeofence(communityId)
      if (!geofence) {
        return { canPost: true }
      }

      // Try to get current location from state first
      await communityStore.checkLocation()
      const state = get({ subscribe })

      if (!state.userLocation) {
        if (state.locationPermission === 'denied') {
          return {
            canPost: false,
            reason: 'Location permission denied. Please enable it in your browser settings and try again.'
          }
        }
        return {
          canPost: false,
          reason: 'Could not get your location. Please enable location services.'
        }
      }

      // Check geofence
      const isInside = isWithinGeofence(state.userLocation.lat, state.userLocation.lon, geofence)

      if (!isInside) {
        return {
          canPost: false,
          reason: 'You must be in Dimes Square to post here.'
        }
      }

      return { canPost: true }
    },

    /**
     * Retry getting location, e.g. after user changes permissions
     * Clears cached permission state to force fresh check
     */
    retryLocation: async () => {
      // Clear cached permission to allow fresh permission prompt
      if (browser) {
        try {
          localStorage.removeItem(LOCATION_PERMISSION_STORAGE_KEY)
        } catch (error) {
          console.warn('Failed to clear location permission cache:', error)
        }
      }

      update(state => ({
        ...state,
        locationPermission: null
      }))

      await communityStore.checkLocation()
    },

    /**
     * Update location permission state
     */
    setLocationPermission: (permission: LocationPermission) => {
      saveLocationPermission(permission)
      update(state => ({
        ...state,
        locationPermission: permission
      }))
    },

    /**
     * Reset to default communities
     */
    reset: () => {
      set({
        selectedCommunity: DEFAULT_COMMUNITY,
        selectedPostCommunity: DEFAULT_POST_COMMUNITY,
        isPickerOpen: false,
        userLocation: null,
        locationPermission: null,
        isCheckingLocation: false
      })
      saveCommunity(DEFAULT_COMMUNITY)
      savePostCommunity(DEFAULT_POST_COMMUNITY)
    }
  }
}

// Create singleton instance
export const communityStore = createCommunityStore()
