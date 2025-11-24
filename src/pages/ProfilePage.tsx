// src/pages/ProfilePage.tsx
import { FormEvent, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  updateProfile,
  updatePassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, storage } from "../firebase/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  Camera,
  Save,
  KeyRound,
  Mail,
  UserCircle2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

type StatusType = "success" | "error" | null;

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [photoURL, setPhotoURL] = useState<string | null>(user?.photoURL ?? null);
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<StatusType>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingAvatar, setLoadingAvatar] = useState(false);

  if (!user) return null;

  const setStatusMessage = (msg: string, type: StatusType) => {
    setStatus(msg);
    setStatusType(type);
  };

  // PROFİL BİLGİLERİ (İSİM) KAYDET
  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setStatusMessage("", null);
    setLoadingProfile(true);

    try {
      await updateProfile(user, {
        displayName: displayName || undefined,
      });

      setStatusMessage("Profil bilgilerin başarıyla güncellendi.", "success");
    } catch (err: any) {
      console.error("Profile update error:", err);
      const msg =
        "Profil güncellenirken hata oluştu: " + (err.code || err.message);
      setStatusMessage(msg, "error");
    } finally {
      setLoadingProfile(false);
    }
  };

  // PROFİL FOTO YÜKLE
  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!user) return;
    if (!e.target.files?.[0]) return;

    const file = e.target.files[0];
    setStatusMessage("", null);
    setLoadingAvatar(true);

    try {
      // avatars/<uid>/profile.jpg
      const avatarRef = ref(storage, `avatars/${user.uid}/profile.jpg`);

      // Dosyayı Storage'a yükle
      await uploadBytes(avatarRef, file);

      // Dosyanın public URL'ini al
      const url = await getDownloadURL(avatarRef);

      // Firebase Auth profilini güncelle
      await updateProfile(user, { photoURL: url });

      // Ekranda hemen görmek için state'i güncelle
      setPhotoURL(url);

      setStatusMessage("Profil fotoğrafın güncellendi.", "success");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      let msg = "Profil fotoğrafı güncellenirken bir hata oluştu.";
      if (err.code) msg += ` (${err.code})`;
      setStatusMessage(msg, "error");
    } finally {
      setLoadingAvatar(false);
      e.target.value = "";
    }
  };

  // ŞİFRE GÜNCELLE
  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setStatusMessage("", null);

    if (!newPassword) {
      setStatusMessage("Yeni şifreyi gir.", "error");
      return;
    }

    setLoadingPassword(true);
    try {
      await updatePassword(user, newPassword);
      setNewPassword("");
      setStatusMessage("Şifren başarıyla güncellendi.", "success");
    } catch (err: any) {
      console.error("Password update error:", err);
      let msg = "Şifre güncellenirken bir hata oluştu.";
      if (err.code === "auth/requires-recent-login") {
        msg =
          "Güvenlik için lütfen tekrar giriş yap ve ardından şifreni değiştir.";
      } else if (err.code) {
        msg += ` (${err.code})`;
      }
      setStatusMessage(msg, "error");
    } finally {
      setLoadingPassword(false);
    }
  };

  // ŞİFRE RESET MAİLİ
  const handleSendReset = async () => {
    if (!user.email) return;
    setStatusMessage("", null);
    setLoadingPassword(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setStatusMessage(
        "Şifre sıfırlama bağlantısı e-posta adresine gönderildi.",
        "success"
      );
    } catch (err: any) {
      console.error("Password reset email error:", err);
      let msg = "E-posta gönderilirken bir hata oluştu.";
      if (err.code) msg += ` (${err.code})`;
      setStatusMessage(msg, "error");
    } finally {
      setLoadingPassword(false);
    }
  };

  const avatar = photoURL ? (
    <img
      src={photoURL}
      alt={user.displayName ?? "Profil"}
      className="w-full h-full object-cover"
    />
  ) : (
    <UserCircle2 className="w-10 h-10 text-white" />
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
            Profil ayarları
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Hesap bilgilerini, fotoğrafını ve şifreni buradan yönetebilirsin.
          </p>
        </div>
        <button
          onClick={logout}
          className="text-xs rounded-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Oturumu kapat
        </button>
      </div>

      {/* Avatar + temel bilgiler */}
      <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-orange-500 text-2xl font-bold text-white flex items-center justify-center overflow-hidden">
            {avatar}
          </div>

          {/* Foto yükleme butonu */}
          <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs border border-white dark:border-slate-800 cursor-pointer hover:brightness-110">
            <Camera className="w-4 h-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
              disabled={loadingAvatar}
            />
          </label>
        </div>

        <div className="space-y-1 text-center sm:text-left">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {displayName || user.displayName || "İsimsiz kullanıcı"}
          </div>
          <div className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Mail className="w-3 h-3" />
            <span>{user.email}</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Okuma istatistiklerin ve hedeflerin bu hesapla eşleşir.
          </p>
        </div>
      </div>

      {/* Formlar */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Profil bilgileri */}
        <form
          onSubmit={handleProfileSave}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-3"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-1">
            Profil bilgileri
          </h2>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Ad Soyad
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Adın ve soyadın"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              E-posta
            </label>
            <input
              type="email"
              value={user.email ?? ""}
              disabled
              className="w-full rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={loadingProfile}
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-white text-xs font-semibold px-4 py-2 shadow-sm hover:brightness-110 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>Profil bilgilerini kaydet</span>
          </button>
        </form>

        {/* Şifre */}
        <form
          onSubmit={handlePasswordChange}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-3"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-1">
            Güvenlik
          </h2>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Yeni şifre
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loadingPassword}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white text-xs font-semibold px-4 py-2 hover:bg-slate-800 disabled:opacity-60"
          >
            <KeyRound className="w-4 h-4" />
            <span>Şifreyi güncelle</span>
          </button>

          <button
            type="button"
            disabled={loadingPassword || !user.email}
            onClick={handleSendReset}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-60"
          >
            <Mail className="w-4 h-4" />
            <span>Şifre sıfırlama maili gönder</span>
          </button>
        </form>
      </div>

      {status && (
        <div
          className={`text-xs mt-1 px-3 py-2 rounded-xl border flex items-start gap-2 ${
            statusType === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-200"
          }`}
        >
          {statusType === "success" ? (
            <CheckCircle2 className="w-4 h-4 mt-[1px]" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-[1px]" />
          )}
          <span>{status}</span>
        </div>
      )}
    </div>
  );
}
