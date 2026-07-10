"use client";

import Image from "next/image";
import type { Person } from "@/lib/types";

export function WhoAmIScreen({
  people,
  loading,
  onSelect,
}: {
  people: Person[];
  loading: boolean;
  onSelect: (personId: string) => void;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-paper px-7 pb-10 pt-16">
      <h1 className="text-center font-heading text-3xl font-bold text-ink">
        wait, who&apos;s this?
      </h1>
      <p className="mx-auto mb-7 mt-2 max-w-xs text-center text-[15px] text-ink/55">
        tap yourself so the app knows who&apos;s clicking what
      </p>

      {loading ? (
        <p className="text-center text-ink/40">loading fam...</p>
      ) : people.length === 0 ? (
        <p className="text-center text-ink/40">
          no one&apos;s in the fam yet — add people in Firestore first.
        </p>
      ) : (
        <div className="grid flex-1 grid-cols-2 gap-3.5">
          {people.map((person) => (
            <button
              key={person.id}
              onClick={() => onSelect(person.id)}
              className="flex flex-col items-center justify-center gap-2 rounded-card border-[2.5px] border-ink bg-card px-2 py-4 cursor-pointer transition-colors hover:bg-orange/10"
            >
              <Image
                src={person.photoUrl}
                alt={person.name}
                width={56}
                height={56}
                className="h-14 w-14 rounded-full border-[2.5px] border-ink object-cover"
              />
              <span className="font-heading text-base font-semibold text-ink">
                {person.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
