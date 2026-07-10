"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Person } from "@/lib/types";

const STORAGE_KEY = "nickafam_personId";
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot() {
  return null;
}

function writeActivePersonId(personId: string | null) {
  if (personId) localStorage.setItem(STORAGE_KEY, personId);
  else localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((notify) => notify());
}

interface PersonContextValue {
  people: Person[];
  loading: boolean;
  activePersonId: string | null;
  activePerson: Person | null;
  choosePerson: (personId: string) => void;
  clearPerson: () => void;
}

const PersonContext = createContext<PersonContextValue | null>(null);

export function PersonProvider({ children }: { children: ReactNode }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const activePersonId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

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

  const choosePerson = (personId: string) => writeActivePersonId(personId);
  const clearPerson = () => writeActivePersonId(null);

  const activePerson = useMemo(
    () => people.find((p) => p.id === activePersonId) ?? null,
    [people, activePersonId],
  );

  return (
    <PersonContext.Provider
      value={{
        people,
        loading,
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
