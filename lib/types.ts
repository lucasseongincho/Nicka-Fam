import type { Timestamp } from "firebase/firestore";

/** One toggle per push-notification category. Category keys match NotifyCategory in lib/notifyClient.ts. */
export interface NotificationPrefs {
  calendar: boolean;
  photos: boolean;
  board: boolean;
  leaderboards: boolean;
  bills: boolean;
}

export interface Person {
  id: string;
  name: string;
  photoUrl: string;
  /** Absent on people created before push notifications existed -- treat as all-true, see lib/notificationPrefs.ts. */
  notificationPrefs?: NotificationPrefs;
  /** FCM device tokens for this person, one per browser/device they've enabled push on. */
  fcmTokens?: string[];
}

/**
 * One person's payment-sent status for a bill, keyed by their personId in
 * Bill.payments. Tracked per-person for the bill as a whole (not per
 * settlement transfer) since computeSettlement's netted transfers aren't
 * stable identities -- adding/editing/deleting a round can reshuffle which
 * creditor a debtor's transfer pairs with, but "I've sent my share of this
 * bill" is a statement about the person, not about one specific pairing.
 */
export interface BillPayment {
  paid: boolean;
  paidAt: Timestamp | null;
}

export interface Bill {
  id: string;
  title: string;
  participantIds: string[];
  /** denormalized from rounds, kept in sync when rounds are added */
  totalAmount: number;
  roundCount: number;
  /** personId (an ower, per computeSettlement) -> their payment status for this bill. Absent entries -- and bills predating this feature -- mean unpaid. */
  payments?: Record<string, BillPayment>;
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
  /** emoji -> personIds who reacted with it. Absent on photos uploaded before this existed -- treat as {}. */
  reactions?: Record<string, string[]>;
  /** Denormalized count of this photo's comments subcollection. Absent on legacy docs -- treat as 0. */
  commentCount?: number;
}

/** One reply, stored under photos/{photoId}/comments. Same shape as BulletinComment. */
export interface PhotoComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: Timestamp;
}

/** Extend as new mini-games are added. */
export type GameType = "tap-tap" | "whack-a-mole" | "mole" | "guess-who" | "ladder";
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

export type MoleGamePhase = "reveal" | "discuss" | "vote" | "moleGuess" | "revealed";

export interface MoleGameState {
  phase: MoleGamePhase;
  /** The secret word/topic everyone but the mole is shown. Empty in the lobby. */
  topic: string;
  /** personId secretly assigned as the mole. Empty in the lobby. */
  moleId: string;
  /** The correct topic plus decoys, shuffled once, for the mole's guess if caught. */
  wordOptions: string[];
  /** Server-resolved; set when the round starts (reveal phase begins). */
  startedAt: Timestamp | null;
  /** voterId -> suspectId */
  votes: Record<string, string>;
  /** The mole's guess at the topic, once submitted (only applicable if caught). */
  moleGuess: string | null;
  endedAt: Timestamp | null;
}

/**
 * The forehead-card guessing game (aka the Yang Se-chan game). No
 * cross-player secrecy needed here, unlike Mole -- each device only ever
 * shows its own player's keyword; "not seeing your own" is done physically
 * (phone held backwards against the forehead), not by the app.
 */
export interface GuessWhoState {
  /** personId -> their assigned identity, which THEY must not look at. */
  keywords: Record<string, string>;
  /** Server-resolved; anchors the "don't peek yet" countdown. */
  startedAt: Timestamp | null;
  /** Minimum seconds to get the phone up before the keyword is shown. */
  prepareSeconds: number;
  /** personIds in the order they confirmed (verbally) they'd guessed correctly. */
  doneOrder: string[];
  /** Whoever's left once everyone else is done; null until the round ends. */
  loserId: string | null;
  endedAt: Timestamp | null;
}

/** One horizontal connector between the column at `gapIndex` and the one right after it, at `row`. */
export interface LadderRung {
  row: number;
  gapIndex: number;
}

/**
 * 사다리게임 (ladder game / Amidakuji). Everyone sees the same generated
 * ladder immediately; only each person's own path + outcome stays hidden
 * until they tap their own "reveal" -- see lib/ladder.ts for path tracing.
 */
export interface LadderState {
  /** One label per BOTTOM column position (0..players.length-1) -- fixed labels the paths land on, independent of who started where. */
  outcomes: string[];
  /** personId -> their starting (top) column index. Generated once at start, shared by everyone. */
  playerColumns: Record<string, number>;
  /** The rung layout, generated once by whoever starts the game -- never regenerated per-client. */
  ladderStructure: LadderRung[];
  /** How many rows tall the ladder is, stored alongside the rungs so every client renders an identical grid. */
  rowCount: number;
  /** personId -> whether they've tapped "reveal my result" yet. */
  revealed: Record<string, boolean>;
  startedAt: Timestamp | null;
  endedAt: Timestamp | null;
}

/**
 * Suika (watermelon merge game). Solo play, not a gameRoom -- one document
 * per person in `suikaScores`, keyed by personId, holding only their
 * best-ever run so the leaderboard is a simple sorted read.
 */
export interface SuikaScoreRecord {
  personId: string;
  bestScore: number;
  updatedAt: Timestamp;
}

/**
 * 2048 (face-tile merge game). Solo play, same one-doc-per-person shape as
 * SuikaScoreRecord -- see `twentyFortyEightScores`.
 */
export interface TwentyFortyEightScoreRecord {
  personId: string;
  bestScore: number;
  updatedAt: Timestamp;
}

/**
 * Candy match (match-3 game). Solo play, same one-doc-per-person shape as
 * SuikaScoreRecord -- see `candyMatchScores`.
 */
export interface CandyMatchScoreRecord {
  personId: string;
  bestScore: number;
  updatedAt: Timestamp;
}

/**
 * Dino Runner (endless runner). Solo play, same one-doc-per-person shape as
 * SuikaScoreRecord -- see `dinoRunnerScores`.
 */
export interface DinoRunnerScoreRecord {
  personId: string;
  bestScore: number;
  updatedAt: Timestamp;
}

/**
 * Bubble Bobble (trap-and-pop platformer). Solo play, same one-doc-per-person
 * shape as SuikaScoreRecord -- see `bubbleBobbleScores`.
 */
export interface BubbleBobbleScoreRecord {
  personId: string;
  bestScore: number;
  updatedAt: Timestamp;
}

/**
 * Bulletin board post -- one doc per thought in `bulletinPosts`, newest
 * first. `commentCount` is denormalized (kept in sync when comments are
 * added/removed) the same way Bill.roundCount is, so the feed can show a
 * count without subscribing to every post's comments subcollection.
 */
export interface BulletinPost {
  id: string;
  authorId: string;
  text: string;
  /** emoji -> personIds who reacted with it. A person may react with more than one emoji. */
  reactions: Record<string, string[]>;
  commentCount: number;
  createdAt: Timestamp;
}

/** One reply, stored under bulletinPosts/{postId}/comments. */
export interface BulletinComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: Timestamp;
}

/**
 * T-shirt design vote submission -- one doc per uploaded design in
 * `voteDesigns`. Deliberately holds no uploader identity: that lives
 * write-only in `voteDesignUploaders/{designId}` (see lib/votes.ts) so it can
 * never be listed/read back to any client, even though this doc itself is
 * fully public (the gallery needs to list every design).
 */
export interface VoteDesign {
  id: string;
  imageUrl: string;
  /** Cloudinary public_id, kept for reference (deletion isn't wired up) */
  publicId: string;
  /** Denormalized, kept in sync by castVote's batched increment/decrement. */
  voteCount: number;
  createdAt: Timestamp;
}

/**
 * One doc per person, keyed by personId, in `votes`. Firestore rules allow
 * `get` (so a person can read back their own vote by their own known ID,
 * live, cross-device) but deny `list` entirely -- no query anywhere can ever
 * enumerate who voted for what, which is the actual anonymity guarantee.
 */
export interface DesignVote {
  voterId: string;
  designId: string;
  updatedAt: Timestamp;
}

/** Single shared flag doc at voteSession/current. Absent doc == open (voting hasn't been explicitly closed yet). */
export interface VoteSession {
  open: boolean;
  updatedAt: Timestamp;
}
