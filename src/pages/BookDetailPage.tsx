import {observeReadingClock} from '../utils/readingClock';
import ReadingSessionPanel from '../components/ReadingSessionPanel';
import {useAppDialog} from '../components/feedback/DialogProvider';
import {localDate} from "../utils/personalHub";
import {elapsedReadingMs,restoreReadingTimer,pauseReadingTimer,resumeReadingTimer,finishReadingTimer,type ReadingTimer} from '../utils/readingTimer';
import { pageLoadingConfig } from "../components/feedback/pageLoadingConfig";
import PageLoading from "../components/feedback/PageLoading";
// src/pages/BookDetailPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import BookDeleteModal from "../components/BookDeleteModal";
import {
  BookOpen,
  CalendarDays,
  Clock,
  Pencil,
  Bookmark,
  Sparkles,
  Star,
  X,
  Info,
  Trash2,
} from "lucide-react";

import type { Book } from "../types/book";

type TabKey = "logs" | "notes";

export default function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [book, setBook] = useState<Book | null>(null);
  const [loadingBook, setLoadingBook] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("logs");

  const [notes, setNotes] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  // Not form
  const [newNote, setNewNote] = useState("");
  const [newNotePage, setNewNotePage] = useState("");

  // Log form
  const [logDate, setLogDate] = useState("");
  const [logStartTime, setLogStartTime] = useState("");
  const [logEndTime, setLogEndTime] = useState("");
  const [logStartPage, setLogStartPage] = useState("");
  const [logEndPage, setLogEndPage] = useState("");

  // Rating modal
  const [ratingModal, setRatingModal] = useState<null | "start" | "final">(
    null
  );
  const [ratingValue, setRatingValue] = useState<number | null>(null);

  // Toast
  const [notification, setNotification] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteAlert, setDeleteAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Okunan sayfa hesaplama
  const calculatedReadPages = (() => {
    const s = parseInt(logStartPage || "", 10);
    const e = parseInt(logEndPage || "", 10);
    if (isNaN(s) || isNaN(e)) return "";
    const diff = e - s;
    return diff > 0 ? String(diff) : "";
  })();

  /* --------------------------------------------------------------- */
  /*  VERİ YÜKLEME                                                   */
  /* --------------------------------------------------------------- */
  useEffect(() => {
    if (!id || !user) return;

    const load = async () => {
      setLoadingBook(true);
      setError(null);

      // ==== kitap yükle ====
      try {
        const ref = doc(db, "books", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Kitap bulunamadı.");
          setBook(null);
          setLoadingBook(false);
          return;
        }

        const data = snap.data() as Book;

        if (data.userId !== user.uid) {
          setError("Bu kitaba erişim yetkin yok.");
          setBook(null);
          setLoadingBook(false);
          return;
        }

        setBook({ ...data, id: snap.id });
      } catch (e) {
        console.error(e);
        setError("Kitap yüklenirken hata oluştu.");
        setBook(null);
        setLoadingBook(false);
        return;
      }

      // ==== notlar ====
      try {
        const notesSnap = await getDocs(
          query(
            collection(db, "books", id, "notes"),
            orderBy("createdAt", "desc")
          )
        );
        setNotes(notesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        setNotes([]);
      }

      // ==== loglar ====
      try {
        const logsSnap = await getDocs(
          query(collection(db, "books", id, "logs"), orderBy("date", "desc"))
        );
        setLogs(logsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        setLogs([]);
      }

      setLoadingBook(false);
    };

    load();
  }, [id, user]);

  /* --------------------------------------------------------------- */
  /*  DURUM GÜNCELLEME                                               */
  /* --------------------------------------------------------------- */
  const handleUpdateStatus = async (newStatus: Book["status"]) => {
    if (!id || !user || !book) return;
    if (newStatus === book.status) return;

    // Okuma kaydı varsa tekrar OKUNACAK yapılamaz
    if (
      newStatus === "OKUNACAK" &&
      (((book.pagesRead ?? 0) > 0) || logs.length > 0)
    ) {
      showNotification(
        "Okuma kaydı bulunan bir kitabın durumu tekrar 'Okunacak' yapılamaz."
      );
      return;
    }

    const ref = doc(db, "books", id);

    try {
      // Kitap OKUNDU durumundan çıkıyorsa final puanı sıfırla
      if (book.status === "OKUNDU" && newStatus !== "OKUNDU") {
        const updates: any = {
          status: newStatus,
          finalRating: null,
        };

        const expected = book.expectedRating ?? null;
        const progress = book.progressRating ?? null;
        const values = [expected, progress].filter(
          (v): v is number => v !== null
        );

        updates.overallRating =
          values.length > 0
            ? values.reduce((sum, v) => sum + v, 0) / values.length
            : null;

        await updateDoc(ref, updates);
        setBook({ ...book, ...updates });
        return;
      }

      await updateDoc(ref, { status: newStatus });
      setBook({ ...book, status: newStatus });

      if (newStatus === "OKUNDU") {
        setRatingModal("final");
        setRatingValue(null);
      }
    } catch (e) {
      console.error(e);
      showNotification("Durum güncellenirken bir hata oluştu.");
    }
  };

  const handleStartReading = async () => {
    if (!id || !user || !book) return;
    const today = localDate();

    try {
      await updateDoc(doc(db, "books", id), {
        status: "OKUNUYOR",
        startDate: book.startDate || today,
      });

      setBook({
        ...book,
        status: "OKUNUYOR",
        startDate: book.startDate ?? today,
      });

      setRatingModal("start");
      setRatingValue(null);
    } catch (e) {
      console.error(e);
      showNotification("Okumaya başlama sırasında hata oluştu.");
    }
  };

  /* --------------------------------------------------------------- */
  /*  NOT EKLE                                                       */
  /* --------------------------------------------------------------- */
  const handleAddNote = async () => {
    if (!id || !user) return;
    if (!newNote.trim()) {
      showNotification("Not eklemek için metin girmen gerekiyor.");
      return;
    }

    try {
      const payload = {
        text: newNote.trim(),
        page: newNotePage || null,
        createdAt: new Date(),
        userId: user.uid,
      };

      const docRef = await addDoc(
        collection(db, "books", id, "notes"),
        payload
      );

      setNotes((prev) => [{ id: docRef.id, ...payload }, ...prev]);
      setNewNote("");
      setNewNotePage("");
      showNotification("Not başarıyla eklendi.");
    } catch (e) {
      console.error(e);
      showNotification("Not eklenirken bir hata oluştu.");
    }
  };

  /* --------------------------------------------------------------- */
  /*  OKUMA LOG EKLE                                                 */
  /* --------------------------------------------------------------- */
  const handleAddLog = async (measuredMinutes?:number) => {
    if (!id || !user || !book) return;

    if (!logDate || !logStartPage || !logEndPage) {
      showNotification("Tarih ve sayfa aralıklarını doldurmalısın.");
      return;
    }

    const start = Number(logStartPage);
    const end = Number(logEndPage);

    if (isNaN(start) || isNaN(end)) {
      showNotification("Sayfa numaraları geçerli olmalı.");
      return;
    }

    if (end <= start) {
      showNotification(
        "Bitiş sayfası, başlangıç sayfasından büyük olmalı."
      );
      return;
    }

    const totalRead = end - start;
    const today = localDate();

    try {
      const startInstant = logStartTime ? new Date(`${logDate}T${logStartTime}:00`) : null;
      const startedAt = startInstant && Number.isFinite(startInstant.getTime()) ? startInstant.toISOString() : null;
      const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
      const durationMinutes = measuredMinutes ?? (logStartTime && logEndTime ? (toMinutes(logEndTime) - toMinutes(logStartTime) + 1440) % 1440 : null);
      const payload = {
        date: logDate,
        startTime: logStartTime || null,
        endTime: logEndTime || null,
        startedAt,
        durationMinutes,
        startPage: start,
        endPage: end,
        totalRead,
        createdAt: new Date(),
        userId: user.uid,
      };

      const logRef = await addDoc(
        collection(db, "books", id, "logs"),
        payload
      );

      const prevPages = book.pagesRead || 0;
      const totalPages = book.totalPages || null;

      let newPagesRead = Math.max(prevPages, end);
      let newStatus: Book["status"] = book.status;
      const updates: any = {};

      if (totalPages != null) {
        if (newPagesRead >= totalPages) {
          // Bitti
          newPagesRead = totalPages;
          newStatus = "OKUNDU";
          updates.endDate = book.endDate || today;
        } else if (prevPages === 0 && book.status === "OKUNACAK") {
          // İlk log → okunuyor, başlangıç tarihi logDate
          newStatus = "OKUNUYOR";
          updates.startDate = logDate;
        } else if (!book.startDate) {
          // Herhangi bir sebeple startDate yoksa yine logDate kullan
          updates.startDate = logDate;
        }
      } else {
        if (prevPages === 0 && book.status === "OKUNACAK") {
          newStatus = "OKUNUYOR";
          updates.startDate = logDate;
        } else if (!book.startDate) {
          updates.startDate = logDate;
        }
      }

      updates.pagesRead = newPagesRead;
      if (newStatus !== book.status) {
        updates.status = newStatus;
      }

      await updateDoc(doc(db, "books", id), updates);

      setBook((prev) =>
        prev
          ? {
              ...prev,
              pagesRead: newPagesRead,
              status: updates.status || prev.status,
              startDate: updates.startDate || prev.startDate,
              endDate: updates.endDate || prev.endDate,
            }
          : prev
      );

      setLogs((prev) => [{ id: logRef.id, ...payload }, ...prev]);

      // 🔥 Otomatik oturum varsa Firestore'daki kaydı temizle
      try {
        const sessionRef = doc(db, "books", id, "sessions", user.uid);
        await deleteDoc(sessionRef);
      } catch (e) {
        console.error("Aktif oturum temizlenirken hata:", e);
      }

      // Puan modal tetikleri
      if (prevPages === 0 && book.status === "OKUNACAK") {
        setRatingModal("start");
        setRatingValue(null);
      }
      if (totalPages != null && newPagesRead >= totalPages) {
        setRatingModal("final");
        setRatingValue(null);
      }

      // Form sıfırla
      setLogDate("");
      setLogStartTime("");
      setLogEndTime("");
      setLogStartPage("");
      setLogEndPage("");

      showNotification("Okuma kaydı başarıyla eklendi.");
      return true;
    } catch (e) {
      console.error(e);
      showNotification("Okuma kaydı eklenirken bir hata oluştu.");
    }
  };

  /* --------------------------------------------------------------- */
  /*  PUANLAMA MODALİ                                                */
  /* --------------------------------------------------------------- */
  const handleCloseRating = () => {
    setRatingModal(null);
    setRatingValue(null);
  };

  const handleSaveRating = async () => {
    if (!id || !user || !book || !ratingModal || !ratingValue) {
      handleCloseRating();
      return;
    }

    try {
      const updates: any = {};
      if (ratingModal === "start") {
        updates.progressRating = ratingValue;
      } else if (ratingModal === "final") {
        updates.finalRating = ratingValue;
      }

      const expected = book.expectedRating ?? null;
      const progress =
        ratingModal === "start"
          ? ratingValue
          : book.progressRating ?? null;
      const final =
        ratingModal === "final"
          ? ratingValue
          : book.finalRating ?? null;

      const values = [expected, progress, final].filter(
        (v): v is number => v !== null
      );

      updates.overallRating =
        values.length > 0
          ? values.reduce((sum, v) => sum + v, 0) / values.length
          : null;

      await updateDoc(doc(db, "books", id), updates);
      setBook((prev) => (prev ? { ...prev, ...updates } : prev));

      handleCloseRating();
      showNotification("Puanın kaydedildi.");
    } catch (e) {
      console.error(e);
      showNotification("Puan kaydedilirken bir hata oluştu.");
      handleCloseRating();
    }
  };

  /* --------------------------------------------------------------- */
  /*  KİTABI SİL                                                     */
  /* --------------------------------------------------------------- */
  const handleDeleteBook = async () => {
    if (!id || !user) return;

    try {
      setDeleteLoading(true);
      setDeleteAlert(null);

      // 🔥 ALT KOLEKSİYONLARI SİL — logs
      const logsSnap = await getDocs(collection(db, "books", id, "logs"));
      for (const log of logsSnap.docs) {
        await deleteDoc(doc(db, "books", id, "logs", log.id));
      }

      // 🔥 ALT KOLEKSİYONLARI SİL — notes
      const notesSnap = await getDocs(collection(db, "books", id, "notes"));
      for (const note of notesSnap.docs) {
        await deleteDoc(doc(db, "books", id, "notes", note.id));
      }

      // 🔥 KİTAP DOKÜMANINI SİL
      await deleteDoc(doc(db, "books", id));

      // ✅ Modal içinde şekilli alert
      setDeleteAlert({
        type: "success",
        message: "Kitap ve tüm verileri başarıyla silindi.",
      });

      // Biraz göster, sonra kütüphaneye dön
      setTimeout(() => {
        setDeleteModalOpen(false);
        navigate("/library");
      }, 1500);
    } catch (e) {
      console.error(e);
      setDeleteAlert({
        type: "error",
        message: "Kitap silinirken bir hata oluştu. Lütfen tekrar dene.",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  /* --------------------------------------------------------------- */
  /*  RENDER DURUMLARI                                               */
  /* --------------------------------------------------------------- */

  if (loadingBook) {
    return (
      <PageLoading {...pageLoadingConfig("/library/book")} />
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center text-slate-500">
        {error}
        <div className="mt-4">
          <button
            onClick={() => navigate("/library")}
            className="px-4 py-2 rounded-full bg-amber-500 text-white text-sm font-semibold"
          >
            Kütüphaneme dön
          </button>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="p-8 text-center text-slate-500">
        Kitap verisi bulunamadı.
      </div>
    );
  }

  const statusLabel =
    book.status === "OKUNACAK"
      ? "Okunacak"
      : book.status === "OKUNUYOR"
      ? "Okunuyor"
      : "Okundu";

  const statusDescription =
    book.status === "OKUNACAK"
      ? "Planladığın, henüz başlamadığın kitap."
      : book.status === "OKUNUYOR"
      ? "Şu anda üzerinde çalıştığın kitap."
      : "Bu kitabı tamamladın, artık bir deneyim.";

  const lastReadPage: number | null =
    (book.pagesRead ?? null) ||
    (logs.length > 0 ? logs[0].endPage ?? null : null);

  return (
    <>
      {/* TOAST */}
      {notification && (
        <div className="fixed top-4 right-4 z-50">
          <div className="flex items-start gap-2 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-xl border border-slate-700 max-w-xs">
            <div className="mt-0.5">
              <Info className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xs leading-relaxed flex-1">
              {notification}
            </div>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 p-1 rounded-full hover:bg-slate-800"
            >
              <X className="w-3 h-3 text-slate-300" />
            </button>
          </div>
        </div>
      )}

      <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-6 md:space-y-8 text-slate-800 dark:text-slate-50">
        {/* ÜST ÖZET KARTI */}
        <section
          className="
            relative overflow-hidden
            rounded-3xl border border-amber-100/60 dark:border-slate-800
            bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50
            dark:from-slate-900 dark:via-slate-900 dark:to-slate-800
            px-6 py-7 flex flex-col md:flex-row gap-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)]
          "
        >
          <div
            className="
              pointer-events-none absolute right-[-20%] top-[-10%]
              w-[60%] h-[140%] opacity-40 blur-3xl
              bg-gradient-to-br from-orange-300/40 via-amber-200/30 to-rose-200/40
              dark:from-slate-700/30 dark:via-slate-700/20 dark:to-slate-700/10
            "
          />

          {/* Kapak */}
          <div className="relative z-10 flex-shrink-0 flex justify-center md:block">
            {book.coverImageUrl ? (
              <img
                src={book.coverImageUrl}
                alt={book.title}
                className="
                  w-40 h-56 object-cover rounded-2xl shadow-xl
                  border border-white/70 dark:border-slate-700
                  bg-slate-100 dark:bg-slate-900
                "
              />
            ) : (
              <div
                className="
                  w-40 h-56 flex items-center justify-center rounded-2xl
                  bg-white/60 dark:bg-slate-900
                  border border-dashed border-amber-200 dark:border-slate-600
                "
              >
                <BookOpen className="w-8 h-8 text-slate-400" />
              </div>
            )}
          </div>

          {/* Bilgi alanı */}
          <div className="relative z-10 flex-1 flex flex-col gap-4 min-w-0">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-amber-700 dark:text-slate-400">
                Kişisel kütüphanem • Kitap işlemleri
              </div>

              <h1 className="mt-1 text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50 break-words">
                {book.title}
              </h1>

              {book.author && (
                <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {book.author}
                </p>
              )}
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-600 dark:text-slate-400">
              {book.publishYear && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {book.publishYear}
                </span>
              )}
              {book.publisher && (
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  {book.publisher}
                </span>
              )}
              {book.totalPages && (
                <span className="inline-flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5" />
                  {book.totalPages} sayfa
                </span>
              )}
              {book.isbn && (
                <span className="text-[11px] font-mono bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
                  ISBN: {book.isbn}
                </span>
              )}
              {book.pagesRead != null && book.totalPages && (
                <span className="text-[11px] font-medium bg-white/60 dark:bg-slate-900/60 px-2 py-0.5 rounded-full">
                  İlerleme: {book.pagesRead} / {book.totalPages} sayfa
                </span>
              )}
            </div>

            {/* Durum + puan */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div
                  className={`
                    inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                    text-[11px] font-semibold
                    ${
                      book.status === "OKUNACAK"
                        ? "bg-indigo-100 text-indigo-800"
                        : book.status === "OKUNUYOR"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-emerald-100 text-emerald-900"
                    }
                  `}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  <span>{statusLabel}</span>
                  <span className="hidden md:inline text-[11px] opacity-80">
                    · {statusDescription}
                  </span>
                </div>

                <div className="inline-flex rounded-full bg-white/80 dark:bg-slate-800/60 p-0.5 shadow-inner border border-white/70 dark:border-slate-700 backdrop-blur">
                  {(["OKUNACAK", "OKUNUYOR", "OKUNDU"] as Book["status"][]).map(
                    (status) => {
                      const active = book.status === status;
                      const label =
                        status === "OKUNACAK"
                          ? "Okunacak"
                          : status === "OKUNUYOR"
                          ? "Okunuyor"
                          : "Okundu";

                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleUpdateStatus(status)}
                          className={`
                            px-3 py-1 rounded-full text-[11px] font-medium transition
                            ${
                              active
                                ? "bg-slate-900 text-amber-200 dark:bg-white dark:text-slate-900 shadow"
                                : "text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5"
                            }
                          `}
                        >
                          {label}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Puan alanı + gidişat butonu */}
              {(book.expectedRating ||
                book.progressRating ||
                book.finalRating ||
                book.overallRating ||
                book.status === "OKUNUYOR") && (
                <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
                  {book.expectedRating && (
                    <p>Beklenti puanım: {book.expectedRating} / 5</p>
                  )}
                  {book.progressRating && (
                    <p>Gidişat puanım: {book.progressRating} / 5</p>
                  )}
                  {book.finalRating && (
                    <p>Final puanım: {book.finalRating} / 5</p>
                  )}
                  {book.overallRating && (
                    <p className="flex items-center gap-1 text-[11px] opacity-80">
                      <Sparkles className="w-3.5 h-3.5" />
                      Yapay zeka değerlendirmesi: {book.overallRating.toFixed(
                        1
                      )}{" "}
                      / 5
                    </p>
                  )}
                  {book.status === "OKUNUYOR" && (
                    <button
                      type="button"
                      onClick={() => {
                        setRatingModal("start");
                        setRatingValue(book.progressRating ?? null);
                      }}
                      className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:underline"
                    >
                      <Star className="w-3 h-3" />
                      Gidişat puanını güncelle
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SEKME BAR + SİL BUTONU */}
        <div className="flex justify-between items-center gap-3">
          <div className="inline-flex gap-2 p-1 rounded-full bg-white border border-amber-100 shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("logs")}
              className={`
                px-4 py-1.5 rounded-full text-sm font-medium transition
                ${
                  activeTab === "logs"
                    ? "bg-amber-500 text-white shadow"
                    : "text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-slate-800"
                }
              `}
            >
              Okuma Kayıtları ({logs.length})
            </button>

            <button
              onClick={() => setActiveTab("notes")}
              className={`
                px-4 py-1.5 rounded-full text-sm font-medium transition
                ${
                  activeTab === "notes"
                    ? "bg-amber-500 text-white shadow"
                    : "text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-slate-800"
                }
              `}
            >
              Notlar ({notes.length})
            </button>
          </div>

          {/* Sağda: Sil butonu */}
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold
                       bg-red-50 text-red-700 border border-red-100
                       hover:bg-red-100 hover:border-red-200
                       dark:bg-red-900/20 dark:text-red-200 dark:border-red-800"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Kitabı Sil
          </button>
        </div>

        {/* TAB İÇERİKLERİ */}
        {activeTab === "logs" ? (
          <LogsTab
            bookTitle={book.title}
            bookStatus={book.status}
            logs={logs}
            logDate={logDate}
            setLogDate={setLogDate}
            logStartTime={logStartTime}
            setLogStartTime={setLogStartTime}
            logEndTime={logEndTime}
            setLogEndTime={setLogEndTime}
            logStartPage={logStartPage}
            setLogStartPage={setLogStartPage}
            logEndPage={logEndPage}
            setLogEndPage={setLogEndPage}
            calculatedReadPages={calculatedReadPages}
            onAddLog={handleAddLog}
            onStartReading={handleStartReading}
            lastReadPage={lastReadPage}
            bookId={id!}
            userId={user!.uid}
          />
        ) : (
          <NotesTab
            bookStatus={book.status}
            notes={notes}
            newNote={newNote}
            setNewNote={setNewNote}
            newNotePage={newNotePage}
            setNewNotePage={setNewNotePage}
            onAddNote={handleAddNote}
          />
        )}
      </div>
      {/* KİTAP SİLME MODALİ */}
      <BookDeleteModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteAlert(null);
        }}
        onConfirm={handleDeleteBook}
        loading={deleteLoading}
        result={deleteAlert}
      />
      {/* PUANLAMA MODALI */}
      {ratingModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-700 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {ratingModal === "start"
                  ? "Kitabı okumaya başladınız"
                  : "Kitabı tamamladınız"}
              </h3>
              <button
                onClick={handleCloseRating}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              {ratingModal === "start"
                ? "İlk izlenimine göre bu kitaba şu an kaç puan verirsin?"
                : "Genel olarak bu kitaba kaç puan verirsin?"}
            </p>

            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = ratingValue === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRatingValue(n)}
                    className={`
                      flex flex-col items-center gap-1 px-2 py-1 rounded-xl
                      ${
                        active
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }
                    `}
                  >
                    <Star
                      className={`w-5 h-5 ${
                        active
                          ? "fill-amber-400 stroke-amber-500"
                          : "stroke-slate-400"
                      }`}
                    />
                    <span className="text-[11px] font-medium">{n}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!ratingValue}
              onClick={handleSaveRating}
              className={`
                w-full px-4 py-2.5 rounded-xl text-sm font-semibold
                ${
                  ratingValue
                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed"
                }
              `}
            >
              Kaydet
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ========================== LOGS TAB =============================== */

interface LogsTabProps {
  bookTitle: string;
  bookStatus: Book["status"];
  logs: any[];
  logDate: string;
  setLogDate: (v: string) => void;
  logStartTime: string;
  setLogStartTime: (v: string) => void;
  logEndTime: string;
  setLogEndTime: (v: string) => void;
  logStartPage: string;
  setLogStartPage: (v: string) => void;
  logEndPage: string;
  setLogEndPage: (v: string) => void;
  calculatedReadPages: string;
  onAddLog: (measuredMinutes?:number) => Promise<boolean|void>;
  onStartReading: () => void;
  lastReadPage: number | null;
  bookId: string;
  userId: string;
}

function LogsTab({
  bookTitle,
  bookStatus,
  logs,
  logDate,
  setLogDate,
  logStartTime,
  setLogStartTime,
  logEndTime,
  setLogEndTime,
  logStartPage,
  setLogStartPage,
  logEndPage,
  setLogEndPage,
  calculatedReadPages,
  onAddLog,
  onStartReading,
  lastReadPage,
  bookId,
  userId,
}: LogsTabProps) {
  const dialog=useAppDialog();
  const [mode, setMode] = useState<"manual" | "auto">("auto");
  const [timerStartMs, setTimerStartMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timer,setTimer]=useState<ReadingTimer|null>(null);
  const [timerBusy,setTimerBusy]=useState(false);
  const [timerError,setTimerError]=useState('');

  // 🔥 Yeni: otomatik oturumun başlangıç sayfasını ve yüklenme durumunu tut
  const [autoStartPage, setAutoStartPage] = useState<number | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // 🔥 Firestore'daki aktif oturum dokümanı (sessions koleksiyonu)
  const sessionDocRef = useMemo(
    () =>
      bookId && userId ? doc(db, "books", bookId, "sessions", userId) : null,
    [bookId, userId]
  );

  useEffect(() => {
    if (bookStatus !== "OKUNUYOR") return;

    if (!logDate) {
      const today = localDate();
      setLogDate(today);
    }

    if (!logStartPage) {
      const start = lastReadPage && lastReadPage > 0 ? lastReadPage : 1;
      setLogStartPage(String(start));
    }
  }, [
    bookStatus,
    lastReadPage,
    logDate,
    logStartPage,
    setLogDate,
    setLogStartPage,
  ]);

  // 🔥 Sayfa açıldığında Firestore'dan aktif oturumu oku
  useEffect(() => {
    if (!sessionDocRef) return;

    let cancelled = false;

    (async () => {
      try {
        const snap = await getDoc(sessionDocRef);
        if (!snap.exists()) return;
        const data: any = snap.data();

        const restored=restoreReadingTimer(data);
        if(!restored)return;
        if (cancelled) return;

        const startMs: number = restored.startAtMs;
        const startDate = new Date(startMs);

        const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(data.date||'')?data.date:localDate(startDate);
        const hh = String(startDate.getHours()).padStart(2, "0");
        const mm = String(startDate.getMinutes()).padStart(2, "0");

        setMode("auto");
        setTimerStartMs(startMs);
        setTimer(restored);
        setElapsedMs(elapsedReadingMs(restored));
        setIsRunning(restored.status==='running');
        if(restored.endAtMs){const end=new Date(restored.endAtMs);setLogEndTime(`${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`);}

        // Tarih & saat alanlarını tekrar doldur
        setLogDate(dateStr);
        setLogStartTime(`${hh}:${mm}`);

        const startPageNumber =
          typeof data.startPage === "number" && !Number.isNaN(data.startPage)
            ? data.startPage
            : null;

        if (startPageNumber && startPageNumber > 0) {
          setLogStartPage(String(startPageNumber));
          setAutoStartPage(startPageNumber);
        }
      } catch {
        if(!cancelled)setTimerError('Okuma oturumu yüklenemedi. Sayfayı yenileyip tekrar dene.');
      } finally {
        if (!cancelled) setSessionLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionDocRef, setLogDate, setLogStartTime, setLogStartPage]);

  // Kayıt modu değişince kronometreyi sıfırla
  useEffect(() => {
    if (mode === "manual") {
      setIsRunning(false);
      setTimerStartMs(null);
      setElapsedMs(0);
    }
  }, [mode]);

  // Kitap "OKUNUYOR" değilse kronometreyi kapat
  useEffect(() => {
    if (bookStatus !== "OKUNUYOR") {
      setIsRunning(false);
      setTimerStartMs(null);
      setElapsedMs(0);
      setMode("manual");
    }
  }, [bookStatus]);

  // Recalculate from persisted timestamps when iOS resumes a suspended page.
  useEffect(() => {
    if(!timer)return;
    return observeReadingClock(timer,setElapsedMs);
  }, [timer]);
  const handleResetAutoSession = async () => {
    if(timerBusy)return;
    if(!navigator.onLine){setTimerError('Oturumu sıfırlamak için internet bağlantısı gerekiyor.');return;}
    if(!await dialog.confirm({title:'Okuma oturumu sıfırlansın mı?',message:'Bu oturumun süresi ve henüz kaydetmediğin sayfa bilgileri silinecek. Önceki okuma kayıtların korunur.',confirmLabel:'Oturumu sıfırla',tone:'warning'}))return;
    setTimerBusy(true);setTimerError('');
    // Firestore'daki session'ı tamamen sil
    if (sessionDocRef) {
      try {
        await deleteDoc(sessionDocRef);
      } catch (e) {
        setTimerError('Oturum sıfırlanamadı. Tekrar dene.');setTimerBusy(false);return;
      }
    }

    // Lokal state'i temizle
    setIsRunning(false);
    setTimerStartMs(null);
    setElapsedMs(0);
    setLogStartTime("");
    setLogEndTime("");
    setLogStartPage("");
    setLogEndPage("");
    setAutoStartPage(null);
    setTimer(null);setTimerBusy(false);
  };

  const persistTimer = async (next:ReadingTimer,extra:Record<string,unknown>={}) => {
    if(!sessionDocRef)return false;
    if(!navigator.onLine){setTimerError('Sayacı güncellemek için internet bağlantısı gerekiyor.');return false;}
    setTimerBusy(true);setTimerError('');
    try {
      await setDoc(sessionDocRef,{...next,...extra,bookId,userId,endedAt:next.status==='finished'?serverTimestamp():null},{merge:true});
      setTimer(next);setTimerStartMs(next.startAtMs);setElapsedMs(elapsedReadingMs(next));setIsRunning(next.status==='running');return true;
    }catch{setTimerError('Sayaç kaydedilemedi. Bağlantını kontrol edip tekrar dene.');return false;}
    finally{setTimerBusy(false)}
  };
  const handleStartAutoSession = async () => {
    if(timerBusy||!sessionLoaded||isRunning||timer?.status==='finished')return;
    const now=Date.now();
    if(timer?.status==='paused'){await persistTimer(resumeReadingTimer(timer,now));return;}
    const parsed=Number(logStartPage);const startPage=Number.isFinite(parsed)&&parsed>0?parsed:lastReadPage||1;
    const next:ReadingTimer={startAtMs:now,segmentStartedAtMs:now,accumulatedMs:0,status:'running'};
    if(await persistTimer(next,{startPage,date:localDate(new Date(now)),createdAt:serverTimestamp()})){
      const date=new Date(now);setMode('auto');setLogDate(localDate(date));setLogStartTime(`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`);setLogEndTime('');setAutoStartPage(startPage);setLogStartPage(String(startPage));
    }
  };
  const handlePauseAutoSession = async () => {
    if(!timer||timerBusy||timer.status!=='running')return;
    await persistTimer(pauseReadingTimer(timer));
  };
  const handleStopAutoSession = async () => {
    if(!timer||timerBusy||timer.status==='finished')return;
    const next=finishReadingTimer(timer);
    if(await persistTimer(next)){const date=new Date(next.endAtMs!);setLogEndTime(`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`);}
  };
  const saveLog = async () => {
    if(timerBusy)return;
    if(!navigator.onLine){setTimerError('Okuma kaydını tamamlamak için internet bağlantısı gerekiyor.');return;}
    if(mode==='auto'&&timer?.status!=='finished'){setTimerError('Önce okumayı bitir, ardından bitiş sayfasını yazıp kaydet.');return;}
    setTimerBusy(true);setTimerError('');
    try{const saved=await onAddLog(mode==='auto'&&timer?Math.round(elapsedReadingMs(timer)/600)/100:undefined);if(saved){setTimer(null);setTimerStartMs(null);setElapsedMs(0);setIsRunning(false);setAutoStartPage(null);}}
    finally{setTimerBusy(false)}
  };
  return (
    <div className="space-y-4">
      {/* Form kartı */}
      <div className="rounded-3xl border border-amber-100 bg-white shadow-[0_12px_35px_rgba(0,0,0,0.06)] dark:bg-slate-950 dark:border-slate-800 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="text-base md:text-lg font-semibold text-amber-700">
            Okuma oturumun
          </h2>

          {/* 🔸 Kayıt modu seçimi */}
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-slate-900 px-1 py-0.5 text-[11px]">
            <span className="px-2 text-slate-500 dark:text-slate-400">
              Kayıt modu:
            </span>
            <button
              type="button"
              disabled={!!timer || timerBusy} onClick={() => setMode("manual")}
              className={`min-h-11 px-3 py-2 rounded-full font-medium disabled:opacity-40 ${
                mode === "manual"
                  ? "bg-white dark:bg-slate-800 text-amber-700 shadow"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-slate-800/80"
              }`}
            >
              Manuel
            </button>
            <button
              type="button"
              onClick={() => setMode("auto")}
              className={`min-h-11 px-3 py-2 rounded-full font-medium disabled:opacity-40 ${
                mode === "auto"
                  ? "bg-white dark:bg-slate-800 text-amber-700 shadow"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-slate-800/80"
              }`}
            >
              Otomatik
            </button>
          </div>
        </div>

        {bookStatus === "OKUNACAK" && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
            Bu kitap şu anda <strong>“Okunacak”</strong> durumunda. Okuma
            kaydı tutmak için önce okumaya başlamalısın.
            <div className="mt-3">
              <button
                type="button"
                onClick={onStartReading}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs md:text-sm font-semibold shadow"
              >
                Okumaya başla
              </button>
            </div>
          </div>
        )}

        {bookStatus === "OKUNDU" && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
            Bu kitap <strong>“Okundu”</strong> olarak işaretlendi. Yeni okuma
            kaydı ekleyemezsin; mevcut kayıtlar istatistikler bölümünde rapor
            olarak kullanılır.
          </div>
        )}

        {bookStatus === "OKUNUYOR" && (
          <>
            {mode==='auto'&&<ReadingSessionPanel title={bookTitle} timer={timer} elapsedMs={elapsedMs} busy={timerBusy} loaded={sessionLoaded} startPage={autoStartPage??Number(logStartPage||lastReadPage||0)} pages={Number(calculatedReadPages)||0} onStart={handleStartAutoSession} onPause={handlePauseAutoSession} onFinish={handleStopAutoSession} onReset={handleResetAutoSession}/>}
            {/* Tarih & saat satırı */}
            <div className="mt-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Tarih
                  </label>
                  <input
                    type="date"
                    value={logDate}
                    disabled={mode === "auto" && !!timer}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="min-h-12 min-w-0 w-full px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 dark:bg-slate-900 dark:border-slate-700 dark:focus:ring-slate-500/40"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Başlangıç Saati{" "}
                    {mode === "auto" && (
                      <span className="ml-1 text-[10px] text-slate-400">
                        (otomatik alınır)
                      </span>
                    )}
                  </label>
                  <input
                    type="time"
                    value={logStartTime}
                    onChange={(e) => setLogStartTime(e.target.value)}
                    disabled={mode === "auto"} // 🔥 Auto modda kullanıcı seçemiyor
                    className="min-h-12 min-w-0 w-full px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:bg-slate-100 disabled:text-slate-400 dark:bg-slate-900 dark:border-slate-700 dark:focus:ring-slate-500/40 disabled:dark:bg-slate-800 disabled:dark:text-slate-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Bitiş Saati{" "}
                    {mode === "auto" && (
                      <span className="ml-1 text-[10px] text-slate-400">
                        (Bitir’e basınca)
                      </span>
                    )}
                  </label>
                  <input
                    type="time"
                    value={logEndTime}
                    onChange={(e) => setLogEndTime(e.target.value)}
                    disabled={mode === "auto"}
                    className="min-h-12 min-w-0 w-full px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:bg-slate-100 disabled:text-slate-400 dark:bg-slate-900 dark:border-slate-700 dark:focus:ring-slate-500/40 disabled:dark:bg-slate-800 disabled:dark:text-slate-500"
                  />
                </div>


              </div>

              {timerError && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{timerError}</p>}
              {/* Sayfa satırları */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Başlangıç Sayfası
                  </label>
                  <input
                    type="number"
                    placeholder="Örn: 1"
                    value={logStartPage}
                    disabled={mode === "auto" && !!timer}
                    onChange={(e) => setLogStartPage(e.target.value)}
                    className="min-h-12 min-w-0 w-full px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 dark:bg-slate-900 dark:border-slate-700 dark:focus:ring-slate-500/40"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Bitiş Sayfası
                  </label>
                  <input
                    type="number"
                    placeholder="Örn: 25"
                    value={logEndPage}
                    min={logStartPage || "1"}
                    onChange={(e) => setLogEndPage(e.target.value)}
                    className="min-h-12 min-w-0 w-full px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 dark:bg-slate-900 dark:border-slate-700 dark:focus:ring-slate-500/40"
                  />
                </div>

                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Okunan Sayfa{" "}
                    <span className="ml-1 text-[10px] text-slate-400">
                      (otomatik)
                    </span>
                  </label>
                  <div className="min-h-12 min-w-0 w-full px-3 py-2.5 rounded-xl border border-amber-100 bg-amber-50/60 text-sm shadow-sm flex items-center gap-3 text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center dark:bg-slate-800">
                      <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                    </div>
                    <div className="flex flex-col">
                      {calculatedReadPages ? (
                        <>
                          <span className="text-[11px] text-slate-500">
                            Bu oturumda
                          </span>
                          <span className="text-sm font-semibold">
                            {calculatedReadPages} sayfa
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          Sayfa aralığı girildiğinde otomatik hesaplanır
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={saveLog} disabled={timerBusy || (mode === "auto" && timer?.status !== "finished")}
                  className="min-h-12 w-full rounded-2xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + Kayıt Ekle
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Okuma kayıtları listesi */}
      {logs.length === 0 ? (
        <div className="rounded-3xl border border-amber-100 bg-amber-50/40 shadow-sm dark:bg-slate-950/80 dark:border-slate-800 flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <CalendarDays className="w-6 h-6 text-amber-700 dark:text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Henüz okuma kaydı eklenmedi
          </p>
          <p className="text-xs mt-1 text-slate-500 dark:text-slate-500">
            Bu bölümde okuma ilerlemen otomatik olarak listelenecek.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-amber-100 bg-white shadow-sm dark:bg-slate-950/90 dark:border-slate-800">
          <div className="px-4 py-3 border-b border-amber-50 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[13px] md:text-sm font-semibold text-slate-700">
              OKUMA KAYITLARI
            </span>
            <span className="hidden md:inline text-[11px] uppercase tracking-wide text-slate-400">
              Son oturum en üstte
            </span>
          </div>
          <div className="p-3 md:p-4 space-y-3">
            <div className="hidden md:grid grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)] px-1 pb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              <span>Tarih &amp; Saat</span>
              <span className="text-right">Sayfa &amp; Okunan</span>
            </div>

            {logs.map((log, index) => {
              const isLast = index === 0;
              return (
                <div
                  key={log.id}
                  className={`rounded-2xl border px-3 py-3 md:px-4 md:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2 ${
                    isLast
                      ? "bg-amber-50/80 border-amber-200 dark:bg-slate-900/70 dark:border-amber-500/40"
                      : "bg-white border-amber-100 dark:bg-slate-900/60 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-start gap-3 md:w-2/3">
                    <div className="mt-1">
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-slate-800 flex items-center justify-center">
                        <CalendarDays className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {log.date}
                        </span>
                        {log.startTime && log.endTime && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {log.startTime} - {log.endTime}
                          </span>
                        )}
                        {isLast && (
                          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500 text-white">
                            Son okuma
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 mt-0.5">
                        Sayfa {log.startPage} → {log.endPage}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 md:w-1/3">
                    <div className="text-xs text-slate-500">
                      Toplam{" "}
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {log.totalRead}
                      </span>{" "}
                      sayfa
                    </div>
                    <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      + {log.totalRead} sayfa
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================== NOTES TAB ============================== */

interface NotesTabProps {
  bookStatus: Book["status"];
  notes: any[];
  newNote: string;
  setNewNote: (v: string) => void;
  newNotePage: string;
  setNewNotePage: (v: string) => void;
  onAddNote: () => void;
}

function NotesTab({
  bookStatus,
  notes,
  newNote,
  setNewNote,
  newNotePage,
  setNewNotePage,
  onAddNote,
}: NotesTabProps) {
  const isToRead = bookStatus === "OKUNACAK";
  const isReading = bookStatus === "OKUNUYOR";
  const isRead = bookStatus === "OKUNDU";

  const title = isToRead
    ? "Genel Not Ekle"
    : isReading
    ? "Sayfa Notu Ekle"
    : "Değerlendirme Yaz";

  const textareaLabel = isToRead
    ? "Genel notun"
    : isReading
    ? "Notun"
    : "Kitap değerlendirmesi";

  const textareaPlaceholder = isToRead
    ? "Bu kitabı okumadan önceki düşüncelerin, beklentilerin..."
    : isReading
    ? "Bu oturumda dikkatini çekenler, alıntılar veya sayfa notların..."
    : "Kitap bittikten sonra genel değerlendirmeni, hislerini ve çıkarımlarını yaz.";

  return (
    <div className="space-y-4">
      {isToRead && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs md:text-sm text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
          Bu kitap şu anda <strong>&quot;Okunacak&quot;</strong> durumunda.
          Buradaki notlar, kitabı okumadan önceki{" "}
          <strong>genel notların</strong> olabilir. Sayfa bazlı notlar için
          kitabı okumaya başladıktan sonra
          <strong> Okuma Kayıtları</strong> sekmesine geçebilirsin.
        </div>
      )}

      {isReading && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs md:text-sm text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
          Kitap <strong>&quot;Okunuyor&quot;</strong> durumunda. Buradaki notlar
          için istersen sayfa numarası belirleyebilir, böylece belirli
          sayfalara ait notlarını daha sonra kolayca bulabilirsin.
        </div>
      )}

      {isRead && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-xs md:text-sm text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
          Bu kitap <strong>&quot;Okundu&quot;</strong>. Buradaki alanı{" "}
          <strong>değerlendirme</strong> ve genel düşüncelerini kaydetmek için
          kullanabilirsin.
        </div>
      )}

      <div className="rounded-3xl border border-amber-100 bg-white shadow-[0_12px_35px_rgba(0,0,0,0.06)] dark:bg-slate-950 dark:border-slate-800 p-5 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-amber-700 mb-4">
          {title}
        </h2>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {isReading && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Sayfa no (opsiyonel)
                </label>
                <input
                  type="number"
                  placeholder="Örn: 120"
                  value={newNotePage}
                  onChange={(e) => setNewNotePage(e.target.value)}
                  className="min-h-12 min-w-0 w-full px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 dark:bg-slate-900 dark:border-slate-700 dark:focus:ring-slate-500/40"
                />
              </div>
            )}

            <div
              className={
                isReading
                  ? "md:col-span-3 flex flex-col gap-1"
                  : "md:col-span-4 flex flex-col gap-1"
              }
            >
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {textareaLabel}
              </label>
              <textarea
                placeholder={textareaPlaceholder}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-12 min-w-0 w-full px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm shadow-sm min-h-[90px] focus:outline-none focus:ring-2 focus:ring-amber-400/40 dark:bg-slate-900 dark:border-slate-700 dark:focus:ring-slate-500/40"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onAddNote}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-sm shadow-md transition"
            >
              {isRead ? "Değerlendirme Kaydet" : "+ Not Ekle"}
            </button>
          </div>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-3xl border border-amber-100 bg-amber-50/40 shadow-sm dark:bg-slate-950/80 dark:border-slate-800 flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <Pencil className="w-6 h-6 text-amber-700 dark:text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Henüz {isRead ? "değerlendirme" : "not"} eklenmedi
          </p>
          <p className="text-xs mt-1 text-slate-500 dark:text-slate-500">
            {isRead
              ? "Kitabı bitirdikten sonra genel değerlendirmeni burada göreceksin."
              : "Eklediğin notlar burada listelenecek; sayfa numarası girersen ilgili sayfayla birlikte görünür."}
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-amber-100 bg-white shadow-sm dark:bg-slate-950/90 dark:border-slate-800">
          <div className="px-4 py-3 border-b border-amber-50 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {isRead ? "Değerlendirmeler / Notlar" : "Notlar"}
          </div>
          <div className="divide-y divide-amber-50 dark:divide-slate-800">
            {notes.map((note) => (
              <div
                key={note.id}
                className="px-4 py-3 text-sm flex flex-col gap-1 text-slate-700 dark:text-slate-200"
              >
                <div className="flex justify-between text-xs text-slate-500">
                  <div>
                    {note.page && isReading && <span>Sayfa {note.page}</span>}
                    {!note.page && isRead && <span>Değerlendirme</span>}
                  </div>
                  {note.createdAt && (
                    <span>
                      {new Date(
                        note.createdAt.seconds
                          ? note.createdAt.seconds * 1000
                          : note.createdAt
                      ).toLocaleDateString("tr-TR")}
                    </span>
                  )}
                </div>
                <p>{note.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
