import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Bill, Round } from "@/lib/types";

export function listenBills(callback: (bills: Bill[]) => void) {
  const q = query(collection(db, "bills"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bill));
  });
}

export function listenBill(
  billId: string,
  callback: (bill: Bill | null) => void,
) {
  return onSnapshot(doc(db, "bills", billId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Bill) : null);
  });
}

export function listenRounds(
  billId: string,
  callback: (rounds: Round[]) => void,
) {
  const q = query(
    collection(db, "bills", billId, "rounds"),
    orderBy("order"),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Round));
  });
}

export async function createBill(
  title: string,
  participantIds: string[],
  createdBy: string,
) {
  const ref = await addDoc(collection(db, "bills"), {
    title,
    participantIds,
    totalAmount: 0,
    roundCount: 0,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function setBillParticipants(
  billId: string,
  participantIds: string[],
) {
  await updateDoc(doc(db, "bills", billId), { participantIds });
}

export async function addRound(
  billId: string,
  round: {
    label: string;
    amount: number;
    payerId: string;
    participantIds: string[];
    order: number;
    createdBy: string;
  },
) {
  const batch = writeBatch(db);
  const roundRef = doc(collection(db, "bills", billId, "rounds"));
  batch.set(roundRef, {
    ...round,
    noDrinkIds: [],
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "bills", billId), {
    totalAmount: increment(round.amount),
    roundCount: increment(1),
  });
  await batch.commit();
}

export async function toggleNoDrink(
  billId: string,
  roundId: string,
  personId: string,
  isCurrentlyNoDrink: boolean,
) {
  const ref = doc(db, "bills", billId, "rounds", roundId);
  await updateDoc(ref, {
    noDrinkIds: isCurrentlyNoDrink
      ? arrayRemove(personId)
      : arrayUnion(personId),
  });
}
