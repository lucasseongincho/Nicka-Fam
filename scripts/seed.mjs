// One-off script to seed the `people` collection. Run with: npm run seed
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const people = [
  { id: "ellie", name: "Ellie", photoUrl: "/avatars/ellie.jpg" },
  { id: "bon", name: "Bon", photoUrl: "/avatars/bon.jpg" },
  { id: "sunnie", name: "Sunnie", photoUrl: "/avatars/sunnie.jpg" },
  { id: "jaehee", name: "Jaehee", photoUrl: "/avatars/jaehee.jpg" },
  { id: "heejeong", name: "Heejeong", photoUrl: "/avatars/heejeong.jpg" },
  { id: "lucas", name: "Lucas", photoUrl: "/avatars/lucas.jpg" },
  { id: "james", name: "James", photoUrl: "/avatars/james.jpg" },
  { id: "steven", name: "Steven", photoUrl: "/avatars/steven.jpg" },
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

for (const person of people) {
  const { id, ...data } = person;
  await setDoc(doc(db, "people", id), data);
  console.log(`seeded ${data.name}`);
}

console.log("done. exiting...");
process.exit(0);
