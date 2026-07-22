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
import type { BulletinComment, BulletinPost } from "@/lib/types";

export function listenBulletinPosts(callback: (posts: BulletinPost[]) => void) {
  const q = query(collection(db, "bulletinPosts"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BulletinPost));
  });
}

export async function addBulletinPost(authorId: string, text: string) {
  await addDoc(collection(db, "bulletinPosts"), {
    authorId,
    text,
    reactions: {},
    commentCount: 0,
    createdAt: serverTimestamp(),
  });
}

export async function updateBulletinPostText(postId: string, text: string) {
  await updateDoc(doc(db, "bulletinPosts", postId), { text });
}

/** Deletes the post and every reply under it -- mirrors deleteBill clearing its rounds subcollection. */
export async function deleteBulletinPost(postId: string) {
  const commentsSnap = await getDocs(collection(db, "bulletinPosts", postId, "comments"));
  const batch = writeBatch(db);
  commentsSnap.docs.forEach((c) => batch.delete(c.ref));
  batch.delete(doc(db, "bulletinPosts", postId));
  await batch.commit();
}

/**
 * Toggles one person's reaction with one emoji. Each emoji on a post tracks
 * its own list of reactor personIds (same arrayUnion/arrayRemove idiom as
 * toggleNoDrink in lib/bills.ts), so a person can react with several
 * different emoji on the same post.
 */
export async function toggleReaction(
  postId: string,
  emoji: string,
  personId: string,
  isCurrentlyReacted: boolean,
) {
  await updateDoc(doc(db, "bulletinPosts", postId), {
    [`reactions.${emoji}`]: isCurrentlyReacted ? arrayRemove(personId) : arrayUnion(personId),
  });
}

export function listenBulletinComments(
  postId: string,
  callback: (comments: BulletinComment[]) => void,
) {
  const q = query(
    collection(db, "bulletinPosts", postId, "comments"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BulletinComment));
  });
}

export async function addBulletinComment(postId: string, authorId: string, text: string) {
  const batch = writeBatch(db);
  const commentRef = doc(collection(db, "bulletinPosts", postId, "comments"));
  batch.set(commentRef, { authorId, text, createdAt: serverTimestamp() });
  batch.update(doc(db, "bulletinPosts", postId), { commentCount: increment(1) });
  await batch.commit();
}

export async function deleteBulletinComment(postId: string, commentId: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "bulletinPosts", postId, "comments", commentId));
  batch.update(doc(db, "bulletinPosts", postId), { commentCount: increment(-1) });
  await batch.commit();
}
