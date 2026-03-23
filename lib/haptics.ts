/**
 * Haptic feedback for native-feeling interactions
 * Uses the Vibration API (Android Chrome) and falls back silently
 */

export function hapticLight(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(5);
  }
}

export function hapticMedium(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(10);
  }
}

export function hapticHeavy(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([15, 30, 15]);
  }
}

export function hapticSuccess(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([10, 50, 10]);
  }
}

export function hapticError(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([30, 50, 30, 50, 30]);
  }
}
