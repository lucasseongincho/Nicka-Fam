import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Photo, PhotoComment } from "@/lib/types";

export function listenPhotos(callback: (photos: Photo[]) => void) {
  const q = query(collection(db, "photos"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Photo));
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

export async function uploadPhoto(
  file: File,
  caption: string,
  uploadedBy: string,
) {
  const { url, publicId } = await uploadToCloudinary(file);

  await addDoc(collection(db, "photos"), {
    publicId,
    url,
    caption,
    uploadedBy,
    reactions: {},
    commentCount: 0,
    createdAt: serverTimestamp(),
  });
}

export async function updatePhotoCaption(photoId: string, caption: string) {
  await updateDoc(doc(db, "photos", photoId), { caption });
}

/**
 * Deletes the Firestore metadata doc and every reply under it (same
 * writeBatch pattern as deleteBulletinPost clearing its comments). The
 * underlying Cloudinary asset is left in place — deleting it requires the
 * API Secret, which is intentionally kept out of this client-side app.
 */
export async function deletePhoto(photoId: string) {
  const commentsSnap = await getDocs(collection(db, "photos", photoId, "comments"));
  const batch = writeBatch(db);
  commentsSnap.docs.forEach((c) => batch.delete(c.ref));
  batch.delete(doc(db, "photos", photoId));
  await batch.commit();
}

/**
 * Toggles one person's reaction with one emoji -- same arrayUnion/arrayRemove
 * idiom as toggleReaction in lib/bulletin.ts (and toggleNoDrink in
 * lib/bills.ts). A person can react with several different emoji on the
 * same photo.
 */
export async function togglePhotoReaction(
  photoId: string,
  emoji: string,
  personId: string,
  isCurrentlyReacted: boolean,
) {
  await updateDoc(doc(db, "photos", photoId), {
    [`reactions.${emoji}`]: isCurrentlyReacted ? arrayRemove(personId) : arrayUnion(personId),
  });
}

export function listenPhotoComments(
  photoId: string,
  callback: (comments: PhotoComment[]) => void,
) {
  const q = query(
    collection(db, "photos", photoId, "comments"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PhotoComment));
  });
}

export async function addPhotoComment(photoId: string, authorId: string, text: string) {
  const batch = writeBatch(db);
  const commentRef = doc(collection(db, "photos", photoId, "comments"));
  batch.set(commentRef, { authorId, text, createdAt: serverTimestamp() });
  batch.update(doc(db, "photos", photoId), { commentCount: increment(1) });
  await batch.commit();
}

export async function deletePhotoComment(photoId: string, commentId: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "photos", photoId, "comments", commentId));
  batch.update(doc(db, "photos", photoId), { commentCount: increment(-1) });
  await batch.commit();
}
