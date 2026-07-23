"use client";

import { useEffect, useState } from "react";
import { isIos, isStandalone } from "@/lib/push";

const DISMISSED_KEY = "nickafam_ios_install_banner_dismissed";

/** One-time tip: iOS Safari only supports web push for sites added to the home screen. Dismissal is permanent (localStorage), same pattern PersonContext uses for its own one-time client read. */
export function IosInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage/UA sniffing is only readable client-side; this one-time read must happen post-mount to avoid an SSR/hydration mismatch, same reasoning as PersonContext's activePersonId read.
    setVisible(!dismissed && isIos() && !isStandalone());
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="mb-4 rounded-card-sm border-2 border-dashed border-ink/30 bg-cream px-3.5 py-3 text-[13px] text-ink/70">
      <p className="mb-1.5 font-heading text-sm font-semibold text-ink">
        📲 one more step on iPhone
      </p>
      <p className="mb-2 leading-relaxed">
        iPhone only allows push notifications for sites added to your home
        screen. Tap the Share button <span className="font-semibold">⬆️</span>{" "}
        in Safari, then &quot;Add to Home Screen&quot; -- open it from there to
        enable notifications.
      </p>
      <button
        onClick={dismiss}
        className="cursor-pointer text-xs font-medium text-ink/50 hover:text-orange"
      >
        got it, don&apos;t show this again
      </button>
    </div>
  );
}
