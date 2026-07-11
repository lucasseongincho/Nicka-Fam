import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { ensureClockSynced } from "@/lib/clockSync";
import { db } from "@/lib/firebase";
import type { GameRoom, GameType } from "@/lib/types";

const ROOMS_COLLECTION = "gameRooms";

export function listenRoom<TState>(
  roomId: string,
  callback: (room: GameRoom<TState> | null) => void,
) {
  void ensureClockSynced();
  return onSnapshot(doc(db, ROOMS_COLLECTION, roomId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    // "estimate" gives the writer's own client an immediate local guess for
    // serverTimestamp() fields (e.g. a round's startedAt) instead of null,
    // which then converges to the real value once the server round-trips.
    callback({
      id: snap.id,
      ...snap.data({ serverTimestamps: "estimate" }),
    } as GameRoom<TState>);
  });
}

/**
 * All non-finished rooms of this gameType, live. Lets a game's catalog card
 * show whether there's an open lobby to join (and who's in it) or a room the
 * viewer is already part of, before they even tap it.
 */
export function listenRoomsByType<TState>(
  gameType: GameType,
  callback: (rooms: GameRoom<TState>[]) => void,
) {
  void ensureClockSynced();
  const q = query(collection(db, ROOMS_COLLECTION), where("gameType", "==", gameType));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs
        .map(
          (d) =>
            ({
              id: d.id,
              ...d.data({ serverTimestamps: "estimate" }),
            }) as GameRoom<TState>,
        )
        .filter((room) => room.status !== "finished"),
    );
  });
}

export async function createRoom(
  gameType: GameType,
  createdBy: string,
  initialState: unknown,
): Promise<string> {
  const ref = await addDoc(collection(db, ROOMS_COLLECTION), {
    gameType,
    status: "lobby",
    players: [createdBy],
    createdBy,
    createdAt: serverTimestamp(),
    state: initialState,
  });
  return ref.id;
}

export async function joinRoom(roomId: string, personId: string) {
  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), {
    players: arrayUnion(personId),
  });
}

/** Moves a lobby into its playing phase with the game's own fresh state (e.g. a start timestamp). */
export async function startRoom(roomId: string, activeState: unknown) {
  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), {
    status: "active",
    state: activeState,
  });
}

/** Ends the round. By convention every game's state has an `endedAt` field. */
export async function finishRoom(roomId: string) {
  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), {
    status: "finished",
    "state.endedAt": serverTimestamp(),
  });
}
