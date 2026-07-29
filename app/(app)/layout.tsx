"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePeople } from "@/contexts/PersonContext";
import { Header } from "@/components/Header";
import { AvatarStrip } from "@/components/AvatarStrip";
import { SwitchPersonControl } from "@/components/SwitchPersonControl";
import { TabBar } from "@/components/TabBar";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { hydrated, activePersonId } = usePeople();

  useEffect(() => {
    if (hydrated && !activePersonId) {
      router.replace("/");
    }
  }, [hydrated, activePersonId, router]);

  if (!hydrated || !activePersonId) return null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-paper">
      <Header />
      <AvatarStrip />
      <SwitchPersonControl />
      <main className="flex-1 overflow-y-auto px-5 pb-5 pt-1">{children}</main>
      <TabBar />
    </div>
  );
}
