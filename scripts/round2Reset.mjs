// One-time migration: transition the t-shirt design vote from round 1 to
// round 2. Determines the top 3 designs by voteCount (ties at the 3rd-place
// boundary are all included), resets every design's voteCount to 0, stamps
// eligibleRound2 on each voteDesigns doc, and reopens voting.
//
// Does NOT delete the `votes` collection itself -- firestore.rules
// unconditionally denies `delete` on `votes/{personId}` for every client (by
// design, so no one can be forced to un-vote), so that collection must be
// bulk-deleted by hand in the Firebase Console (Firestore Data tab -> votes
// -> "..." -> Delete collection) before/after running this script. Order
// doesn't matter -- voteCount lives on voteDesigns, not on the vote docs.
//
// Run with: npm run round2-reset -- --dry-run   (preview only, no writes)
//           npm run round2-reset                (performs the reset)
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

const DRY_RUN = process.argv.includes("--dry-run");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 1. Read current vote counts, determine round-2-eligible designs ---
const designsSnap = await getDocs(collection(db, "voteDesigns"));
const designs = designsSnap.docs.map((d) => ({ id: d.id, voteCount: d.data().voteCount ?? 0 }));
designs.sort((a, b) => b.voteCount - a.voteCount);

let eligibleIds;
if (designs.length <= 3) {
  eligibleIds = new Set(designs.map((d) => d.id));
} else {
  const thirdPlaceCount = designs[2].voteCount;
  eligibleIds = new Set(designs.filter((d) => d.voteCount >= thirdPlaceCount).map((d) => d.id));
}

console.log(`Found ${designs.length} designs. Round 2 eligible (${eligibleIds.size}):`);
designs.forEach((d) => {
  console.log(`  ${eligibleIds.has(d.id) ? "[ELIGIBLE]" : "          "} ${d.id} — ${d.voteCount} votes`);
});

if (DRY_RUN) {
  console.log("\n--dry-run set: no writes performed.");
  process.exit(0);
}

// --- 2. Stamp eligibleRound2 on every voteDesigns doc, reset voteCount to 0 ---
let batch = writeBatch(db);
let opCount = 0;
for (const design of designs) {
  batch.update(doc(db, "voteDesigns", design.id), {
    eligibleRound2: eligibleIds.has(design.id),
    voteCount: 0,
  });
  opCount++;
  if (opCount === 400) {
    await batch.commit();
    batch = writeBatch(db);
    opCount = 0;
  }
}
if (opCount > 0) await batch.commit();
console.log("\neligibleRound2 set + voteCount reset to 0 on all designs.");

// --- 3. Reopen voting for round 2 ---
const sessionBatch = writeBatch(db);
sessionBatch.set(
  doc(db, "voteSession", "current"),
  { open: true, updatedAt: serverTimestamp() },
  { merge: true },
);
await sessionBatch.commit();
console.log("voteSession reopened.");

console.log(
  "\nRound 2 reset complete for voteDesigns/voteSession.\n" +
    "REMINDER: the `votes` collection has NOT been touched (rules forbid client-side delete).\n" +
    "Manually delete it now in the Firebase Console: Firestore -> Data -> `votes` -> \"...\" -> Delete collection.",
);
process.exit(0);
