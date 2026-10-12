// src/firebase/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
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
// Ask which Google account to use instead of silently reusing the browser session.
googleProvider.setCustomParameters({ prompt: "select_account" });
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
export const storage = getStorage(app);
