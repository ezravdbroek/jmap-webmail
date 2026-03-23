import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';
import type { PushSubscriptionData, StoredSubscription } from './types';

const DATA_DIR = path.join(process.cwd(), 'data', 'push-subscriptions');

function sanitizeUsername(username: string): string {
  return username.replace(/[^a-zA-Z0-9@._-]/g, '_');
}

function userFilePath(username: string): string {
  return path.join(DATA_DIR, `${sanitizeUsername(username)}.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function getSubscriptions(username: string): Promise<StoredSubscription[]> {
  try {
    const data = await fs.readFile(userFilePath(username), 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function addSubscription(
  username: string,
  sub: PushSubscriptionData,
  userAgent: string
): Promise<void> {
  await ensureDir();
  const subs = await getSubscriptions(username);

  // Deduplicate by endpoint
  const filtered = subs.filter((s) => s.subscription.endpoint !== sub.endpoint);
  filtered.push({
    subscription: sub,
    createdAt: new Date().toISOString(),
    userAgent,
  });

  await fs.writeFile(userFilePath(username), JSON.stringify(filtered, null, 2));
  logger.info(`Push subscription added for ${username} (${filtered.length} total)`);
}

export async function removeSubscription(username: string, endpoint: string): Promise<void> {
  const subs = await getSubscriptions(username);
  const filtered = subs.filter((s) => s.subscription.endpoint !== endpoint);

  if (filtered.length === 0) {
    try {
      await fs.unlink(userFilePath(username));
    } catch { /* file may not exist */ }
  } else {
    await fs.writeFile(userFilePath(username), JSON.stringify(filtered, null, 2));
  }

  logger.info(`Push subscription removed for ${username} (${filtered.length} remaining)`);
}

export async function replaceSubscription(
  username: string,
  oldEndpoint: string,
  newSub: PushSubscriptionData,
  userAgent: string
): Promise<void> {
  await ensureDir();
  const subs = await getSubscriptions(username);
  const filtered = subs.filter((s) => s.subscription.endpoint !== oldEndpoint);
  filtered.push({
    subscription: newSub,
    createdAt: new Date().toISOString(),
    userAgent,
  });

  await fs.writeFile(userFilePath(username), JSON.stringify(filtered, null, 2));
  logger.info(`Push subscription replaced for ${username}`);
}
