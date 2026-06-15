export type WeeklyDigestNotification = {
  id: string;
  brand: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  status: "pending" | "sent" | "edited";
  createdAt: string;
  sentAt: string | null;
};

export type RedFlagAlert = {
  id: string;
  brand: string;
  creator: string;
  reason: string;
  severity: "CRITICAL" | "HIGH";
  mitigation: string;
  status: "unseen" | "seen";
  createdAt: string;
};

type NotificationStoreState = {
  weeklyDigests: WeeklyDigestNotification[];
  redFlags: RedFlagAlert[];
};

const globalForNotificationStore = globalThis as typeof globalThis & {
  creatorIqNotificationStore?: NotificationStoreState;
};

const state =
  globalForNotificationStore.creatorIqNotificationStore ??
  (globalForNotificationStore.creatorIqNotificationStore = {
    weeklyDigests: [],
    redFlags: [],
  });

export const notificationStore = {
  getAll() {
    return state.weeklyDigests;
  },
  getByBrand(brand: string) {
    return state.weeklyDigests.filter((notification) => notification.brand === brand);
  },
  add(notification: WeeklyDigestNotification) {
    state.weeklyDigests = [notification, ...state.weeklyDigests];

    return notification;
  },
  updateBody(id: string, newBodyHtml: string, newBodyText?: string) {
    state.weeklyDigests = state.weeklyDigests.map((notification) =>
      notification.id === id
        ? {
            ...notification,
            bodyHtml: newBodyHtml,
            bodyText: newBodyText,
            status: notification.status === "sent" ? "sent" : "edited",
          }
        : notification,
    );

    return state.weeklyDigests.find((notification) => notification.id === id) ?? null;
  },
  markSent(id: string) {
    state.weeklyDigests = state.weeklyDigests.map((notification) =>
      notification.id === id
        ? {
            ...notification,
            status: "sent",
            sentAt: new Date().toISOString(),
          }
        : notification,
    );

    return state.weeklyDigests.find((notification) => notification.id === id) ?? null;
  },
  getPendingCount() {
    return state.weeklyDigests.filter((notification) => notification.status !== "sent")
      .length;
  },
};

export const redFlagStore = {
  getAll() {
    return state.redFlags;
  },
  add(alert: RedFlagAlert) {
    state.redFlags = [alert, ...state.redFlags];

    return alert;
  },
  markSeen(id: string) {
    state.redFlags = state.redFlags.map((alert) =>
      alert.id === id
        ? {
            ...alert,
            status: "seen",
          }
        : alert,
    );

    return state.redFlags.find((alert) => alert.id === id) ?? null;
  },
  getUnseenCount() {
    return state.redFlags.filter((alert) => alert.status === "unseen").length;
  },
};
