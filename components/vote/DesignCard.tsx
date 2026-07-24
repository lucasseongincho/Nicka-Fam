"use client";

import type { VoteDesign } from "@/lib/types";

export function DesignCard({
  design,
  isMyVote,
  onOpen,
}: {
  design: VoteDesign;
  isMyVote: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className={`relative block w-full cursor-pointer overflow-hidden rounded-card border-2 bg-card text-left shadow-card ${
        isMyVote ? "border-orange" : "border-ink"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={design.imageUrl}
        alt="submitted design"
        className="aspect-square w-full object-cover"
      />

      {isMyVote && (
        <div className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-orange text-xs font-bold text-card">
          ✓
        </div>
      )}

      <div className="px-2 py-1.5">
        <span className="font-heading text-sm font-semibold text-ink">
          ❤ {design.voteCount}
        </span>
      </div>
    </button>
  );
}
