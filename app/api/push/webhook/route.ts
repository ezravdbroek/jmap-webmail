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

const NEW_MAIL_EVENTS = new Set([
  'message-ingest.ham',
  'message-ingest.spam',
  'message-ingest.imap-append',
  'message-ingest.jmap-append',
]);

interface JmapEmail {
  from?: { name?: string; email: string }[];
  subject?: string;
  preview?: string;
}

async function fetchLatestEmail(username: string): Promise<JmapEmail | null> {
  const internalUrl = process.env.JMAP_INTERNAL_URL || process.env.JMAP_SERVER_URL;
  const adminUser = process.env.JMAP_ADMIN_USER;
  const adminPassword = process.env.JMAP_ADMIN_PASSWORD;

  if (!internalUrl || !adminUser || !adminPassword) return null;

  const adminAuth = 'Basic ' + Buffer.from(`${adminUser}:${adminPassword}`).toString('base64');

  try {
    // Step 1: Get the user's credentials via Stalwart admin API
    const principalRes = await fetch(`${internalUrl}/api/principal?filter=${encodeURIComponent(username)}`, {
      headers: { 'Authorization': adminAuth },
    });
    if (!principalRes.ok) return null;

    const principalData = await principalRes.json();
    const user = principalData?.data?.items?.[0];
    if (!user?.secrets?.[0]) return null;

    // Step 2: Log in as the user to get their JMAP session
    const userAuth = 'Basic ' + Buffer.from(`${username}:${user.secrets[0]}`).toString('base64');

    const sessionRes = await fetch(`${internalUrl}/.well-known/jmap`, {
      headers: { 'Authorization': userAuth },
    });
    if (!sessionRes.ok) return null;

    const session = await sessionRes.json();
    const apiUrl = session.apiUrl?.replace(/https?:\/\/[^/]+/, internalUrl);
    const accountId = Object.keys(session.accounts || {})[0];

    if (!apiUrl || !accountId) return null;

    // Step 3: Fetch the latest email
    const jmapRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': userAuth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        methodCalls: [
          ['Email/query', {
            accountId,
            sort: [{ property: 'receivedAt', isAscending: false }],
            limit: 1,
          }, '0'],
          ['Email/get', {
            accountId,
            '#ids': { resultOf: '0', name: 'Email/query', path: '/ids' },
            properties: ['from', 'subject', 'preview'],
          }, '1'],
        ],
      }),
    });

    if (!jmapRes.ok) return null;
    const jmapData = await jmapRes.json();

    const emailGetResponse = jmapData.methodResponses?.find(
      (r: [string]) => r[0] === 'Email/get'
    );
    const emails = emailGetResponse?.[1]?.list;
    if (emails && emails.length > 0) {
      return emails[0] as JmapEmail;
    }

    return null;
  } catch (err) {
    logger.debug(`Failed to fetch latest email for ${username}: ${err}`);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.PUSH_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = request.headers.get('authorization') || '';
      // Accept: Bearer <secret>, Basic <base64>, or raw secret
      const isBearer = authHeader === `Bearer ${webhookSecret}`;
      const isRaw = authHeader === webhookSecret;
      // Stalwart sends Basic auth with username + secret
      const isBasic = authHeader.startsWith('Basic ') && (() => {
        try {
          const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
          return decoded.includes(webhookSecret);
        } catch { return false; }
      })();
      if (!isBearer && !isRaw && !isBasic) {
        logger.warn(`Webhook auth failed. Header: "${authHeader.substring(0, 50)}"`);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = (await request.json()) as StalwartWebhookBody;
    const events = body.events;
    if (!events || !Array.isArray(events)) {
      logger.warn('Webhook received with no events array');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    let notificationsSent = 0;

    for (const event of events) {
      if (!NEW_MAIL_EVENTS.has(event.type)) continue;

      const username = event.data?.accountId as string | undefined;
      if (!username) {
        logger.debug(`Skipping event ${event.type}: no accountId`);
        continue;
      }

      const email = await fetchLatestEmail(username);

      const fromName = email?.from?.[0]?.name || email?.from?.[0]?.email;
      const subject = email?.subject;
      const preview = email?.preview?.slice(0, 100);

      const payload: PushNotificationPayload = {
        title: fromName || 'Nieuw bericht',
        body: subject
          ? (preview ? `${subject}\n${preview}` : subject)
          : 'Je hebt een nieuw e-mailbericht ontvangen',
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
