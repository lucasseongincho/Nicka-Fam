import {
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DesignVote, VoteDesign, VoteSession } from "@/lib/types";

const SESSION_DOC_ID = "current";

export function listenVoteDesigns(callback: (designs: VoteDesign[]) => void) {
  const q = query(collection(db, "voteDesigns"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VoteDesign));
  });
}

export function listenVoteSession(callback: (session: VoteSession | null) => void) {
  return onSnapshot(doc(db, "voteSession", SESSION_DOC_ID), (snap) => {
    callback(snap.exists() ? (snap.data() as VoteSession) : null);
  });
}

/**
 * Live-listens to one person's own vote by doc ID (votes/{personId}) -- a
 * single-doc `get`, not a collection `list`, so this stays allowed under
 * rules that otherwise deny listing the votes collection. Never used to look
 * up anyone else's vote.
 */
export function listenMyVote(personId: string, callback: (vote: DesignVote | null) => void) {
  return onSnapshot(doc(db, "votes", personId), (snap) => {
    callback(snap.exists() ? (snap.data() as DesignVote) : null);
  });
}

async function uploadToCloudinary(file: File) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", uploadPreset!);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body },
  );
  if (!res.ok) {
    throw new Error(`Cloudinary upload failed: ${res.status}`);
  }
  const data = await res.json();
  return { url: data.secure_url as string, publicId: data.public_id as string };
}

/**
 * Uploads a design image and writes two docs in one batch: the public
 * voteDesigns doc (image + count only) and a write-only voteDesignUploaders
 * doc holding uploaderId. The latter has no client read path at all -- it
 * exists purely for backend bookkeeping, per the feature spec. Returns the
 * new design's ID so the caller can remember "I uploaded this" locally (the
 * only way to power a future "remove my design" button, since the app can
 * never read uploaderId back).
 */
export async function uploadVoteDesign(file: File, uploaderId: string) {
  const { url, publicId } = await uploadToCloudinary(file);

  const designRef = doc(collection(db, "voteDesigns"));
  const uploaderRef = doc(db, "voteDesignUploaders", designRef.id);

  const batch = writeBatch(db);
  batch.set(designRef, {
    imageUrl: url,
    publicId,
    voteCount: 0,
    createdAt: serverTimestamp(),
  });
  batch.set(uploaderRef, { uploaderId });
  await batch.commit();

  return designRef.id;
}

export async function deleteVoteDesign(designId: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "voteDesigns", designId));
  batch.delete(doc(db, "voteDesignUploaders", designId));
  await batch.commit();
}

/**
 * Casts or switches a vote. `previousDesignId` must come from the caller's
 * already-subscribed listenMyVote state (not re-read here) -- votes/{personId}
 * is a single doc the caller already has live, so there's no need for a
 * second round-trip. Decrements the old design's count and increments the
 * new one in the same batch as the vote doc write, so a design's tally and
 * the set of who's-voted-for-what never drift apart.
 */
export async function castVote(
  designId: string,
  personId: string,
  previousDesignId: string | null,
) {
  if (previousDesignId === designId) return;

  const batch = writeBatch(db);
  if (previousDesignId) {
    batch.update(doc(db, "voteDesigns", previousDesignId), { voteCount: increment(-1) });
  }
  batch.update(doc(db, "voteDesigns", designId), { voteCount: increment(1) });
  batch.set(doc(db, "votes", personId), {
    voterId: personId,
    designId,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function setVotingOpen(open: boolean) {
  await setDoc(
    doc(db, "voteSession", SESSION_DOC_ID),
    { open, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
