import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SuikaScoreRecord } from "@/lib/types";

const SCORES_COLLECTION = "suikaScores";

export function listenSuikaScores(callback: (scores: SuikaScoreRecord[]) => void) {
  const q = query(collection(db, SCORES_COLLECTION), orderBy("bestScore", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as SuikaScoreRecord));
  });
}

/**
 * Records a finished run. Only writes if it beats the player's own best
 * (one doc per person, so there's nothing to prune). The group-best check
 * reads the current top score just before the transaction -- good enough
 * for a small trusted friend group, no need for a stronger guarantee here.
 */
export async function submitSuikaScore(
  personId: string,
  score: number,
): Promise<{ isNewPersonalBest: boolean; isNewGroupBest: boolean }> {
  const topSnap = await getDocs(
    query(collection(db, SCORES_COLLECTION), orderBy("bestScore", "desc")),
  );
  const previousGroupBest = (topSnap.docs[0]?.data() as SuikaScoreRecord | undefined)
    ?.bestScore ?? 0;

  const ref = doc(db, SCORES_COLLECTION, personId);
  const isNewPersonalBest = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const currentBest = snap.exists() ? (snap.data().bestScore as number) : 0;
    if (score <= currentBest) return false;
    tx.set(ref, { personId, bestScore: score, updatedAt: serverTimestamp() });
    return true;
  });

  return {
    isNewPersonalBest,
    isNewGroupBest: isNewPersonalBest && score > previousGroupBest,
  };
}
