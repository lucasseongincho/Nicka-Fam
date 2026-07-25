import { onDisconnect, onValue, ref, remove, runTransaction, set, update } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import {
  SNAKE_ORB_COLORS,
  SNAKE_ORB_COUNT_TARGET,
  SNAKE_ORB_RADIUS,
  type Orb,
  type SnakeEntity,
  pickRandom,
  randomArenaPoint,
} from "@/lib/snakeConfig";

// Client-only. RTDB (not Firestore) carries every high-frequency read/write
// for this game -- positions, orbs, scores -- since Firestore isn't suited
// to 10Hz-per-player writes. Firestore (lib/gameRooms.ts) still owns the
// lobby/join/leave/host-promotion side, same as every other game.

function matchPath(roomId: string): string {
  return `matches/${roomId}`;
}
function snakesPath(roomId: string): string {
  return `${matchPath(roomId)}/snakes`;
}
function snakePath(roomId: string, entityId: string): string {
  return `${snakesPath(roomId)}/${entityId}`;
}
function orbsPath(roomId: string): string {
  return `${matchPath(roomId)}/orbs`;
}
function orbPath(roomId: string, orbId: string): string {
  return `${orbsPath(roomId)}/${orbId}`;
}
function seedLockPath(roomId: string): string {
  return `${matchPath(roomId)}/orbsSeeded`;
}

export function listenSnakes(
  roomId: string,
  callback: (snakes: Record<string, SnakeEntity>) => void,
) {
  return onValue(ref(rtdb, snakesPath(roomId)), (snap) => callback(snap.val() ?? {}));
}

export function listenOrbs(roomId: string, callback: (orbs: Record<string, Orb>) => void) {
  return onValue(ref(rtdb, orbsPath(roomId)), (snap) => callback(snap.val() ?? {}));
}

export async function writeSnakeNode(roomId: string, entityId: string, data: SnakeEntity) {
  await set(ref(rtdb, snakePath(roomId, entityId)), data);
}

export async function patchSnakeNode(
  roomId: string,
  entityId: string,
  patch: Partial<SnakeEntity>,
) {
  await update(ref(rtdb, snakePath(roomId, entityId)), patch);
}

export async function removeSnakeNode(roomId: string, entityId: string) {
  await remove(ref(rtdb, snakePath(roomId, entityId)));
}

/** Has RTDB itself delete this snake node if the connection drops without a clean unmount (closed tab, lost signal) -- avoids ghost snakes blocking the arena forever. Human players only; bots have no connection to lose. */
export function registerSnakeDisconnectCleanup(roomId: string, entityId: string) {
  void onDisconnect(ref(rtdb, snakePath(roomId, entityId))).remove();
}

function randomOrbId(): string {
  return `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function addOrbs(roomId: string, orbs: Orb[]) {
  if (orbs.length === 0) return;
  const updates: Record<string, Orb> = {};
  for (const orb of orbs) updates[randomOrbId()] = orb;
  await update(ref(rtdb, orbsPath(roomId)), updates);
}

/**
 * Atomically removes one orb. Two players can touch the same orb the same
 * frame -- only the transaction that actually observes a non-null value
 * "wins" (committed: true); the loser's update function sees current ===
 * null (someone beat them to it) and returns undefined to abort cleanly
 * rather than write over an already-consumed orb.
 */
export async function claimOrb(roomId: string, orbId: string): Promise<boolean> {
  const result = await runTransaction(ref(rtdb, orbPath(roomId, orbId)), (current) => {
    if (current === null) return undefined;
    return null;
  });
  return result.committed;
}

/**
 * One-time initial orb scatter for a fresh match, guarded by a lock node so
 * a host reconnect (or two clients both noticing "no orbs yet" at once)
 * can't double-seed -- same claim-via-transaction idiom as claimOrb, just
 * on a boolean flag instead of an orb.
 */
export async function seedInitialOrbsIfNeeded(roomId: string) {
  const result = await runTransaction(ref(rtdb, seedLockPath(roomId)), (current) => {
    if (current) return undefined;
    return true;
  });
  if (!result.committed) return;

  const orbs: Orb[] = Array.from({ length: SNAKE_ORB_COUNT_TARGET }, () => ({
    ...randomArenaPoint(SNAKE_ORB_RADIUS * 2),
    value: 1,
    color: pickRandom(SNAKE_ORB_COLORS),
  }));
  await addOrbs(roomId, orbs);
}

/** Removes an entire match's RTDB state -- called once the last human leaves (see leaveActiveRoom in lib/gameRooms.ts). */
export async function clearMatch(roomId: string) {
  await remove(ref(rtdb, matchPath(roomId)));
}
