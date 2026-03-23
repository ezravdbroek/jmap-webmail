"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useConfig } from '@/hooks/use-config';
import { debug } from '@/lib/debug';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PermissionState = 'default' | 'denied' | 'granted' | 'unsupported';

export interface PushNotificationState {
  isSupported: boolean;
  permission: PermissionState;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
}

export function usePushNotifications(): PushNotificationState {
  const { username } = useAuthStore();
  const { vapidPublicKey } = useConfig();
  const [permission, setPermission] = useState<PermissionState>('unsupported');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  // Register service worker and check current subscription
  useEffect(() => {
    if (!isSupported) return;

    setPermission(Notification.permission);

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registrationRef.current = registration;
        debug.log('Service Worker registered');

        return registration.pushManager.getSubscription();
      })
      .then((subscription) => {
        setIsSubscribed(!!subscription);
      })
      .catch((err) => {
        debug.error('Service Worker registration failed:', err);
      });
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !vapidPublicKey || !username) return false;

    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        debug.log('Notification permission denied');
        return false;
      }

      const registration = registrationRef.current || await navigator.serviceWorker.ready;
      registrationRef.current = registration;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as ArrayBuffer,
      });

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          subscription: subscription.toJSON(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription on server');
      }

      setIsSubscribed(true);
      debug.log('Push subscription created');
      return true;
    } catch (err) {
      debug.error('Push subscribe failed:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, vapidPublicKey, username]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported || !username) return;

    setIsLoading(true);
    try {
      const registration = registrationRef.current || await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            endpoint: subscription.endpoint,
          }),
        });
      }

      setIsSubscribed(false);
      debug.log('Push subscription removed');
    } catch (err) {
      debug.error('Push unsubscribe failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, username]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
