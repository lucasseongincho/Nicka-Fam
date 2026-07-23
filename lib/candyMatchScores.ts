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
import type { CandyMatchScoreRecord } from "@/lib/types";

const SCORES_COLLECTION = "candyMatchScores";

export function listenCandyMatchScores(
  callback: (scores: CandyMatchScoreRecord[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const q = query(collection(db, SCORES_COLLECTION), orderBy("bestScore", "desc"));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => d.data() as CandyMatchScoreRecord)),
    (error) => {
      // Without this handler, onSnapshot silently drops errors (e.g. a
      // rules/permission issue) and the caller's loading state never
      // resolves -- it just hangs forever with no signal why.
      console.error("candyMatchScores listener failed", error);
      onError?.(error);
    },
  );
}

/**
 * Records a finished run. Only writes if it beats the player's own best
 * (one doc per person, so there's nothing to prune). The group-best check
 * reads the current top score just before the transaction -- good enough
 * for a small trusted friend group, no need for a stronger guarantee here.
 *
 * `passedPersonId` is whoever the submitter just leapfrogged in rank (the
 * closest one below their new score, if any) -- for the "X passed Y in
 * Candy Match" push notification. bestScore only ever increases for a
 * given person, so the only rank changes possible are the submitter
 * moving up past people whose score falls in (oldBest, newScore].
 */
export async function submitCandyMatchScore(
  personId: string,
  score: number,
): Promise<{ isNewPersonalBest: boolean; isNewGroupBest: boolean; passedPersonId: string | null }> {
  const topSnap = await getDocs(
    query(collection(db, SCORES_COLLECTION), orderBy("bestScore", "desc")),
  );
  const allScores = topSnap.docs.map((d) => d.data() as CandyMatchScoreRecord);
  const previousGroupBest = allScores[0]?.bestScore ?? 0;
  const previousOwnBest = allScores.find((s) => s.personId === personId)?.bestScore ?? 0;

  const ref = doc(db, SCORES_COLLECTION, personId);
  const isNewPersonalBest = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const currentBest = snap.exists() ? (snap.data().bestScore as number) : 0;
    if (score <= currentBest) return false;
    tx.set(ref, { personId, bestScore: score, updatedAt: serverTimestamp() });
    return true;
  });

  let passedPersonId: string | null = null;
  if (isNewPersonalBest) {
    const passed = allScores
      .filter((s) => s.personId !== personId && s.bestScore > previousOwnBest && s.bestScore <= score)
      .sort((a, b) => b.bestScore - a.bestScore)[0];
    passedPersonId = passed?.personId ?? null;
  }

  return {
    isNewPersonalBest,
    isNewGroupBest: isNewPersonalBest && score > previousGroupBest,
    passedPersonId,
  };
}
