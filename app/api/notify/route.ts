import { sendCategoryNotification } from "@/lib/pushAdmin";
import type { NotifyCategory } from "@/lib/notifyClient";

export const runtime = "nodejs";

const CATEGORIES: NotifyCategory[] = ["calendar", "photos", "board", "leaderboards", "bills"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !CATEGORIES.includes(body.category) || !body.actorId || !body.title || !body.body) {
    return new Response("invalid notify payload", { status: 400 });
  }

  try {
    await sendCategoryNotification({
      category: body.category,
      actorId: body.actorId,
      title: body.title,
      body: body.body,
      url: typeof body.url === "string" ? body.url : undefined,
      recipientOverride: body.recipientOverride,
      recipientIds: Array.isArray(body.recipientIds) ? body.recipientIds : undefined,
    });
  } catch (err) {
    // A push failure should never surface as an error to whoever just
    // finished posting/uploading/playing -- log it and respond fine.
    console.error("sendCategoryNotification failed", err);
  }

  return new Response(null, { status: 204 });
}
