"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { listenBill, listenRounds, setPaymentSent } from "@/lib/bills";
import { formatRelativeTime } from "@/lib/dateUtils";
import { formatMoney } from "@/lib/money";
import { notifyCategory } from "@/lib/notifyClient";
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
  const { people, activePersonId } = usePeople();
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

  // Payment-sent status is tracked per (bill, ower) as a whole, not per
  // settlement transfer -- see the BillPayment doc comment in lib/types.ts.
  // In the rare case one ower's netted debt spans multiple creditors, a
  // single toggle marks all of that ower's rows sent at once, so every
  // affected creditor (not just the one on the clicked row) needs notifying.
  const handleToggleSent = async (owerId: string, sent: boolean) => {
    await setPaymentSent(billId, owerId, sent);
    if (!sent || !bill) return;
    const ower = personOf(owerId);
    const creditorIds = [...new Set(transfers.filter((t) => t.from === owerId).map((t) => t.to))];
    void notifyCategory({
      category: "bills",
      actorId: owerId,
      recipientIds: creditorIds,
      title: "bills",
      body: `${ower?.name ?? "someone"} marked their split as sent`,
      url: `/split/${billId}/settle`,
    });
  };

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
          const payment = bill.payments?.[t.from];
          const paid = payment?.paid ?? false;
          const isOwer = activePersonId === t.from;
          const paidAtLabel = paid ? formatRelativeTime(payment?.paidAt?.toDate?.() ?? null) : null;
          return (
            <Card key={i} className="mb-2.5 px-3.5 py-3">
              <div className="flex items-center justify-between">
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
                <p
                  className={`font-heading text-[17px] font-semibold ${paid ? "text-ink/40 line-through" : "text-ink"}`}
                >
                  {formatMoney(t.amt)}
                </p>
              </div>

              <div className="mt-2 flex items-center justify-end border-t-2 border-ink/10 pt-2">
                {isOwer ? (
                  <button
                    onClick={() => void handleToggleSent(t.from, !paid)}
                    className={`cursor-pointer rounded-pill border-2 px-3 py-1.5 text-xs font-semibold transition-colors ${
                      paid
                        ? "border-teal bg-teal/15 text-teal"
                        : "border-ink bg-orange text-card shadow-button"
                    }`}
                  >
                    {paid ? `✓ sent · ${paidAtLabel}` : "mark as sent"}
                  </button>
                ) : (
                  <span
                    className={`rounded-pill border-2 px-3 py-1.5 text-xs font-semibold ${
                      paid ? "border-teal/40 bg-teal/10 text-teal" : "border-ink/20 text-ink/40"
                    }`}
                  >
                    {paid ? `✓ sent · ${paidAtLabel}` : "not sent yet"}
                  </span>
                )}
              </div>
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
