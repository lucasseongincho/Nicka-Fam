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

export type PlanStatus = "confirmed" | "open";

export interface CalendarEvent {
  id: string;
  title: string;
  /** ISO date, e.g. "2026-07-16". Absent when status is "open". */
  date?: string;
  time?: string;
  /** Absent on legacy docs written before this field existed; treat as "confirmed" if date is set. */
  status?: PlanStatus;
  attendeeIds: string[];
  createdBy: string;
  createdAt: Timestamp;
}

/** One doc per person, keyed by personId, under calendarEvents/{eventId}/availabilities */
export interface Availability {
  personId: string;
  /** ISO date strings this person marked as available for this plan */
  dates: string[];
}

export interface Photo {
  id: string;
  /** Cloudinary public_id, kept for reference (deletion isn't wired up) */
  publicId: string;
  url: string;
  caption: string;
  uploadedBy: string;
  createdAt: Timestamp;
}

/** Extend as new mini-games are added; only "tap-tap" is playable so far. */
export type GameType = "tap-tap" | "whack-a-mole" | "social-deduction";
export type GameRoomStatus = "lobby" | "active" | "finished";

/** Shared shape for every mini-game room; `state` shape depends on gameType. */
export interface GameRoom<TState = Record<string, unknown>> {
  id: string;
  gameType: GameType;
  status: GameRoomStatus;
  players: string[];
  createdBy: string;
  createdAt: Timestamp;
  state: TState;
}

export interface TapTapState {
  durationSeconds: number;
  /** "Get ready" seconds between startedAt and taps actually counting. */
  prepareSeconds: number;
  /** Server-resolved; null until the round-start write round-trips. */
  startedAt: Timestamp | null;
  endedAt: Timestamp | null;
  taps: Record<string, number>;
}

/** One mole's appearance window, in ms offset from the round's start (after prepareSeconds). */
export interface WhackItMole {
  cell: number;
  showAtMs: number;
  hideAtMs: number;
}

export interface WhackItState {
  durationSeconds: number;
  /** "Get ready" seconds between startedAt and the schedule actually starting. */
  prepareSeconds: number;
  gridSize: number;
  /** Server-resolved; null until the round-start write round-trips. */
  startedAt: Timestamp | null;
  endedAt: Timestamp | null;
  /** Generated once by whoever starts the round, so every player faces the same sequence. */
  schedule: WhackItMole[];
  scores: Record<string, number>;
}
