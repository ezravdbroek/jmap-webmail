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

interface JmapEmail {
  from?: { name?: string; email: string }[];
  subject?: string;
  preview?: string;
}

async function fetchLatestEmail(username: string): Promise<JmapEmail | null> {
  const serverUrl = process.env.JMAP_SERVER_URL;
  const adminUser = process.env.JMAP_ADMIN_USER;
  const adminPassword = process.env.JMAP_ADMIN_PASSWORD;

  if (!serverUrl || !adminUser || !adminPassword) {
    return null;
  }

  try {
    // First get the JMAP session to find the API URL and account ID
    const sessionRes = await fetch(`${serverUrl}/.well-known/jmap`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${adminUser}:${adminPassword}`).toString('base64'),
      },
    });

    if (!sessionRes.ok) return null;
    const session = await sessionRes.json();
    const apiUrl = session.apiUrl;

    // Find account ID for the target user
    const accounts = session.accounts || {};
    let accountId: string | null = null;
    for (const [id, account] of Object.entries(accounts)) {
      const acc = account as { name?: string };
      if (acc.name === username || id === username) {
        accountId = id;
        break;
      }
    }

    // If we can't find the account via admin session, try using the username as master auth
    // Stalwart supports "admin%username" authentication for impersonation
    const authUser = accountId ? adminUser : `${adminUser}%${username}`;
    const authHeader = 'Basic ' + Buffer.from(`${authUser}:${adminPassword}`).toString('base64');

    // Re-fetch session with impersonation if needed
    let targetApiUrl = apiUrl;
    let targetAccountId = accountId;

    if (!accountId) {
      const impersonateRes = await fetch(`${serverUrl}/.well-known/jmap`, {
        headers: { 'Authorization': authHeader },
      });
      if (!impersonateRes.ok) return null;
      const impSession = await impersonateRes.json();
      targetApiUrl = impSession.apiUrl;
      const impAccounts = impSession.accounts || {};
      targetAccountId = Object.keys(impAccounts)[0] || null;
    }

    if (!targetAccountId || !targetApiUrl) return null;

    // Fetch the latest email from inbox
    const jmapRes = await fetch(targetApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        methodCalls: [
          ['Email/query', {
            accountId: targetAccountId,
            filter: { inMailbox: null },
            sort: [{ property: 'receivedAt', isAscending: false }],
            limit: 1,
          }, '0'],
          ['Email/get', {
            accountId: targetAccountId,
            '#ids': { resultOf: '0', name: 'Email/query', path: '/ids' },
            properties: ['from', 'subject', 'preview'],
          }, '1'],
        ],
      }),
    });

    if (!jmapRes.ok) return null;
    const jmapData = await jmapRes.json();

    // Extract email from response
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

      // Try to fetch email details for a rich notification
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
