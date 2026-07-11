import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GameRoom, GameType } from "@/lib/types";

const ROOMS_COLLECTION = "gameRooms";

export function listenRoom<TState>(
  roomId: string,
  callback: (room: GameRoom<TState> | null) => void,
) {
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

/** An open lobby for this game type that anyone can still join, if one exists. */
export async function findOpenRoom(gameType: GameType): Promise<string | null> {
  const q = query(
    collection(db, ROOMS_COLLECTION),
    where("gameType", "==", gameType),
    where("status", "==", "lobby"),
    limit(1),
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].id;
}

/** A room of this gameType the person is already in (lobby or active), so re-tapping a game card resumes their game instead of spawning a duplicate. */
export async function findMyActiveRoom(
  gameType: GameType,
  personId: string,
): Promise<string | null> {
  const q = query(
    collection(db, ROOMS_COLLECTION),
    where("players", "array-contains", personId),
  );
  const snap = await getDocs(q);
  const match = snap.docs.find((d) => {
    const data = d.data();
    return data.gameType === gameType && data.status !== "finished";
  });
  return match?.id ?? null;
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

/** Resets a finished room back to a fresh lobby, keeping the same players. */
export async function resetToLobby(roomId: string, freshState: unknown) {
  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), {
    status: "lobby",
    state: freshState,
  });
}
