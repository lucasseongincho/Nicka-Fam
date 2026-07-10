import type { Timestamp } from "firebase/firestore";

export interface Person {
  id: string;
  name: string;
  photoUrl: string;
}

export interface Bill {
  id: string;
  title: string;
  participantIds: string[];
  /** denormalized from rounds, kept in sync when rounds are added */
  totalAmount: number;
  roundCount: number;
  createdBy: string;
  createdAt: Timestamp;
}

export interface Round {
  id: string;
  label: string;
  amount: number;
  payerId: string;
  participantIds: string[];
  /** personIds who opted out of the "drink" portion of this round's cost */
  noDrinkIds: string[];
  order: number;
  createdBy: string;
  createdAt: Timestamp;
}

export interface CalendarEvent {
  id: string;
  title: string;
  /** ISO date, e.g. "2026-07-16" */
  date: string;
  time: string;
  attendeeIds: string[];
  createdBy: string;
  createdAt: Timestamp;
}

export interface Photo {
  id: string;
  storagePath: string;
  url: string;
  caption: string;
  uploadedBy: string;
  createdAt: Timestamp;
}
