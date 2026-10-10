import { useAppDialog } from "../components/feedback/DialogProvider";
// src/auth/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider, db } from "../firebase/firebase";
import { doc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  profilePhotoURL: string | null;
  saveProfilePhoto: (photo: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function upsertUserDoc(user: User, extra?: Partial<{ fullName: string }>) {
  const displayName = extra?.fullName ?? user.displayName ?? null;
  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      email: user.email ?? null,
      displayName,
      photoURL: user.photoURL ?? null,
      provider: user.providerData[0]?.providerId ?? "unknown",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const dialog = useAppDialog();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatar, setAvatar] = useState<{ uid: string; url: string } | null>(null);
  useEffect(() => {
    if (!user) { setAvatar(null); return; }
    return onSnapshot(doc(db, "users", user.uid), snapshot => {
      const photo = snapshot.data()?.avatarDataUrl;
      setAvatar(typeof photo === "string" && photo.startsWith("data:image/jpeg;base64,") ? {uid: user.uid, url: photo} : null);
    }, error => console.warn("Profil fotoğrafı okunamadı:", error.code));
  }, [user?.uid]);
  const profilePhotoURL = avatar?.uid === user?.uid ? avatar?.url || user?.photoURL || null : user?.photoURL || null;
  const saveProfilePhoto = async (photo: string) => {
    if (!user) throw new Error("Fotoğraf değiştirmek için giriş yapmalısın.");
    if (!navigator.onLine) throw new Error("Fotoğrafı kaydetmek için internet bağlantısı gerekiyor.");
    if (!photo.startsWith("data:image/jpeg;base64,") || photo.length > 150000) throw new Error("Geçersiz profil fotoğrafı.");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        setDoc(doc(db, "users", user.uid), { avatarDataUrl: photo, updatedAt: serverTimestamp() }, {merge: true}),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Kaydetme onayı alınamadı. Bağlantını kontrol edip tekrar dene.")), 25000); }),
      ]);
    } finally { clearTimeout(timer); }
    setAvatar({uid: user.uid, url: photo});
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await upsertUserDoc(cred.user);
    } catch (error: any) {
      console.error("Google login error:", error);
      let message = "Giriş yapılırken bir hata oluştu.";
      if (error.code === "auth/popup-closed-by-user") {
        message = "Giriş penceresi kapanmış görünüyor.";
      } else if (error.code === "auth/unauthorized-domain") {
        message =
          "Bu domain Firebase'de yetkili değil. Firebase Authentication ayarlarından 'Authorized domains' kısmını kontrol et.";
      }
      await dialog.alert({title:"Giriş tamamlanamadı",message,tone:"error",confirmLabel:"Anladım"});
      throw error;
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    fullName: string
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (fullName) {
      await updateProfile(cred.user, { displayName: fullName });
    }
    await upsertUserDoc(cred.user, { fullName });
  };

  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await upsertUserDoc(cred.user);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profilePhotoURL,
        saveProfilePhoto,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
