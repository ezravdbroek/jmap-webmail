"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PROMPT_DISMISSED_KEY = 'push-prompt-dismissed';

function PushNotificationPrompt() {
  const t = useTranslations('push_notifications');
  const { isAuthenticated } = useAuthStore();
  const pushNotificationsEnabled = useSettingsStore((s) => s.pushNotificationsEnabled);
  const { isSupported, permission, isSubscribed, isLoading, subscribe } = usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !isSupported ||
      !pushNotificationsEnabled ||
      isSubscribed ||
      permission !== 'default'
    ) {
      setShowPrompt(false);
      return;
    }

    // Check if user previously dismissed
    const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
    if (dismissed) {
      // Re-ask after 7 days
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Delay showing prompt by 3 seconds after login
    const timer = setTimeout(() => setShowPrompt(true), 3000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, isSupported, pushNotificationsEnabled, isSubscribed, permission]);

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY, Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 z-50 max-w-sm w-auto sm:w-full animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-foreground">
              {t('enable_title')}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t('enable_description')}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleEnable}
                disabled={isLoading}
                className="h-8 text-xs"
              >
                {t('enable_button')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="h-8 text-xs text-muted-foreground"
              >
                {t('dismiss_button')}
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PushNotificationPrompt />
    </>
  );
}
