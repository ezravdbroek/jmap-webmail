"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSettingsStore } from '@/stores/settings-store';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { SettingsSection, SettingItem, Select, ToggleSwitch } from './settings-section';
import { TrustedSendersModal } from '@/components/trusted-senders-modal';
import { Button } from '@/components/ui/button';
import { ChevronRight, Bell, BellOff } from 'lucide-react';

export function EmailSettings() {
  const t = useTranslations('settings.email_behavior');
  const [showTrustedModal, setShowTrustedModal] = useState(false);

  const {
    markAsReadDelay,
    deleteAction,
    showPreview,
    emailsPerPage,
    externalContentPolicy,
    trustedSenders,
    updateSetting,
  } = useSettingsStore();

  // Get count label for trusted senders button
  const getTrustedSendersCount = () => {
    const count = trustedSenders.length;
    if (count === 0) return t('trusted_senders.count_zero');
    if (count === 1) return t('trusted_senders.count_one');
    return t('trusted_senders.count_other', { count });
  };

  return (
    <>
    <SettingsSection title={t('title')} description={t('description')}>
      {/* Mark as Read */}
      <SettingItem label={t('mark_read.label')} description={t('mark_read.description')}>
        <Select
          value={markAsReadDelay.toString()}
          onChange={(value) => updateSetting('markAsReadDelay', parseInt(value))}
          options={[
            { value: '0', label: t('mark_read.instant') },
            { value: '3000', label: t('mark_read.delay_3s') },
            { value: '5000', label: t('mark_read.delay_5s') },
            { value: '-1', label: t('mark_read.never') },
          ]}
        />
      </SettingItem>

      {/* Delete Action */}
      <SettingItem label={t('delete_action.label')} description={t('delete_action.description')}>
        <Select
          value={deleteAction}
          onChange={(value) => updateSetting('deleteAction', value as 'trash' | 'permanent')}
          options={[
            { value: 'trash', label: t('delete_action.trash') },
            { value: 'permanent', label: t('delete_action.permanent') },
          ]}
        />
      </SettingItem>

      {/* Show Preview */}
      <SettingItem label={t('show_preview.label')} description={t('show_preview.description')}>
        <ToggleSwitch checked={showPreview} onChange={(checked) => updateSetting('showPreview', checked)} />
      </SettingItem>

      {/* Emails Per Page */}
      <SettingItem label={t('emails_per_page.label')} description={t('emails_per_page.description')}>
        <Select
          value={emailsPerPage.toString()}
          onChange={(value) => updateSetting('emailsPerPage', parseInt(value))}
          options={[
            { value: '25', label: t('emails_per_page.25') },
            { value: '50', label: t('emails_per_page.50') },
            { value: '100', label: t('emails_per_page.100') },
          ]}
        />
      </SettingItem>

      {/* External Content */}
      <SettingItem label={t('external_content.label')} description={t('external_content.description')}>
        <Select
          value={externalContentPolicy}
          onChange={(value) =>
            updateSetting('externalContentPolicy', value as 'ask' | 'block' | 'allow')
          }
          options={[
            { value: 'ask', label: t('external_content.ask') },
            { value: 'block', label: t('external_content.block') },
            { value: 'allow', label: t('external_content.allow') },
          ]}
        />
      </SettingItem>

      {/* Trusted Senders */}
      <SettingItem label={t('trusted_senders.label')} description={t('trusted_senders.description')}>
        <button
          onClick={() => setShowTrustedModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-accent rounded-md transition-colors"
        >
          <span className="text-sm text-foreground">{getTrustedSendersCount()}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </SettingItem>

      {/* Trusted Senders Modal */}
      <TrustedSendersModal
        isOpen={showTrustedModal}
        onClose={() => setShowTrustedModal(false)}
      />
    </SettingsSection>

    <PushNotificationSettings />
    </>
  );
}

function PushNotificationSettings() {
  const t = useTranslations('push_notifications');
  const { pushNotificationsEnabled, updateSetting } = useSettingsStore();
  const { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  const handleToggle = async (enabled: boolean) => {
    updateSetting('pushNotificationsEnabled', enabled);
    if (enabled && !isSubscribed && permission !== 'denied') {
      await subscribe();
    } else if (!enabled && isSubscribed) {
      await unsubscribe();
    }
  };

  const handleResubscribe = async () => {
    localStorage.removeItem('push-prompt-dismissed');
    await subscribe();
  };

  const getStatusText = () => {
    if (!isSupported) return t('not_supported');
    if (permission === 'denied') return t('permission_denied');
    if (isSubscribed) return t('subscribed');
    return t('unsubscribed');
  };

  return (
    <SettingsSection title={t('settings_title')} description={t('settings_description')}>
      <SettingItem label={t('enable_title')} description={getStatusText()}>
        <ToggleSwitch
          checked={pushNotificationsEnabled && isSubscribed}
          onChange={handleToggle}
          disabled={!isSupported || permission === 'denied'}
        />
      </SettingItem>

      {isSupported && !isSubscribed && permission !== 'denied' && (
        <SettingItem label={t('resubscribe_label')} description={t('resubscribe_description')}>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResubscribe}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Bell className="w-4 h-4" />
            {t('enable_button')}
          </Button>
        </SettingItem>
      )}

      {permission === 'denied' && (
        <SettingItem label={t('blocked_label')} description={t('blocked_description')}>
          <BellOff className="w-5 h-5 text-muted-foreground" />
        </SettingItem>
      )}
    </SettingsSection>
  );
}
