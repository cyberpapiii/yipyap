import { browser } from '$app/environment'

/**
 * Geofence configuration
 */
export interface Geofence {
  lat: number
  lon: number
  radiusMiles: number
}

/**
 * Location coordinates
 */
export interface Coordinates {
  lat: number
  lon: number
}

/**
 * Location permission states
 */
export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

/**
 * Test mode bypass flag (set via environment variable)
 */
const TEST_MODE = browser && import.meta.env.PUBLIC_GEOFENCE_TEST_MODE === 'true'

// Debug: Log test mode status on module load
if (browser) {
  console.log('[Geofence] Test mode:', TEST_MODE, '| Env var:', import.meta.env.PUBLIC_GEOFENCE_TEST_MODE)
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959 // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Check if coordinates are within a geofence
 */
export function isWithinGeofence(
  userLat: number,
  userLon: number,
  geofence: Geofence
): boolean {
  if (TEST_MODE) {
    console.warn('[Geofence] Test mode enabled - bypassing geofence check')
    return true
  }

  const distance = calculateDistance(userLat, userLon, geofence.lat, geofence.lon)
  return distance <= geofence.radiusMiles
}

/**
 * Get current location permission status
 */
export async function getLocationPermission(): Promise<LocationPermission> {
  if (!browser) return 'unsupported'
  if (!navigator.geolocation) return 'unsupported'

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' })
    return result.state as LocationPermission
  } catch (error) {
    // Permissions API not supported, return 'prompt' as default
    return 'prompt'
  }
}

/**
 * Request location permission and get current coordinates
 * Returns null if permission denied or location unavailable
 */
export async function getCurrentLocation(): Promise<Coordinates | null> {
  if (!browser) return null

  // Check test mode FIRST before touching geolocation API
  if (TEST_MODE) {
    console.warn('[Geofence] Test mode enabled - returning fake location inside Dimes Square')
    // Return coordinates inside Dimes Square for testing
    return { lat: 40.7145, lon: -73.9936 }
  }

  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser')
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        })
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location permission denied'))
            break
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location information unavailable'))
            break
          case error.TIMEOUT:
            reject(new Error('Location request timed out'))
            break
          default:
            reject(new Error('An unknown error occurred'))
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // Cache position for 1 minute
      }
    )
  })
}

/**
 * Check if user is within a specific geofence
 * Combines location fetching and geofence validation
 */
export async function checkGeofence(geofence: Geofence): Promise<{
  isInside: boolean
  distance?: number
  error?: string
}> {
  try {
    const location = await getCurrentLocation()
    if (!location) {
      return { isInside: false, error: 'Could not get location' }
    }

    const distance = calculateDistance(location.lat, location.lon, geofence.lat, geofence.lon)
    const isInside = distance <= geofence.radiusMiles

    return { isInside, distance }
  } catch (error: any) {
    return { isInside: false, error: error.message }
  }
}
