"use client";

import type { VoteDesign } from "@/lib/types";

export function DesignCard({
  design,
  isMyVote,
  canVote,
  canRemove,
  onVote,
  onRemove,
}: {
  design: VoteDesign;
  isMyVote: boolean;
  canVote: boolean;
  canRemove: boolean;
  onVote: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-card border-2 bg-card shadow-card ${
        isMyVote ? "border-orange" : "border-ink"
      }`}
    >
      <button
        onClick={onVote}
        disabled={!canVote}
        className="block w-full cursor-pointer disabled:cursor-default"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={design.imageUrl}
          alt="submitted design"
          className="aspect-square w-full object-cover"
        />
      </button>

      {isMyVote && (
        <div className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-orange text-xs font-bold text-card">
          ✓
        </div>
      )}

      <div className="flex items-center justify-between gap-1.5 px-2 py-1.5">
        <span className="font-heading text-sm font-semibold text-ink">
          ❤ {design.voteCount}
        </span>
        {canRemove && (
          <button
            onClick={onRemove}
            className="cursor-pointer text-xs font-medium text-ink/40 hover:text-orange"
          >
            remove
          </button>
        )}
      </div>
    </div>
  );
}
