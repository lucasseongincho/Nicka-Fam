"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Person } from "@/lib/types";

const STORAGE_KEY = "nickafam_personId";

interface PersonContextValue {
  people: Person[];
  loading: boolean;
  /**
   * True once the client has read localStorage at least once. Consumers must
   * wait for this before redirecting on activePersonId, otherwise a hard
   * page load of any inner route (e.g. /calendar) briefly sees
   * activePersonId as null and bounces to "/" before the real value loads.
   */
  hydrated: boolean;
  activePersonId: string | null;
  activePerson: Person | null;
  choosePerson: (personId: string) => void;
  clearPerson: () => void;
}

const PersonContext = createContext<PersonContextValue | null>(null);

export function PersonProvider({ children }: { children: ReactNode }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [activePersonId, setActivePersonId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable client-side; this one-time read (plus hydrated flag) must happen post-mount to avoid an SSR/hydration mismatch, and both must land in the same batch so consumers never see hydrated=true with a stale activePersonId.
    setActivePersonId(localStorage.getItem(STORAGE_KEY));
    setHydrated(true);

    const onStorage = () => setActivePersonId(localStorage.getItem(STORAGE_KEY));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "people"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPeople(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Person),
      );
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const choosePerson = (personId: string) => {
    localStorage.setItem(STORAGE_KEY, personId);
    setActivePersonId(personId);
  };

  const clearPerson = () => {
    localStorage.removeItem(STORAGE_KEY);
    setActivePersonId(null);
  };

  const activePerson = useMemo(
    () => people.find((p) => p.id === activePersonId) ?? null,
    [people, activePersonId],
  );

  return (
    <PersonContext.Provider
      value={{
        people,
        loading,
        hydrated,
        activePersonId,
        activePerson,
        choosePerson,
        clearPerson,
      }}
    >
      {children}
    </PersonContext.Provider>
  );
}

export function usePeople() {
  const ctx = useContext(PersonContext);
  if (!ctx) throw new Error("usePeople must be used within a PersonProvider");
  return ctx;
}
