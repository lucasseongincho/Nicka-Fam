import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notificationPrefs";
import type { NotificationPrefs, Person } from "@/lib/types";
import type { NotifyCategory } from "@/lib/notifyClient";

// Server-only module -- imports firebase-admin, which needs Node APIs and
// a service account credential. Only ever import this from app/api routes,
// never from a client component.

/**
 * Lazily builds the firebase-admin app from FIREBASE_ADMIN_* env vars.
 * Returns null (rather than throwing) when they're not set yet, so
 * /api/notify can degrade to a no-op instead of 500ing -- this project
 * intentionally has no Cloud Functions/Blaze plan, so this admin app only
 * ever runs inside Vercel's own API routes, using a service account
 * generated from Firebase Console -> Project Settings -> Service Accounts.
 */
function adminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY aren't all set -- push notifications are disabled until they are",
    );
    return null;
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export interface SendCategoryNotificationInput {
  category: NotifyCategory;
  actorId: string;
  title: string;
  body: string;
  url?: string;
  recipientOverride?: { personId: string; title?: string; body: string };
}

// Merged with defaults, not just falling back when absent -- a person who
// has only ever toggled one category has a notificationPrefs map
// containing just that key (see getNotificationPrefs in
// lib/notificationPrefs.ts for the fuller explanation of why).
function prefsAllow(prefs: NotificationPrefs | undefined, category: NotifyCategory): boolean {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...prefs }[category];
}

function copyFor(input: SendCategoryNotificationInput, personId: string): { title: string; body: string } {
  if (input.recipientOverride?.personId === personId) {
    return { title: input.recipientOverride.title ?? input.title, body: input.recipientOverride.body };
  }
  return { title: input.title, body: input.body };
}

/**
 * Sends to everyone with `category` enabled except the actor. One person
 * (recipientOverride, e.g. a photo/post's owner) can get different copy
 * than everyone else. Any token FCM reports as no-longer-registered is
 * pruned from that person's doc -- devices get uninstalled/tokens rotate,
 * and there's no other cleanup path for that.
 */
export async function sendCategoryNotification(input: SendCategoryNotificationInput): Promise<void> {
  const app = adminApp();
  if (!app) return;

  const db = getFirestore(app);
  const peopleSnap = await db.collection("people").get();
  const people = peopleSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Person);

  const recipients = people.filter(
    (p) => p.id !== input.actorId && prefsAllow(p.notificationPrefs, input.category),
  );
  if (recipients.length === 0) return;

  const targets: { token: string; personId: string }[] = [];
  for (const person of recipients) {
    for (const token of person.fcmTokens ?? []) targets.push({ token, personId: person.id });
  }
  if (targets.length === 0) return;

  // Data-only (no top-level `notification` field) so the service worker's
  // onBackgroundMessage always fires and has full control over both the
  // notification's content and its click target -- letting the browser
  // auto-display a `notification` payload instead works too, but then the
  // click handler can't reliably read where to deep-link to.
  //
  // sendEach (not sendEachForMulticast) -- the "multicast" variant sends
  // one shared payload to every token, but recipientOverride means
  // different tokens can need different copy in the same batch.
  const messaging = getMessaging(app);
  const response = await messaging.sendEach(
    targets.map(({ token, personId }) => {
      const { title, body } = copyFor(input, personId);
      return {
        token,
        data: { title, body, url: input.url ?? "" },
      };
    }),
  );

  const staleTokensByPerson = new Map<string, string[]>();
  response.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-argument") {
      const { token, personId } = targets[i];
      staleTokensByPerson.set(personId, [...(staleTokensByPerson.get(personId) ?? []), token]);
    }
  });

  for (const [personId, staleTokens] of staleTokensByPerson) {
    const person = people.find((p) => p.id === personId);
    const remaining = (person?.fcmTokens ?? []).filter((t) => !staleTokens.includes(t));
    await db.collection("people").doc(personId).update({ fcmTokens: remaining });
  }
}
