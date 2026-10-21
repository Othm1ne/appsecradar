import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase web config is public by design. appsecradar must NOT flag it.
// Security comes from firestore.rules, which is where this app goes wrong.
const firebaseConfig = {
  apiKey: "AIzaSyDEMO-public-firebase-web-key-00000",
  authDomain: "appsecradar-demo.firebaseapp.com",
  projectId: "appsecradar-demo",
};

export const db = getFirestore(initializeApp(firebaseConfig));
