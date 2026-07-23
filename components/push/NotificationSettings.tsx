"use client";

import { useEffect, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { usePeople } from "@/contexts/PersonContext";
import { getNotificationPrefs, updateNotificationPrefs } from "@/lib/notificationPrefs";
import { isPushSupported, requestNotificationPermission } from "@/lib/push";
import type { NotificationPrefs } from "@/lib/types";

const CATEGORY_LABELS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: "calendar", label: "calendar" },
  { key: "photos", label: "photos" },
  { key: "board", label: "bulletin board" },
  { key: "leaderboards", label: "leaderboards" },
];

export function NotificationSettings() {
  const { activePerson, activePersonId } = usePeople();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Notification.permission is only readable client-side; this one-time read must happen post-mount to avoid an SSR/hydration mismatch, same reasoning as PersonContext's activePersonId read.
    setPermission(isPushSupported() ? Notification.permission : "unsupported");
  }, []);

  if (!activePerson || !activePersonId) return null;

  const prefs = getNotificationPrefs(activePerson);

  const enablePush = async () => {
    setRequesting(true);
    await requestNotificationPermission(activePersonId);
    setPermission(isPushSupported() ? Notification.permission : "unsupported");
    setRequesting(false);
  };

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
        push notifications
      </p>

      {permission === "unsupported" ? (
        <p className="mb-4 text-sm text-ink/50">
          this browser doesn&apos;t support push notifications.
        </p>
      ) : permission === "granted" ? (
        <p className="mb-4 text-sm text-teal">notifications are on for this device ✓</p>
      ) : permission === "denied" ? (
        <p className="mb-4 text-sm text-ink/50">
          notifications are blocked for this site in your browser settings.
        </p>
      ) : (
        <Button onClick={enablePush} disabled={requesting} className="mb-4 w-full">
          {requesting ? "asking..." : "enable notifications"}
        </Button>
      )}

      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
        notify me about
      </p>
      <div className="mb-1 flex flex-wrap gap-1.5">
        {CATEGORY_LABELS.map(({ key, label }) => (
          <Chip
            key={key}
            active={prefs[key]}
            onClick={() => void updateNotificationPrefs(activePersonId, { [key]: !prefs[key] })}
          >
            {label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
