import {
  addDoc,
  arrayRemove,
  arrayUnion,
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
import type { CalendarEvent } from "@/lib/types";

export function listenEvents(callback: (events: CalendarEvent[]) => void) {
  const q = query(collection(db, "calendarEvents"), orderBy("date"));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CalendarEvent),
    );
  });
}

export async function createEvent(event: {
  title: string;
  date: string;
  time: string;
  createdBy: string;
}) {
  await addDoc(collection(db, "calendarEvents"), {
    ...event,
    attendeeIds: [event.createdBy],
    createdAt: serverTimestamp(),
  });
}

export async function updateEvent(
  eventId: string,
  updates: { title: string; date: string; time: string },
) {
  await updateDoc(doc(db, "calendarEvents", eventId), updates);
}

export async function deleteEvent(eventId: string) {
  await deleteDoc(doc(db, "calendarEvents", eventId));
}

export async function toggleRSVP(
  eventId: string,
  personId: string,
  isAttending: boolean,
) {
  await updateDoc(doc(db, "calendarEvents", eventId), {
    attendeeIds: isAttending ? arrayRemove(personId) : arrayUnion(personId),
  });
}
