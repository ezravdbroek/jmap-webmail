/**
 * App badge count management
 * Updates the PWA badge on the app icon with unread count
 */

export function updateBadgeCount(count: number): void {
  // Method 1: Direct Badge API (Chrome, Edge)
  if ('setAppBadge' in navigator) {
    if (count > 0) {
      (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count);
    } else {
      (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
    }
  }

  // Method 2: Via service worker (for broader support)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SET_BADGE',
      count,
    });
  }
}
