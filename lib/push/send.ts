import webpush from 'web-push';
import { logger } from '@/lib/logger';
import { getSubscriptions, removeSubscription } from './subscription-store';
import type { PushNotificationPayload } from './types';

let vapidConfigured = false;

function ensureVapid(): void {
  if (vapidConfigured) return;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL;

  if (!publicKey || !privateKey || !email) {
    throw new Error('VAPID keys not configured. Run: node scripts/generate-vapid-keys.mjs');
  }

  webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);
  vapidConfigured = true;
}

export async function sendPushToUser(
  username: string,
  payload: PushNotificationPayload
): Promise<void> {
  ensureVapid();

  const subscriptions = await getSubscriptions(username);
  if (subscriptions.length === 0) {
    logger.debug(`No push subscriptions for ${username}`);
    return;
  }

  const payloadStr = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map(({ subscription }) =>
      webpush.sendNotification(subscription, payloadStr)
    )
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'rejected') {
      const statusCode = (result.reason as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await removeSubscription(username, subscriptions[i].subscription.endpoint);
        logger.info(`Removed expired push subscription for ${username}`);
      } else {
        logger.warn(`Push send failed for ${username}: ${result.reason}`);
      }
    }
  }

  logger.info(`Push sent to ${username} (${subscriptions.length} endpoints)`);
}
