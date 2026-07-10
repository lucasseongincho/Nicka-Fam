"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { listenBill, listenRounds } from "@/lib/bills";
import { computeSettlement } from "@/lib/settlement";
import { usePeople } from "@/contexts/PersonContext";
import type { Bill, Round } from "@/lib/types";
import { Card } from "@/components/ui/Card";

export default function SettlePage({
  params,
}: {
  params: Promise<{ billId: string }>;
}) {
  const { billId } = use(params);
  const router = useRouter();
  const { people } = usePeople();
  const [bill, setBill] = useState<Bill | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);

  useEffect(() => listenBill(billId, setBill), [billId]);
  useEffect(() => listenRounds(billId, setRounds), [billId]);

  const personOf = useMemo(() => {
    const map = new Map(people.map((p) => [p.id, p]));
    return (id: string) => map.get(id);
  }, [people]);

  const transfers = useMemo(() => computeSettlement(rounds), [rounds]);

  const handleShare = async () => {
    if (!bill) return;
    setSharing(true);
    setShareError(false);
    try {
      const res = await fetch(`/api/bills/${billId}/share-image`);
      if (!res.ok) throw new Error("image generation failed");
      const blob = await res.blob();
      const fileName = `${bill.title.replace(/[^a-z0-9]+/gi, "-")}-settle-up.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: bill.title });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // user cancelled the native share sheet — not an error
      } else {
        setShareError(true);
      }
    } finally {
      setSharing(false);
    }
  };

  if (!bill) {
    return <p className="pt-10 text-center text-ink/40">loading bill...</p>;
  }

  return (
    <div>
      <button
        onClick={() => router.push(`/split/${billId}`)}
        className="mb-2.5 cursor-pointer font-body text-sm font-medium text-orange"
      >
        ‹ back to bill
      </button>
      <h2 className="font-heading text-[22px] font-semibold text-ink">
        the damage 💸
      </h2>
      <p className="mb-4 text-sm text-ink/55">
        {transfers.length} {transfers.length === 1 ? "payment" : "payments"}{" "}
        closes it out
      </p>

      {transfers.length === 0 ? (
        <p className="py-6 text-center text-ink/40">
          everyone&apos;s even. nothing to settle.
        </p>
      ) : (
        transfers.map((t, i) => {
          const from = personOf(t.from);
          const to = personOf(t.to);
          return (
            <Card
              key={i}
              className="mb-2.5 flex items-center justify-between px-3.5 py-3"
            >
              <div className="flex items-center gap-2 font-body text-sm font-medium text-ink">
                {from && (
                  <Image
                    src={from.photoUrl}
                    alt={from.name}
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-full border-2 border-ink object-cover"
                  />
                )}
                <span>{from?.name ?? t.from}</span>
                <span className="text-orange">→</span>
                {to && (
                  <Image
                    src={to.photoUrl}
                    alt={to.name}
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-full border-2 border-ink object-cover"
                  />
                )}
                <span>{to?.name ?? t.to}</span>
              </div>
              <p className="font-heading text-[17px] font-semibold text-ink">
                ${t.amt}
              </p>
            </Card>
          );
        })
      )}

      <button
        onClick={handleShare}
        disabled={sharing}
        className="mt-4 w-full cursor-pointer text-center text-[15px] text-ink/50 hover:text-orange disabled:cursor-wait"
      >
        {sharing ? "putting it together..." : "📸 share as image"}
      </button>
      {shareError && (
        <p className="mt-1.5 text-center text-xs text-orange-dark">
          couldn&apos;t generate the image — try again
        </p>
      )}
    </div>
  );
}
