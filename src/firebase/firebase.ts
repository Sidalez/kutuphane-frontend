// src/firebase/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAZ_tamBbVWUTTbRp-ExjVcWBcbq-XPfNE",
  authDomain: "kisiseltakipapp.firebaseapp.com",
  projectId: "kisiseltakipapp",
  storageBucket: "kisiseltakipapp.firebasestorage.app",
  messagingSenderId: "421307795484",
  appId: "1:421307795484:web:04b8b21e139dbef814b7d9",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
