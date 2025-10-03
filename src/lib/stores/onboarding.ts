import { writable } from 'svelte/store'
import { browser } from '$app/environment'
import type { OnboardingState, InstallGateType } from '$lib/types'

const STORAGE_KEY = 'bingbong_quick_onboarding_completed'

/**
 * Check if user has completed quick onboarding
 */
function hasCompletedOnboarding(): boolean {
  if (!browser) return true // SSR: assume completed

  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch (error) {
    console.warn('Failed to read onboarding status from localStorage:', error)
    return false
  }
}

/**
 * Mark onboarding as completed
 */
function markOnboardingCompleted(): void {
  if (!browser) return

  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch (error) {
    console.warn('Failed to save onboarding status to localStorage:', error)
  }
}

/**
 * Create onboarding store
 */
function createOnboardingStore() {
  const { subscribe, set, update } = writable<OnboardingState>({
    showInstallGate: false,
    installGateType: null,
    isInstalling: false,
    showQuickOnboarding: false,
    currentOnboardingStep: 0
  })

  return {
    subscribe,

    /**
     * Show install gate with specific type
     */
    showGate: (type: InstallGateType) => {
      update(state => ({
        ...state,
        showInstallGate: true,
        installGateType: type
      }))
    },

    /**
     * Hide install gate
     */
    hideGate: () => {
      update(state => ({
        ...state,
        showInstallGate: false,
        installGateType: null,
        isInstalling: false
      }))
    },

    /**
     * Set installing state (while waiting for prompt)
     */
    setInstalling: (installing: boolean) => {
      update(state => ({
        ...state,
        isInstalling: installing
      }))
    },

    /**
     * Show quick onboarding flow
     */
    startQuickOnboarding: () => {
      // Only show if not completed
      if (hasCompletedOnboarding()) {
        return
      }

      update(state => ({
        ...state,
        showQuickOnboarding: true,
        currentOnboardingStep: 0
      }))
    },

    /**
     * Go to next onboarding step
     */
    nextStep: () => {
      update(state => ({
        ...state,
        currentOnboardingStep: state.currentOnboardingStep + 1
      }))
    },

    /**
     * Go to previous onboarding step
     */
    prevStep: () => {
      update(state => ({
        ...state,
        currentOnboardingStep: Math.max(0, state.currentOnboardingStep - 1)
      }))
    },

    /**
     * Complete and close quick onboarding
     */
    completeOnboarding: () => {
      markOnboardingCompleted()
      update(state => ({
        ...state,
        showQuickOnboarding: false,
        currentOnboardingStep: 0
      }))
    },

    /**
     * Skip onboarding (still marks as completed)
     */
    skipOnboarding: () => {
      markOnboardingCompleted()
      update(state => ({
        ...state,
        showQuickOnboarding: false,
        currentOnboardingStep: 0
      }))
    },

    /**
     * Check if onboarding has been completed
     */
    hasCompleted: (): boolean => {
      return hasCompletedOnboarding()
    },

    /**
     * Reset onboarding (for testing)
     */
    reset: () => {
      if (browser) {
        try {
          localStorage.removeItem(STORAGE_KEY)
        } catch (error) {
          console.warn('Failed to reset onboarding:', error)
        }
      }
      set({
        showInstallGate: false,
        installGateType: null,
        isInstalling: false,
        showQuickOnboarding: false,
        currentOnboardingStep: 0
      })
    }
  }
}

export const onboardingStore = createOnboardingStore()
