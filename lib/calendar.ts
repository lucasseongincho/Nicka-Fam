import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Availability, CalendarEvent, PlanStatus } from "@/lib/types";

/** Legacy docs written before "status" existed have a date but no status field. */
export function planStatus(event: CalendarEvent): PlanStatus {
  return event.status ?? (event.date ? "confirmed" : "open");
}

export function listenEvents(callback: (events: CalendarEvent[]) => void) {
  // No orderBy here: open plans have no "date" field, and Firestore excludes
  // docs missing the ordered field from the results, which would hide them.
  return onSnapshot(collection(db, "calendarEvents"), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CalendarEvent));
  });
}

export function listenEvent(
  eventId: string,
  callback: (event: CalendarEvent | null) => void,
) {
  return onSnapshot(doc(db, "calendarEvents", eventId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as CalendarEvent) : null);
  });
}

export async function createEvent(event: {
  title: string;
  date?: string;
  time?: string;
  createdBy: string;
}) {
  const status: PlanStatus = event.date ? "confirmed" : "open";
  const data: Record<string, unknown> = {
    title: event.title,
    status,
    attendeeIds: [event.createdBy],
    createdBy: event.createdBy,
    createdAt: serverTimestamp(),
  };
  if (event.date) data.date = event.date;
  if (event.date && event.time) data.time = event.time;
  await addDoc(collection(db, "calendarEvents"), data);
}

export async function updateEvent(
  eventId: string,
  updates: { title: string; date?: string; time?: string },
) {
  await updateDoc(doc(db, "calendarEvents", eventId), {
    title: updates.title,
    status: updates.date ? "confirmed" : "open",
    date: updates.date ? updates.date : deleteField(),
    time: updates.date && updates.time ? updates.time : deleteField(),
  });
}

export async function deleteEvent(eventId: string) {
  const batch = writeBatch(db);
  try {
    const availSnap = await getDocs(
      collection(db, "calendarEvents", eventId, "availabilities"),
    );
    availSnap.docs.forEach((a) => batch.delete(a.ref));
  } catch {
    // Firestore rules for the availabilities subcollection may not be
    // deployed on this project yet; still delete the plan itself.
  }
  batch.delete(doc(db, "calendarEvents", eventId));
  await batch.commit();
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

export function listenAvailabilities(
  eventId: string,
  callback: (availabilities: Availability[]) => void,
) {
  return onSnapshot(
    collection(db, "calendarEvents", eventId, "availabilities"),
    (snap) => {
      callback(snap.docs.map((d) => d.data() as Availability));
    },
  );
}

export async function setAvailability(
  eventId: string,
  personId: string,
  dates: string[],
) {
  await setDoc(doc(db, "calendarEvents", eventId, "availabilities", personId), {
    personId,
    dates,
  });
}

export async function finalizePlan(eventId: string, date: string, time: string) {
  await updateDoc(doc(db, "calendarEvents", eventId), {
    date,
    time: time ? time : deleteField(),
    status: "confirmed",
  });
}
