import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Photo } from "@/lib/types";

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
    createdAt: serverTimestamp(),
  });
}

export async function updatePhotoCaption(photoId: string, caption: string) {
  await updateDoc(doc(db, "photos", photoId), { caption });
}

/**
 * Deletes only the Firestore metadata doc. The underlying Cloudinary asset
 * is left in place — deleting it requires the API Secret, which is
 * intentionally kept out of this client-side app.
 */
export async function deletePhoto(photoId: string) {
  await deleteDoc(doc(db, "photos", photoId));
}
