import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Photo } from "@/lib/types";

export function listenPhotos(callback: (photos: Photo[]) => void) {
  const q = query(collection(db, "photos"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Photo));
  });
}

export async function uploadPhoto(
  file: File,
  caption: string,
  uploadedBy: string,
) {
  const storagePath = `photos/${crypto.randomUUID()}-${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  await addDoc(collection(db, "photos"), {
    storagePath,
    url,
    caption,
    uploadedBy,
    createdAt: serverTimestamp(),
  });
}
