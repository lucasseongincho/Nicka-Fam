import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NotificationPrefs, Person } from "@/lib/types";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  calendar: true,
  photos: true,
  board: true,
  leaderboards: true,
  bills: true,
};

/**
 * People created before notificationPrefs existed have no field at all --
 * default every category on, same "absent -- treat as X" idiom as
 * planStatus() in lib/calendar.ts. Merged rather than just falling back to
 * the whole default object, since updateNotificationPrefs writes partial
 * dotted-path updates -- a person who has only ever toggled `photos` has a
 * notificationPrefs map containing *just* that key, and the other three
 * categories need to still default to true rather than reading as missing/false.
 */
export function getNotificationPrefs(person: Pick<Person, "notificationPrefs">): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...person.notificationPrefs };
}

/** Partial update -- writes only the given categories via dotted field paths, same idiom as `reactions.${emoji}` in lib/bulletin.ts, so this never clobbers categories it wasn't given. */
export async function updateNotificationPrefs(
  personId: string,
  partial: Partial<NotificationPrefs>,
) {
  const updates: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(partial)) {
    updates[`notificationPrefs.${key}`] = value;
  }
  await updateDoc(doc(db, "people", personId), updates);
}

export async function saveFcmToken(personId: string, token: string) {
  await updateDoc(doc(db, "people", personId), {
    fcmTokens: arrayUnion(token),
  });
}

export async function removeFcmToken(personId: string, token: string) {
  await updateDoc(doc(db, "people", personId), {
    fcmTokens: arrayRemove(token),
  });
}
