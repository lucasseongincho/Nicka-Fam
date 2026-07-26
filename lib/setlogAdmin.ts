import { getFirestore } from "firebase-admin/firestore";
import { adminApp, sendCategoryNotification } from "@/lib/pushAdmin";
import { etDateString, etHour, isWithinNotifyHours, setlogSlotId } from "@/lib/setlogTime";

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
 * Lazily creates the current ET hour's slot doc if it doesn't exist yet --
 * every hour of the day gets one, not just the notification window -- and
 * sends the "time to capture" push the first time a slot inside the
 * notification window (6am-11pm ET) gets its `notifiedAt` set. Runs inside a
 * transaction so two overlapping ticks can't double-send. Gating on
 * `notifiedAt` specifically (not mere doc existence) means a person who
 * opens the app and records before this tick ever runs -- which
 * pre-creates the doc via submitSetlogClip's upsert -- still gets the rest
 * of the group notified once this tick catches up. Returns whether this
 * call is the one that sent the notification.
 */
async function ensureCurrentSlot(db: FirebaseFirestore.Firestore, now: Date): Promise<boolean> {
  const hour = etHour(now);
  const date = etDateString(now);
  const slotId = setlogSlotId(date, hour);
  const ref = db.collection("setlogSlots").doc(slotId);
  const shouldNotify = isWithinNotifyHours(hour);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const alreadyNotified = snap.exists && !!snap.data()?.notifiedAt;
    if (alreadyNotified || !shouldNotify) {
      if (!snap.exists) {
        tx.set(ref, { date, hour, notifiedAt: null, submittedPersonIds: [] });
      }
      return false;
    }
    // merge, and only seed submittedPersonIds on a brand-new doc -- a plain
    // overwrite here could stomp an array a racing client upsert just wrote.
    tx.set(
      ref,
      { date, hour, notifiedAt: now, ...(snap.exists ? {} : { submittedPersonIds: [] }) },
      { merge: true },
    );
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
  const notified = await ensureCurrentSlot(db, now);

  if (notified) {
    await sendCategoryNotification({
      category: "setlog",
      actorId: "__setlog_system__",
      title: "time to capture your moment!",
      body: "open Setlog and record your clip for this hour.",
      url: "/setlog",
    });
  }

  return { ranAdmin: true, notifiedNewSlot: notified };
}
