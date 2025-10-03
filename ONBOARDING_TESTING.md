# YipYap Onboarding Testing Guide

## How to Test Different Scenarios

### Scenario 1: First-time Browser User (Android/Chrome)
**Expected: Install Gate with "Install YipYap" button**

1. Clear localStorage: `localStorage.clear()`
2. Open in Chrome DevTools → Application → Storage → Clear site data
3. Reload page in browser (NOT PWA mode)
4. Should see: Full-screen install gate with install button
5. Click "Install YipYap" → Native install prompt appears
6. After install → App reopens in PWA → Shows Quick Onboarding (2 steps)

### Scenario 2: First-time iOS Safari User
**Expected: Install Gate with manual instructions**

1. Clear localStorage
2. Open in Mobile Safari (not installed)
3. Should see: Full-screen gate with step-by-step iOS install instructions
4. Follow steps to manually install
5. After install → Shows Quick Onboarding (2 steps)

### Scenario 3: Desktop Browser User
**Expected: Install Gate with "Mobile-Only" message**

1. Clear localStorage
2. Open in desktop browser
3. Should see: Full-screen gate with "YipYap is Mobile-Only" message
4. No way to proceed - directs user to visit on mobile
5. App does NOT initialize

### Scenario 4: Already in PWA (First Time)
**Expected: Quick Onboarding only**

1. Clear localStorage in installed PWA
2. Reload PWA
3. Should see: Quick Onboarding (2 steps)
   - Step 1: Identity introduction
   - Step 2: Location permission request
4. After completing → Normal app usage

### Scenario 5: Returning User in PWA
**Expected: No onboarding, normal app**

1. Keep localStorage intact
2. Reload PWA
3. Should see: Normal app (no gates, no onboarding)

## Testing Tools

### Reset Onboarding in Console
```javascript
// Reset quick onboarding
localStorage.removeItem('yipyap_quick_onboarding_completed')

// Clear all YipYap data
localStorage.clear()

// Reload
location.reload()
```

### Check PWA Status in Console
```javascript
// Are we in PWA?
window.matchMedia('(display-mode: standalone)').matches

// iOS standalone?
window.navigator.standalone

// Can install?
// (Check if beforeinstallprompt fired - look in console logs)
```

## What to Verify

### Install Gate
- [ ] Full-screen (blocks all app content)
- [ ] Cannot be dismissed (no X button, no backdrop click)
- [ ] App does NOT initialize while gate is shown
- [ ] Subway badge animations are smooth
- [ ] Install button triggers native prompt (Android/Chrome)
- [ ] iOS shows clear manual instructions
- [ ] Desktop shows blocking message

### Quick Onboarding
- [ ] Shows user's assigned subway line identity
- [ ] Can swipe left/right between steps
- [ ] Progress dots update correctly
- [ ] Location permission actually requests access
- [ ] If location already granted, auto-completes
- [ ] "Skip All" button works
- [ ] Skip/complete marks as completed in localStorage

### Edge Cases
- [ ] Refreshing during install gate keeps it showing
- [ ] Opening PWA after install shows onboarding (not gate)
- [ ] Completing onboarding persists across refreshes
- [ ] Location permission state syncs correctly

## Console Logs to Watch

Look for these log messages:
- `[Onboarding] Not in PWA, showing install gate`
- `[Onboarding] In PWA mode, initializing app`
- `[Onboarding] Starting quick onboarding`
- `[PWA] Install prompt ready`
- `[PWA] User accepted/dismissed the install prompt`
