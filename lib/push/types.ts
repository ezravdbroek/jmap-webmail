export interface PushSubscriptionData {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface StoredSubscription {
  subscription: PushSubscriptionData;
  createdAt: string;
  userAgent: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url: string;
  emailId?: string;
  timestamp: number;
}
