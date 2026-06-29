import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBuGrKSvwoJG9NytoOlSZwivFB5QKjmM-M",
  authDomain: "avora-split.firebaseapp.com",
  projectId: "avora-split",
  storageBucket: "avora-split.firebasestorage.app",
  messagingSenderId: "548664175872",
  appId: "1:548664175872:web:c1efdc373c1695b3f157e5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };

