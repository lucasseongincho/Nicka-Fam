import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { etDateString, SETLOG_WINDOW_MINUTES } from "@/lib/setlogTime";
import type { SetlogClip, SetlogDay, SetlogPromptsDay, SetlogSlot } from "@/lib/types";

/**
 * Today's ET calendar date, computed once per call -- fine for the
 * listeners below since they're re-subscribed on remount, but a session
 * left open across an ET midnight rollover won't automatically follow the
 * date forward. Acceptable for v1: the capture prompt itself (push +
 * PromptWatcher) still fires correctly either way, since it's keyed off
 * server-generated slot times, not this helper.
 */
export function todaySetlogDate(): string {
  return etDateString(new Date());
}

export function listenSetlogPrompts(
  date: string,
  callback: (day: SetlogPromptsDay | null) => void,
) {
  const ref = doc(db, "setlogPrompts", date);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? (snap.data() as SetlogPromptsDay) : null);
  });
}

export function listenMySetlogClips(
  date: string,
  personId: string,
  callback: (clips: SetlogClip[]) => void,
) {
  const q = query(
    collection(db, "setlogClips"),
    where("date", "==", date),
    where("personId", "==", personId),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SetlogClip));
  });
}

export function listenSetlogDays(callback: (days: SetlogDay[]) => void, max = 60) {
  const q = query(collection(db, "setlogDays"), orderBy("date", "desc"), limit(max));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as SetlogDay));
  });
}

async function uploadClipToCloudinary(blob: Blob): Promise<{ url: string; publicId: string }> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  const body = new FormData();
  body.append("file", blob, "clip.webm");
  body.append("upload_preset", uploadPreset!);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
    method: "POST",
    body,
  });
  if (!res.ok) {
    throw new Error(`Cloudinary clip upload failed: ${res.status}`);
  }
  const data = await res.json();
  return { url: data.secure_url as string, publicId: data.public_id as string };
}

export async function submitSetlogClip(
  blob: Blob,
  personId: string,
  date: string,
  slotId: string,
): Promise<void> {
  const { url, publicId } = await uploadClipToCloudinary(blob);
  await addDoc(collection(db, "setlogClips"), {
    personId,
    date,
    slotId,
    videoUrl: url,
    publicId,
    createdAt: serverTimestamp(),
  });
}

/**
 * The one slot (if any) this person should currently be capturing for:
 * scheduled time has arrived, their 8-minute window hasn't closed, and they
 * haven't already submitted a clip for it. Slots are checked in order, so
 * if someone opens the app late and two windows happen to overlap (they
 * shouldn't, given the >=60min spacing lib/setlogTime.ts enforces, but
 * clock skew could still cause it) the earliest still-open one wins.
 */
export function findOpenSetlogSlot(
  prompts: SetlogPromptsDay | null,
  submittedSlotIds: Set<string>,
  nowMs: number,
): SetlogSlot | null {
  if (!prompts) return null;
  const windowMs = SETLOG_WINDOW_MINUTES * 60_000;
  return (
    prompts.slots.find((slot) => {
      const startMs = slot.scheduledAt.toMillis();
      return nowMs >= startMs && nowMs < startMs + windowMs && !submittedSlotIds.has(slot.id);
    }) ?? null
  );
}
