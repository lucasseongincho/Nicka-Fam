"use client";

import { usePeople } from "@/contexts/PersonContext";
import { Avatar } from "@/components/ui/Avatar";

export function AvatarStrip() {
  const { people, activePersonId } = usePeople();

  return (
    <div className="flex px-5 pb-3 pt-0.5">
      {people.map((person) => (
        <Avatar
          key={person.id}
          src={person.photoUrl}
          name={person.name}
          active={person.id === activePersonId}
          overlap
        />
      ))}
    </div>
  );
}
