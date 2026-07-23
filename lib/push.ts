"use client";

import { app } from "@/lib/firebase";
import { saveFcmToken } from "@/lib/notificationPrefs";

/**
 * Everything here is client-only and defensive: a missing VAPID key, an
 * unsupported browser, or a denied permission should all degrade to "no
 * token saved" rather than throwing and breaking the settings UI. Real
 * push delivery needs NEXT_PUBLIC_FIREBASE_VAPID_KEY (Firebase Console ->
 * Project Settings -> Cloud Messaging -> Web configuration) -- until
 * that's set, permission can still be granted, it just won't produce a
 * usable device token yet.
 */

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/** True once the page is running as an installed home-screen app (iOS Safari's own flag, or the standard PWA display-mode media query elsewhere). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (err) {
    console.error("service worker registration failed", err);
    return null;
  }
}

export type PermissionResult = NotificationPermission | "unsupported";

/**
 * Asks for notification permission and, if granted, tries to mint an FCM
 * token and save it. The permission result is returned regardless of
 * whether token retrieval actually succeeded, since a missing VAPID key
 * shouldn't be reported to the user as "permission denied".
 */
export async function requestNotificationPermission(personId: string): Promise<PermissionResult> {
  if (!isPushSupported()) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  try {
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn("NEXT_PUBLIC_FIREBASE_VAPID_KEY isn't set -- permission granted, but no device token can be minted yet");
      return "granted";
    }
    const registration = await registerServiceWorker();
    if (!registration) return "granted";

    const { getMessaging, getToken } = await import("firebase/messaging");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (token) await saveFcmToken(personId, token);
  } catch (err) {
    console.error("failed to mint/save an FCM token", err);
  }

  return "granted";
}
