import {
  collection,
  doc,
  type FirestoreError,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DinoRunnerScoreRecord } from "@/lib/types";

const SCORES_COLLECTION = "dinoRunnerScores";

export function listenDinoRunnerScores(
  callback: (scores: DinoRunnerScoreRecord[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const q = query(collection(db, SCORES_COLLECTION), orderBy("bestScore", "desc"));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => d.data() as DinoRunnerScoreRecord)),
    (error) => {
      // Without this handler, onSnapshot silently drops errors (e.g. a
      // rules/permission issue) and the caller's loading state never
      // resolves -- it just hangs forever with no signal why.
      console.error("dinoRunnerScores listener failed", error);
      onError?.(error);
    },
  );
}

/**
 * Records a finished run. Only writes if it beats the player's own best
 * (one doc per person, so there's nothing to prune). The group-best check
 * reads the current top score just before the transaction -- good enough
 * for a small trusted friend group, no need for a stronger guarantee here.
 */
export async function submitDinoRunnerScore(
  personId: string,
  score: number,
): Promise<{ isNewPersonalBest: boolean; isNewGroupBest: boolean }> {
  const topSnap = await getDocs(
    query(collection(db, SCORES_COLLECTION), orderBy("bestScore", "desc")),
  );
  const previousGroupBest = (topSnap.docs[0]?.data() as DinoRunnerScoreRecord | undefined)
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
