import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { addSubscription, removeSubscription, replaceSubscription } from '@/lib/push/subscription-store';
import type { PushSubscriptionData } from '@/lib/push/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, subscription, oldEndpoint } = body as {
      username?: string;
      subscription?: PushSubscriptionData;
      oldEndpoint?: string;
    };

    if (!username || !subscription) {
      return NextResponse.json({ error: 'Missing username or subscription' }, { status: 400 });
    }

    if (!subscription.endpoint?.startsWith('https://')) {
      return NextResponse.json({ error: 'Invalid subscription endpoint' }, { status: 400 });
    }

    if (!subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription keys' }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (oldEndpoint) {
      await replaceSubscription(username, oldEndpoint, subscription, userAgent);
    } else {
      await addSubscription(username, subscription, userAgent);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Push subscribe error', error as Record<string, unknown>);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, endpoint } = body as { username?: string; endpoint?: string };

    if (!username || !endpoint) {
      return NextResponse.json({ error: 'Missing username or endpoint' }, { status: 400 });
    }

    await removeSubscription(username, endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Push unsubscribe error', error as Record<string, unknown>);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
