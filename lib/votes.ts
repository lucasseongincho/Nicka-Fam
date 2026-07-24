import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DesignComment, DesignVote, VoteDesign, VoteSession } from "@/lib/types";

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
 *
 * Normalizes legacy docs written before multi-vote support, which stored a
 * single `designId` string instead of a `designIds` array -- those carry
 * over as a one-element array rather than disappearing.
 */
export function listenMyVote(personId: string, callback: (vote: DesignVote | null) => void) {
  return onSnapshot(doc(db, "votes", personId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const data = snap.data() as {
      voterId: string;
      designId?: string;
      designIds?: string[];
      updatedAt: DesignVote["updatedAt"];
    };
    callback({
      voterId: data.voterId,
      designIds: data.designIds ?? (data.designId ? [data.designId] : []),
      updatedAt: data.updatedAt,
    });
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
    commentCount: 0,
    createdAt: serverTimestamp(),
  });
  batch.set(uploaderRef, { uploaderId });
  await batch.commit();

  return designRef.id;
}

export async function deleteVoteDesign(designId: string) {
  const commentsSnap = await getDocs(collection(db, "voteDesigns", designId, "comments"));
  const batch = writeBatch(db);
  commentsSnap.docs.forEach((c) => batch.delete(c.ref));
  batch.delete(doc(db, "voteDesigns", designId));
  batch.delete(doc(db, "voteDesignUploaders", designId));
  await batch.commit();
}

export function listenDesignComments(
  designId: string,
  callback: (comments: DesignComment[]) => void,
) {
  const q = query(
    collection(db, "voteDesigns", designId, "comments"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DesignComment));
  });
}

export async function addDesignComment(designId: string, authorId: string, text: string) {
  const batch = writeBatch(db);
  const commentRef = doc(collection(db, "voteDesigns", designId, "comments"));
  batch.set(commentRef, { authorId, text, createdAt: serverTimestamp() });
  batch.update(doc(db, "voteDesigns", designId), { commentCount: increment(1) });
  await batch.commit();
}

export async function deleteDesignComment(designId: string, commentId: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "voteDesigns", designId, "comments", commentId));
  batch.update(doc(db, "voteDesigns", designId), { commentCount: increment(-1) });
  await batch.commit();
}

/**
 * Toggles one person's vote for one design -- a person can vote for as many
 * designs as they like, independently. Runs as a transaction (rather than a
 * blind arrayUnion/arrayRemove batch) because it must also migrate legacy
 * docs written before multi-vote support, which stored a single `designId`
 * string instead of a `designIds` array: arrayUnion on the `designIds` field
 * alone would silently leave that old field behind, un-migrated, the moment
 * someone toggled a second design -- their original vote would still count
 * toward its design's tally but stop showing as "your vote" on their own
 * client. Reading the doc first and overwriting it whole (not merging) fixes
 * that in place instead of just papering over it on read.
 */
export async function toggleVote(
  designId: string,
  personId: string,
  isCurrentlyVoted: boolean,
) {
  await runTransaction(db, async (tx) => {
    const voteRef = doc(db, "votes", personId);
    const voteSnap = await tx.get(voteRef);
    const data = voteSnap.exists()
      ? (voteSnap.data() as { designId?: string; designIds?: string[] })
      : undefined;
    const currentIds = new Set(data?.designIds ?? (data?.designId ? [data.designId] : []));
    if (isCurrentlyVoted) {
      currentIds.delete(designId);
    } else {
      currentIds.add(designId);
    }

    tx.set(voteRef, {
      voterId: personId,
      designIds: Array.from(currentIds),
      updatedAt: serverTimestamp(),
    });
    tx.update(doc(db, "voteDesigns", designId), {
      voteCount: increment(isCurrentlyVoted ? -1 : 1),
    });
  });
}

export async function setVotingOpen(open: boolean) {
  await setDoc(
    doc(db, "voteSession", SESSION_DOC_ID),
    { open, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
