import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sendPushToUser } from '@/lib/push/send';
import type { PushNotificationPayload } from '@/lib/push/types';

interface StalwartEvent {
  id: string;
  createdAt: string;
  type: string;
  data: Record<string, string | number | undefined>;
}

interface StalwartWebhookBody {
  events?: StalwartEvent[];
}

// Event types that indicate new mail delivery
const NEW_MAIL_EVENTS = new Set([
  'message-ingest.ham',
  'message-ingest.spam',
  'message-ingest.imap-append',
  'message-ingest.jmap-append',
]);

export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret via Authorization header or Signature Key
    const webhookSecret = process.env.PUSH_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${webhookSecret}` && authHeader !== webhookSecret) {
        logger.warn('Webhook request with invalid secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = (await request.json()) as StalwartWebhookBody;

    // Stalwart sends { events: [...] }
    const events = body.events;
    if (!events || !Array.isArray(events)) {
      logger.warn('Webhook received with no events array');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    let notificationsSent = 0;

    for (const event of events) {
      // Only process new mail delivery events
      if (!NEW_MAIL_EVENTS.has(event.type)) {
        continue;
      }

      // accountId in Stalwart is typically the email address
      const username = event.data?.accountId as string | undefined;
      if (!username) {
        logger.debug(`Skipping event ${event.type}: no accountId`);
        continue;
      }

      const payload: PushNotificationPayload = {
        title: 'Nieuw bericht',
        body: 'Je hebt een nieuw e-mailbericht ontvangen',
        url: '/',
        emailId: event.data?.messageId as string | undefined,
        timestamp: Date.now(),
      };

      await sendPushToUser(username, payload);
      notificationsSent++;
      logger.info(`Push notification sent for ${username} (${event.type})`);
    }

    return NextResponse.json({ ok: true, notificationsSent });
  } catch (error) {
    logger.error('Webhook processing error', error as Record<string, unknown>);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
