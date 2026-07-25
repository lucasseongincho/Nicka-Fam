import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  etDateString,
  etEndOfDayUtc,
  etHour,
  isWithinActiveHours,
  setlogSlotId,
} from "@/lib/setlogTime";
import type { SetlogClip, SetlogComment, SetlogSlot } from "@/lib/types";

export function todaySetlogDate(): string {
  return etDateString(new Date());
}

/** The slot id someone could currently be recording into, or null outside active hours. */
export function currentSetlogSlotId(): string | null {
  const now = new Date();
  const hour = etHour(now);
  if (!isWithinActiveHours(hour)) return null;
  return setlogSlotId(etDateString(now), hour);
}

export function listenSetlogSlot(slotId: string, callback: (slot: SetlogSlot | null) => void) {
  return onSnapshot(doc(db, "setlogSlots", slotId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as SetlogSlot) : null);
  });
}

export function listenSetlogSlotsForDate(date: string, callback: (slots: SetlogSlot[]) => void) {
  const q = query(
    collection(db, "setlogSlots"),
    where("date", "==", date),
    orderBy("hour", "asc"),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SetlogSlot));
  });
}

export function listenSetlogClipsForSlot(slotId: string, callback: (clips: SetlogClip[]) => void) {
  const q = query(collection(db, "setlogClips"), where("slotId", "==", slotId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SetlogClip));
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

/**
 * Uploads the clip, creates its setlogClips doc (editableUntil is the end
 * of *today* in ET, not the slot's own date -- in practice always the same
 * day, since a clip can only be posted into the current slot), and marks
 * this person as submitted on the slot doc.
 */
export async function submitSetlogClip(
  blob: Blob,
  caption: string,
  personId: string,
  slotId: string,
): Promise<string> {
  const { url, publicId } = await uploadClipToCloudinary(blob);
  const editableUntil = Timestamp.fromDate(etEndOfDayUtc(todaySetlogDate()));

  const clipRef = await addDoc(collection(db, "setlogClips"), {
    personId,
    slotId,
    videoUrl: url,
    publicId,
    caption: caption.trim(),
    createdAt: serverTimestamp(),
    editableUntil,
  });

  await updateDoc(doc(db, "setlogSlots", slotId), {
    submittedPersonIds: arrayUnion(personId),
  });

  return clipRef.id;
}

export function isClipEditable(clip: SetlogClip): boolean {
  return Date.now() < clip.editableUntil.toMillis();
}

export async function updateSetlogClipCaption(clipId: string, caption: string) {
  await updateDoc(doc(db, "setlogClips", clipId), { caption: caption.trim() });
}

export function listenSetlogCommentsForClip(
  clipId: string,
  callback: (comments: SetlogComment[]) => void,
) {
  const q = query(
    collection(db, "setlogComments"),
    where("clipId", "==", clipId),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SetlogComment));
  });
}

/** Every comment across every clip in a slot, in one chronological feed -- powers the combined slot chatroom. */
export function listenSetlogCommentsForSlot(
  slotId: string,
  callback: (comments: SetlogComment[]) => void,
) {
  const q = query(
    collection(db, "setlogComments"),
    where("slotId", "==", slotId),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SetlogComment));
  });
}

const MASCOT_COLORS = ["orange", "teal", "blue", "pink", "green", "yellow"] as const;

/** Deterministic per-person Mascot color for a "waiting" clip box, so a given person's placeholder stays the same color across slots/days. */
export function mascotColorForPerson(personId: string): (typeof MASCOT_COLORS)[number] {
  let hash = 0;
  for (let i = 0; i < personId.length; i++) hash = (hash * 31 + personId.charCodeAt(i)) >>> 0;
  return MASCOT_COLORS[hash % MASCOT_COLORS.length];
}

export async function addSetlogComment(
  clipId: string,
  slotId: string,
  personId: string,
  text: string,
) {
  await addDoc(collection(db, "setlogComments"), {
    clipId,
    slotId,
    personId,
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
}
