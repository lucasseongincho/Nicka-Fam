import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { adminApp, sendCategoryNotification } from "@/lib/pushAdmin";
import { mergeAndUploadSetlogClips } from "@/lib/setlogMerge";
import {
  SETLOG_ACTIVE_HOURS_END,
  SETLOG_ACTIVE_HOURS_START,
  SETLOG_TIMEZONE,
  SETLOG_WINDOW_MINUTES,
  etDateString,
  etYesterdayDateString,
  generateSetlogSlotTimes,
} from "@/lib/setlogTime";

// Server-only module -- same firebase-admin/no-Blaze-plan constraints as
// lib/pushAdmin.ts. Everything here is driven by app/api/setlog/tick,
// which an external free scheduler (e.g. cron-job.org) pings roughly once
// a minute, since Vercel's own free-tier cron can't do fine-grained
// intraday schedules. Deliberately uses firebase-admin/firestore's own
// Timestamp type throughout (not the client-SDK Timestamp lib/types.ts
// re-exports) -- the two aren't interchangeable, and this module never
// hands its data back to client code anyway.

interface AdminSlot {
  id: string;
  scheduledAt: Timestamp;
  notifiedAt: Timestamp | null;
}

interface AdminPromptsDay {
  date: string;
  slots: AdminSlot[];
}

/**
 * Lazily generates a day's 3-5 random capture times the first time any
 * tick sees that ET calendar date, inside a transaction so two overlapping
 * ticks can't both generate (and thus double-schedule) the same day.
 */
async function ensureDayPrompts(
  db: FirebaseFirestore.Firestore,
  dateStr: string,
): Promise<void> {
  const ref = db.collection("setlogPrompts").doc(dateStr);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return;

    const slots: AdminSlot[] = generateSetlogSlotTimes(dateStr).map((d, i) => ({
      id: `s${i}`,
      scheduledAt: Timestamp.fromDate(d),
      notifiedAt: null,
    }));

    tx.set(ref, {
      date: dateStr,
      timezone: SETLOG_TIMEZONE,
      activeHoursStart: SETLOG_ACTIVE_HOURS_START,
      activeHoursEnd: SETLOG_ACTIVE_HOURS_END,
      slots,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Sends the "time to capture your moment!" push for every slot in today's
 * prompts whose scheduled time has arrived but hasn't fired yet, then marks
 * those slots notified inside the same transaction that reads them --
 * closing the race where two overlapping ticks both see notifiedAt: null
 * and both send.
 */
async function sendDueSlotNotifications(
  db: FirebaseFirestore.Firestore,
  dateStr: string,
  now: Date,
): Promise<number> {
  const ref = db.collection("setlogPrompts").doc(dateStr);

  const dueSlotIds = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return [];
    const data = snap.data() as AdminPromptsDay;

    const due = data.slots.filter((s) => !s.notifiedAt && s.scheduledAt.toMillis() <= now.getTime());
    if (due.length === 0) return [];

    const updatedSlots = data.slots.map((s) =>
      due.some((d) => d.id === s.id) ? { ...s, notifiedAt: Timestamp.fromDate(now) } : s,
    );
    tx.update(ref, { slots: updatedSlots });
    return due.map((s) => s.id);
  });

  if (dueSlotIds.length === 0) return 0;

  // One shared notification per due slot (not per person) -- everyone gets
  // prompted at once. actorId is a value no real personId will ever equal,
  // since this is server-generated with no "actor" to exclude. Content is
  // identical regardless of which slot, so these can fire in parallel.
  await Promise.all(
    dueSlotIds.map(() =>
      sendCategoryNotification({
        category: "setlog",
        actorId: "__setlog_system__",
        title: "time to capture your moment!",
        body: "you've got 8 minutes — open Setlog and record your clip.",
        url: "/setlog",
      }),
    ),
  );

  return dueSlotIds.length;
}

/** True once every slot's 8-minute capture window has closed for the day. */
function allWindowsClosed(slots: AdminSlot[], now: Date): boolean {
  if (slots.length === 0) return false;
  const last = slots[slots.length - 1];
  return now.getTime() >= last.scheduledAt.toMillis() + SETLOG_WINDOW_MINUTES * 60_000;
}

/**
 * Runs the ffmpeg merge for one day and writes the result to setlogDays.
 * Groups clips by slot (in prompt order), skips slots nobody submitted to,
 * and records who missed each slot (everyone in `people` minus that slot's
 * submitters) even when the slot's segment was skipped entirely.
 */
async function mergeDay(
  db: FirebaseFirestore.Firestore,
  dateStr: string,
  slots: AdminSlot[],
): Promise<void> {
  const dayRef = db.collection("setlogDays").doc(dateStr);

  const [clipsSnap, peopleSnap] = await Promise.all([
    db.collection("setlogClips").where("date", "==", dateStr).orderBy("createdAt", "asc").get(),
    db.collection("people").get(),
  ]);

  const allPersonIds = peopleSnap.docs.map((d) => d.id);

  const clipsBySlot = new Map<string, { personId: string; videoUrl: string }[]>();
  for (const doc of clipsSnap.docs) {
    const clip = doc.data() as { personId: string; slotId: string; videoUrl: string };
    const bucket = clipsBySlot.get(clip.slotId) ?? [];
    bucket.push({ personId: clip.personId, videoUrl: clip.videoUrl });
    clipsBySlot.set(clip.slotId, bucket);
  }

  const daySlotsMeta = slots.map((slot) => {
    const clips = clipsBySlot.get(slot.id) ?? [];
    const participantIds = clips.map((c) => c.personId);
    return {
      id: slot.id,
      scheduledAt: slot.scheduledAt,
      participantIds,
      missedIds: allPersonIds.filter((id) => !participantIds.includes(id)),
    };
  });

  const orderedClips = slots.flatMap((slot) => clipsBySlot.get(slot.id) ?? []);

  if (orderedClips.length === 0) {
    await dayRef.set(
      {
        date: dateStr,
        status: "no_clips",
        mergedVideoUrl: null,
        mergedPublicId: null,
        slots: daySlotsMeta,
        mergedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  const { url, publicId } = await mergeAndUploadSetlogClips(orderedClips.map((c) => c.videoUrl));

  await dayRef.set(
    {
      date: dateStr,
      status: "ready",
      mergedVideoUrl: url,
      mergedPublicId: publicId,
      slots: daySlotsMeta,
      mergedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Checks today and yesterday's ET dates (yesterday as catch-up, in case the
 * external pinger had downtime right around midnight) and merges any day
 * whose last window has closed and hasn't been merged/isn't already being
 * merged. Claims a day by writing status "merging" before doing any ffmpeg
 * work, so a second overlapping tick skips it instead of double-merging.
 */
async function mergeDueDays(db: FirebaseFirestore.Firestore, now: Date): Promise<void> {
  for (const dateStr of [etYesterdayDateString(now), etDateString(now)]) {
    const promptsSnap = await db.collection("setlogPrompts").doc(dateStr).get();
    if (!promptsSnap.exists) continue;
    const { slots } = promptsSnap.data() as AdminPromptsDay;
    if (!allWindowsClosed(slots, now)) continue;

    const dayRef = db.collection("setlogDays").doc(dateStr);
    const claimed = await db.runTransaction(async (tx) => {
      const daySnap = await tx.get(dayRef);
      const status = daySnap.data()?.status;
      if (status === "merging" || status === "ready" || status === "no_clips") return false;
      tx.set(
        dayRef,
        { date: dateStr, status: "merging", mergedVideoUrl: null, mergedPublicId: null, slots: [], mergedAt: null },
        { merge: true },
      );
      return true;
    });
    if (!claimed) continue;

    try {
      await mergeDay(db, dateStr, slots);
    } catch (err) {
      console.error(`setlog merge failed for ${dateStr}`, err);
      await dayRef.set({ status: "error" }, { merge: true });
    }
  }
}

export interface SetlogTickResult {
  ranAdmin: boolean;
  notificationsSent: number;
}

/**
 * Entry point called by app/api/setlog/tick on every ping: ensures today's
 * prompt times exist, fires any due notifications, and merges any day
 * that's ready. Returns ranAdmin: false (a no-op) when firebase-admin
 * credentials aren't configured, same degrade-quietly pattern as
 * sendCategoryNotification.
 */
export async function runSetlogTick(): Promise<SetlogTickResult> {
  const app = adminApp();
  if (!app) return { ranAdmin: false, notificationsSent: 0 };

  const db = getFirestore(app);
  const now = new Date();
  const todayStr = etDateString(now);

  await ensureDayPrompts(db, todayStr);
  const notificationsSent = await sendDueSlotNotifications(db, todayStr, now);
  await mergeDueDays(db, now);

  return { ranAdmin: true, notificationsSent };
}
