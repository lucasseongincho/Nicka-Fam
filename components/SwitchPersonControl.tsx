"use client";

import { useState } from "react";
import Image from "next/image";
import { usePeople } from "@/contexts/PersonContext";
import { Button } from "@/components/ui/Button";

export function SwitchPersonControl() {
  const { people, activePerson, choosePerson } = usePeople();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setPendingId(null);
  };

  const pendingPerson = people.find((p) => p.id === pendingId) ?? null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="cursor-pointer px-5 pb-1.5 text-left text-xs text-ink/40"
      >
        you&apos;re in as{" "}
        <span className="font-semibold text-orange">
          {activePerson?.name ?? "nobody"}
        </span>{" "}
        · switch?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-8 sm:items-center">
          <div className="w-full max-w-sm rounded-card border-2 border-ink bg-card p-5 shadow-card">
            {pendingPerson ? (
              <>
                <p className="mb-4 text-center font-heading text-lg font-semibold text-ink">
                  switch to {pendingPerson.name}?
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setPendingId(null)}
                  >
                    cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      choosePerson(pendingPerson.id);
                      close();
                    }}
                  >
                    switch
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-4 text-center font-heading text-lg font-semibold text-ink">
                  switch person
                </p>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  {people.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => setPendingId(person.id)}
                      className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-card-sm border-2 p-2 ${
                        person.id === activePerson?.id
                          ? "border-orange bg-orange/10"
                          : "border-ink/20"
                      }`}
                    >
                      <Image
                        src={person.photoUrl}
                        alt={person.name}
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded-full border-2 border-ink object-cover"
                      />
                      <span className="text-xs font-medium text-ink">
                        {person.name}
                      </span>
                    </button>
                  ))}
                </div>
                <Button variant="ghost" className="w-full" onClick={close}>
                  never mind
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
