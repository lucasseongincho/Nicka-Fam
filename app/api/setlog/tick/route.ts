import { runSetlogTick } from "@/lib/setlogAdmin";

export const runtime = "nodejs";

/**
 * Pinged roughly once a minute by an external free scheduler (e.g.
 * cron-job.org) -- see .env.local.example for setup notes. There's no
 * Vercel-native cron here on purpose: the free tier only supports
 * once-a-day schedules, and this needs to notice the top of every active
 * hour (6am-11pm ET).
 *
 * Protected by a shared secret (query param or header) so this can't be
 * used by a stranger to spam pushes. If the secret isn't configured yet,
 * this degrades to open-but-logged rather than hard-failing, matching
 * pushAdmin's "missing config -> warn and no-op" style (runSetlogTick
 * itself still no-ops without firebase-admin creds).
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.SETLOG_CRON_SECRET;
  if (!expected) {
    console.warn("SETLOG_CRON_SECRET isn't set -- /api/setlog/tick is unauthenticated");
    return true;
  }
  const url = new URL(request.url);
  const provided = url.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === expected;
}

async function handleTick(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const result = await runSetlogTick();
    return Response.json(result);
  } catch (err) {
    console.error("setlog tick failed", err);
    return new Response("setlog tick failed", { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleTick(request);
}

export async function POST(request: Request) {
  return handleTick(request);
}
