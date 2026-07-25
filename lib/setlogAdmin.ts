import { getFirestore } from "firebase-admin/firestore";
import { adminApp, sendCategoryNotification } from "@/lib/pushAdmin";
import { etDateString, etHour, isWithinActiveHours, setlogSlotId } from "@/lib/setlogTime";

// Server-only module -- same firebase-admin/no-Blaze-plan constraints as
// lib/pushAdmin.ts. Driven by app/api/setlog/tick, which an external free
// scheduler (e.g. cron-job.org) pings roughly once a minute, since
// Vercel's free-tier cron can't do fine-grained intraday schedules.
//
// There is no merge step in this design -- every person's clip stays its
// own standalone doc/video (see lib/setlog.ts), so this module's only job
// is: the first tick that observes the clock has reached a new active-hour
// slot creates that slot's doc and fires its "time to capture" push.

/**
 * Lazily creates the current ET hour's slot doc (if we're inside active
 * hours and it doesn't exist yet) inside a transaction, so two overlapping
 * ticks can't both create it and thus double-send the notification. Returns
 * whether this call is the one that created it.
 */
async function ensureCurrentSlot(db: FirebaseFirestore.Firestore, now: Date): Promise<boolean> {
  const hour = etHour(now);
  if (!isWithinActiveHours(hour)) return false;

  const date = etDateString(now);
  const slotId = setlogSlotId(date, hour);
  const ref = db.collection("setlogSlots").doc(slotId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return false;
    tx.set(ref, { date, hour, notifiedAt: now, submittedPersonIds: [] });
    return true;
  });
}

export interface SetlogTickResult {
  ranAdmin: boolean;
  notifiedNewSlot: boolean;
}

/**
 * Entry point called by app/api/setlog/tick on every ping. Returns
 * ranAdmin: false (a no-op) when firebase-admin credentials aren't
 * configured, same degrade-quietly pattern as sendCategoryNotification.
 */
export async function runSetlogTick(): Promise<SetlogTickResult> {
  const app = adminApp();
  if (!app) return { ranAdmin: false, notifiedNewSlot: false };

  const db = getFirestore(app);
  const now = new Date();
  const created = await ensureCurrentSlot(db, now);

  if (created) {
    await sendCategoryNotification({
      category: "setlog",
      actorId: "__setlog_system__",
      title: "time to capture your moment!",
      body: "open Setlog and record your clip for this hour.",
      url: "/setlog",
    });
  }

  return { ranAdmin: true, notifiedNewSlot: created };
}
