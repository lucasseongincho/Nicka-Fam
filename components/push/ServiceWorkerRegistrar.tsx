"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/push";

/**
 * Mounted once in the root layout. Registers the FCM service worker and
 * nudges the browser to check for a new one whenever the tab regains
 * focus, rather than waiting on the browser's own (much longer) update
 * heuristic -- combined with the service worker's own skipWaiting/
 * clients.claim, this is what makes a fresh deploy take effect the next
 * time someone opens the app instead of requiring a reinstall.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    let registration: ServiceWorkerRegistration | null = null;

    void registerServiceWorker().then((reg) => {
      registration = reg;
    });

    const checkForUpdate = () => {
      void registration?.update();
    };
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("focus", checkForUpdate);

    return () => {
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("focus", checkForUpdate);
    };
  }, []);

  return null;
}
