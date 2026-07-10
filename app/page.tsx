"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePeople } from "@/contexts/PersonContext";
import { OnboardingScreen } from "@/components/OnboardingScreen";
import { WhoAmIScreen } from "@/components/WhoAmIScreen";

export default function LandingPage() {
  const router = useRouter();
  const { people, loading, activePersonId, choosePerson } = usePeople();
  const [stage, setStage] = useState<"onboarding" | "whoami">("onboarding");

  useEffect(() => {
    if (activePersonId) {
      router.replace("/split");
    }
  }, [activePersonId, router]);

  const handleSelect = (personId: string) => {
    choosePerson(personId);
    router.replace("/split");
  };

  if (activePersonId) return null;

  if (stage === "onboarding") {
    return <OnboardingScreen onContinue={() => setStage("whoami")} />;
  }

  return (
    <WhoAmIScreen people={people} loading={loading} onSelect={handleSelect} />
  );
}
