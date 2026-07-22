"use client";

import { useEffect, useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import { BulletinComposer } from "@/components/board/BulletinComposer";
import { BulletinPostCard } from "@/components/board/BulletinPostCard";
import { Mascot } from "@/components/ui/Mascot";
import { listenBulletinPosts } from "@/lib/bulletin";
import type { BulletinPost } from "@/lib/types";

export default function BoardPage() {
  const { people, activePersonId } = usePeople();
  const [posts, setPosts] = useState<BulletinPost[] | null>(null);

  useEffect(() => listenBulletinPosts(setPosts), []);

  if (!activePersonId) return null;

  return (
    <div>
      <BulletinComposer authorId={activePersonId} />

      {posts === null ? (
        <p className="pt-6 text-center text-ink/40">loading the board...</p>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center pt-6 text-center">
          <div className="mb-3">
            <Mascot size={64} color="teal" mouth />
          </div>
          <p className="text-sm text-ink/50">no thoughts yet — pin the first one</p>
        </div>
      ) : (
        posts.map((post) => (
          <BulletinPostCard
            key={post.id}
            post={post}
            people={people}
            activePersonId={activePersonId}
          />
        ))
      )}
    </div>
  );
}
