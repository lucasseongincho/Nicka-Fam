import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

let offsetMs = 0;
let calibrating: Promise<void> | null = null;

/**
 * Local clock corrected by this device's measured offset from Firestore's
 * server clock. A device's own system clock can be wrong by a second or
 * more (common on phones) even though network latency is a non-issue --
 * serverTimestamp() already accounts for that. Any game timing math should
 * use this instead of Date.now() directly.
 */
export function syncedNow(): number {
  return Date.now() + offsetMs;
}

/**
 * Fire-and-forget: measures this device's clock offset once per session by
 * round-tripping a write through serverTimestamp() and comparing the
 * server-resolved time to this device's clock when the write confirms.
 * Safe to call repeatedly/from multiple places -- only the first call does
 * any work, and Firestore tracks pending writes per client, so many devices
 * calibrating against the same doc don't interfere with each other.
 */
export function ensureClockSynced(): Promise<void> {
  if (calibrating) return calibrating;

  calibrating = new Promise((resolve) => {
    const ref = doc(db, "clockSync", "offset");
    const sentAt = Date.now();
    const unsubscribe = onSnapshot(ref, (snap) => {
      const ts = snap.data()?.ts;
      if (ts && !snap.metadata.hasPendingWrites) {
        // Assume symmetric latency and treat the server as having stamped
        // ts at the round-trip's midpoint; using the receive time alone
        // would leave a systematic bias equal to the return-leg latency.
        const confirmedAt = Date.now();
        offsetMs = ts.toMillis() - (sentAt + confirmedAt) / 2;
        unsubscribe();
        resolve();
      }
    });
    void setDoc(ref, { ts: serverTimestamp() });
  });

  return calibrating;
}
