export type NotifyCategory = "calendar" | "photos" | "board" | "leaderboards" | "bills";

export interface NotifyPayload {
  category: NotifyCategory;
  /** personId excluded from the recipient list -- whoever performed the action. */
  actorId: string;
  title: string;
  body: string;
  /** Deep-link path, e.g. "/photos" or "/game/suika" -- opened when the notification is tapped. */
  url?: string;
  /** One specific person (e.g. a photo/post's owner) who should see different copy than the rest of the category's recipients. */
  recipientOverride?: { personId: string; title?: string; body: string };
  /** If set, only these personIds are notified (still subject to their own category preference) instead of broadcasting to everyone with the category enabled -- for targeted notifications like "you got paid back", where notifying the whole group would be wrong. */
  recipientIds?: string[];
}

/**
 * Fires the push-notification API route and swallows any failure -- a
 * missing VAPID key/service account or a flaky network must never break
 * the feature that triggered this (posting a photo, finishing a game,
 * etc.), same reasoning as the try/catch around score submission in every
 * *Game.tsx component.
 */
export async function notifyCategory(payload: NotifyPayload): Promise<void> {
  try {
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("notifyCategory failed", err);
  }
}
