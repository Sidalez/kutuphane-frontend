// src/pages/SuggestionsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import type { Book } from "../types/book";
import { api } from "../apiClient";
import SuggestionsStorefront from "../components/books/SuggestionsStorefront";


type RecommendGoal = "choose_library_book" | "choose_new_book";

interface AiResponse {
  text: string;
  books?: Array<{ title: string; author: string; genre: string; summary: string; reason: string; coverImageUrl?: string; publisher?: string | null; pageCount?: number | null; publishYear?: string | null; isbn?: string | null; editionSource?: string }>;
}

type AiSection = {
  title: string;
  items: string[];
};

type ParsedSuggestion = {
  title: string;
  author: string;
  publisher: string;
  pageCount: string;
  genre: string;
  summary: string;
  reason: string;
};

function diffInDays(start?: string | null, end?: string | null) {
  if (!start || !end) return null;

  const s = new Date(start);
  const e = new Date(end);

  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;

  const ms = e.getTime() - s.getTime();

  if (ms <= 0) return null;

  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function cleanAiLine(line: string) {
  return line
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/g, "")
    .replace(/^\d+\)\s*/g, "")
    .replace(/^\d+\.\s*/g, "")
    .replace(/^[-•]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSectionTitle(line: string) {
  const cleaned = cleanAiLine(line).toLowerCase();

  if (cleaned.includes("kısa profil")) return "Kısa Profil Özeti";
  if (cleaned.includes("öneri stratej")) return "Öneri Stratejisi";

  if (cleaned.includes("kesinlikle başlaman")) {
    return "Kesinlikle Başlaman Gerekenler";
  }

  if (cleaned.includes("başlaman gereken")) {
    return "Kesinlikle Başlaman Gerekenler";
  }

  if (cleaned.includes("satın alman")) {
    return "Satın Alabileceğin Öneriler";
  }

  if (cleaned.includes("satın alabileceğin")) {
    return "Satın Alabileceğin Öneriler";
  }

  if (cleaned.includes("kendimi şanslı")) {
    return "Kendimi Şanslı Hissediyorum";
  }

  if (cleaned.includes("şanslı öneri")) {
    return "Kendimi Şanslı Hissediyorum";
  }

  return null;
}

function isNewAiItem(line: string) {
  const trimmed = line.trim();

  return /^[-•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed);
}

function isDetailLine(line: string) {
  const cleaned = cleanAiLine(line).toLowerCase();

  return (
    cleaned.startsWith("sayfa") ||
    cleaned.startsWith("sayfa sayısı") ||
    cleaned.startsWith("içerik") ||
    cleaned.startsWith("konu") ||
    cleaned.startsWith("neden") ||
    cleaned.startsWith("açıklama") ||
    cleaned.startsWith("tür") ||
    cleaned.startsWith("tur") ||
    cleaned.startsWith("tema") ||
    cleaned.startsWith("yazar") ||
    cleaned.startsWith("kategori") ||
    cleaned.startsWith("puan") ||
    cleaned.startsWith("durum") ||
    cleaned.startsWith("okuma") ||
    cleaned.startsWith("özet") ||
    cleaned.startsWith("ozet") ||
    cleaned.startsWith("yayınevi") ||
    cleaned.startsWith("yayinevi") ||
    cleaned.startsWith("yayın evi") ||
    cleaned.startsWith("yayin evi") ||
    cleaned.startsWith("publisher")
  );
}

function parseAiResult(text: string | null): AiSection[] {
  if (!text) return [];

  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: AiSection[] = [];
  let current: AiSection | null = null;

  for (const line of lines) {
    const title = getSectionTitle(line);

    if (title) {
      current = {
        title,
        items: [],
      };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = {
        title: "Yapay Zekâ Yorumu",
        items: [],
      };
      sections.push(current);
    }

    const cleaned = cleanAiLine(line);
    if (!cleaned) continue;

    const shouldStartNewItem =
      isNewAiItem(line) || current.items.length === 0;

    if (shouldStartNewItem && !isDetailLine(line)) {
      current.items.push(cleaned);
    } else {
      const lastIndex = current.items.length - 1;

      if (lastIndex >= 0) {
        current.items[lastIndex] = `${current.items[lastIndex]} ${cleaned}`;
      } else {
        current.items.push(cleaned);
      }
    }
  }

  return sections.filter((section) => section.items.length > 0);
}

function normalizeFieldText(value: string) {
  return cleanAiLine(value)
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getFieldValue(text: string, labels: string[]) {
  const allLabels = [
    "Kitap",
    "Kitap Adı",
    "Başlık",
    "Baslik",
    "Title",
    "Yazar",
    "Yazar Adı",
    "Author",
    "Yayinevi",
    "Yayınevi",
    "Yayın evi",
    "Yayin evi",
    "Yayıncı",
    "Yayinci",
    "Publisher",
    "Sayfa",
    "Sayfa Sayısı",
    "Sayfa sayısı",
    "Page",
    "Pages",
    "Tur",
    "Tür",
    "Kategori",
    "Genre",
    "Ozet",
    "Özet",
    "Konu",
    "Summary",
    "Neden",
    "Gerekçe",
    "Gerekce",
    "Reason",
  ]
    .map(escapeRegex)
    .join("|");

  for (const label of labels.map(escapeRegex)) {
    const regex = new RegExp(
      `(?:^|\\s*(?:\\||—|-|;)\\s*)${label}\\s*:\\s*([\\s\\S]*?)(?=\\s*(?:\\||—|-|;)\\s*(?:${allLabels})\\s*:|$)`,
      "i"
    );

    const match = text.match(regex);

    if (match?.[1]) {
      const value = match[1]
        .replace(/\s*\|\s*$/g, "")
        .replace(/\s*[—-]\s*$/g, "")
        .replace(/\s*;\s*$/g, "")
        .trim();

      if (value) return value;
    }
  }

  return "";
}

function stripKnownFields(text: string) {
  return text
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Kitap(?: Adı)?\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Başlık\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Baslik\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Title\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Yazar(?: Adı)?\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Author\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Yay[ıi]nevi\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Yay[ıi]n evi\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Yay[ıi]ncı\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Publisher\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Sayfa(?: Sayısı)?\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Pages?\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)T[üu]r\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Kategori\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Genre\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)[ÖO]zet\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Konu\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Summary\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Neden\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Gerek[çc]e\s*:\s*[^|—;]+/gi, "")
    .replace(/(?:^|\s*(?:\||—|-|;)\s*)Reason\s*:\s*[^|—;]+/gi, "")
    .replace(/[|;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePurchaseSuggestion(item: string): ParsedSuggestion {
  const cleaned = normalizeFieldText(item);

  let title =
    getFieldValue(cleaned, ["Kitap", "Kitap Adı", "Başlık", "Baslik", "Title"]) ||
    "";

  let author =
    getFieldValue(cleaned, ["Yazar", "Yazar Adı", "Author"]) || "";

  const publisher =
    getFieldValue(cleaned, [
      "Yayinevi",
      "Yayınevi",
      "Yayın evi",
      "Yayin evi",
      "Yayıncı",
      "Yayinci",
      "Publisher",
    ]) || "Bilinmiyor";

  const pageCount =
    getFieldValue(cleaned, ["Sayfa", "Sayfa Sayısı", "Sayfa sayısı", "Page", "Pages"]) ||
    "Bilinmiyor";

  const genre =
    getFieldValue(cleaned, ["Tur", "Tür", "Kategori", "Genre"]) ||
    "Belirtilmemiş";

  const summary =
    getFieldValue(cleaned, ["Ozet", "Özet", "Konu", "Summary"]) || "";

  let reason =
    getFieldValue(cleaned, ["Neden", "Gerekçe", "Gerekce", "Reason"]) || "";

  if (!title || !author) {
    const parts = cleaned
      .split(/\s+—\s+|\s+-\s+/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (!title && parts[0]) {
      title = parts[0]
        .replace(/^Kitap\s*:\s*/i, "")
        .replace(/^Kitap Adı\s*:\s*/i, "")
        .replace(/^Başlık\s*:\s*/i, "")
        .replace(/^Baslik\s*:\s*/i, "")
        .replace(/^Title\s*:\s*/i, "")
        .trim();
    }

    if (!author && parts[1] && !parts[1].includes(":")) {
      author = parts[1]
        .replace(/^Yazar\s*:\s*/i, "")
        .replace(/^Yazar Adı\s*:\s*/i, "")
        .replace(/^Author\s*:\s*/i, "")
        .trim();
    }

    if (!reason) {
      const fallbackReason = stripKnownFields(parts.slice(2).join(" — "));
      reason = fallbackReason;
    }
  }

  if (!reason) {
    reason =
      "Bu kitap, okuma zevkine ve mevcut profiline uygun bir öneri olarak öne çıkıyor.";
  }

  return {
    title: title || "Kitap adı bulunamadı",
    author: author || "Bilinmiyor",
    publisher,
    pageCount,
    genre,
    summary,
    reason,
  };
}

export default function SuggestionsPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);

  const [goal, setGoal] = useState<RecommendGoal>("choose_new_book");
  const [mood, setMood] = useState("Normal");
  const [availableMinutes, setAvailableMinutes] = useState("30");
  const [preferenceText, setPreferenceText] = useState(
    "Bugün hafif ama ilham verici bir şeyler okumak istiyorum."
  );
  const tone = "motive";

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [suggestedBooks, setSuggestedBooks] = useState<NonNullable<AiResponse["books"]>>([]);


  useEffect(() => {
    if (!user) return;

    const fetchBooks = async () => {
      setLoadingBooks(true);

      try {
        const qBooks = query(
          collection(db, "books"),
          where("userId", "==", user.uid)
        );

        const snap = await getDocs(qBooks);
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Book)
        );

        setBooks(data);
      } catch (err) {
        console.error("Kitaplar çekilirken hata:", err);
      } finally {
        setLoadingBooks(false);
      }
    };

    fetchBooks();
  }, [user]);

  const {
    summary,
    readerProfile,
    rankedCandidates,
    topMustRead,
    secondaryGood,
  } = useMemo(() => {
    const total = books.length;
    const toRead = books.filter((b) => b.status === "OKUNACAK");
    const reading = books.filter((b) => b.status === "OKUNUYOR");
    const done = books.filter((b) => b.status === "OKUNDU");

    const totalPages = books.reduce((sum, b) => sum + (b.totalPages || 0), 0);
    const donePages = done.reduce((sum, b) => sum + (b.totalPages || 0), 0);

    const ratedFinished = done.filter(
      (b) =>
        (b.finalRating ?? null) !== null ||
        (b.overallRating ?? null) !== null
    );

    const avgFinishedRating =
      ratedFinished.length > 0
        ? ratedFinished.reduce(
            (sum, b) => sum + (b.overallRating || b.finalRating || 0),
            0
          ) / ratedFinished.length
        : null;

    const favCategoryCount: Record<string, number> = {};

    ratedFinished.forEach((b) => {
      const score = b.overallRating || b.finalRating || 0;

      if (score >= 4 && Array.isArray(b.categories)) {
        b.categories.forEach((c) => {
          if (!c) return;
          favCategoryCount[c] = (favCategoryCount[c] || 0) + 1;
        });
      }
    });

    const favCategories = Object.entries(favCategoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const speeds: number[] = [];

    done.forEach((b) => {
      if (!b.totalPages) return;

      const days = diffInDays(b.startDate, b.endDate);
      if (!days) return;

      const spd = b.totalPages / days;
      if (spd > 0 && spd < 1000) speeds.push(spd);
    });

    const avgPagesPerDay =
      speeds.length > 0
        ? Math.round(
            (speeds.reduce((s, x) => s + x, 0) / speeds.length) * 10
          ) / 10
        : null;

    let speedLabel = "Veri yetersiz";

    if (avgPagesPerDay) {
      if (avgPagesPerDay < 10) speedLabel = "Yavaş / keyifli tempo";
      else if (avgPagesPerDay < 30) speedLabel = "Orta düzey, dengeli tempo";
      else speedLabel = "Hızlı okur";
    }

    const summaryText = `
Toplam kitap: ${total}
Okunacak: ${toRead.length}
Okunuyor: ${reading.length}
Okundu: ${done.length}
Toplam sayfa: ${totalPages}
Tamamlanan sayfa: ${donePages}
Okunmuş kitap ortalama puanı: ${
      avgFinishedRating ? avgFinishedRating.toFixed(2) : "bilinmiyor"
    }
Tahmini okuma hızı (sayfa/gün): ${
      avgPagesPerDay ?? "bilinmiyor"
    } (${speedLabel})
Favori kategoriler: ${
      favCategories.length > 0 ? favCategories.join(", ") : "henüz net değil"
    }
    `.trim();

    const sampleBooks = books.slice(0, 10).map((b) => {
      const s =
        b.status === "OKUNUYOR"
          ? "Okunuyor"
          : b.status === "OKUNDU"
          ? "Okundu"
          : "Okunacak";

      return `${b.title} - ${b.author || "Bilinmiyor"} (${s}) • Kategori: ${
        b.categories?.join(", ") || "-"
      } • Puan: ${
        b.overallRating || b.finalRating || b.expectedRating || "-"
      }`;
    });

    const candidates = books.filter(
      (b) => b.status === "OKUNACAK" || b.status === "OKUNUYOR"
    );

    const rankedCandidates = candidates
      .map((b) => {
        let score = 0;

        if (b.status === "OKUNUYOR") score += 8;
        if (b.status === "OKUNACAK") score += 5;

        const rating =
          b.overallRating || b.expectedRating || b.progressRating || 0;

        score += rating * 2;

        let catBoost = 0;

        if (Array.isArray(b.categories) && favCategories.length > 0) {
          b.categories.forEach((c) => {
            if (favCategories.includes(c)) catBoost += 3;
          });
        }

        score += catBoost;

        if (avgPagesPerDay && b.totalPages) {
          const idealMin = avgPagesPerDay * 4;
          const idealMax = avgPagesPerDay * 12;

          if (b.totalPages >= idealMin && b.totalPages <= idealMax) {
            score += 4;
          }
        }

        return { book: b, score };
      })
      .sort((a, b) => b.score - a.score);

    const topMustRead = rankedCandidates.slice(0, 3).map((x) => x.book);
    const secondaryGood = rankedCandidates.slice(3, 6).map((x) => x.book);

    return {
      summary: {
        total,
        toReadCount: toRead.length,
        readingCount: reading.length,
        doneCount: done.length,
        totalPages,
        donePages,
        summaryText,
        sampleBooks,
      },
      readerProfile: {
        avgFinishedRating,
        favCategories,
        avgPagesPerDay,
        speedLabel,
      },
      rankedCandidates,
      topMustRead,
      secondaryGood,
    };
  }, [books]);

  const aiSections = useMemo(() => parseAiResult(aiResult), [aiResult]);

  const handleGenerate = async () => {
    setAiError(null);
    setAiResult(null);
    setSuggestedBooks([]);
    setAiLoading(true);

    try {
      const payload = {
        goal,
        mood,
        availableMinutes: Number(availableMinutes) || 0,
        preferenceText,
        tone,
        summary: summary.summaryText,
        sampleBooks: summary.sampleBooks,
        readerProfile,
        candidateBooks: rankedCandidates.map((x) => x.book).map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          publisher: b.publisher || null,
          publishYear: b.publishYear || null,
          isbn: b.isbn || null,
          status: b.status,
          totalPages: b.totalPages || null,
          pagesRead: b.pagesRead || 0,
          expectedRating: b.expectedRating || null,
          progressRating: b.progressRating || null,
          finalRating: b.finalRating || null,
          overallRating: b.overallRating || null,
          categories: b.categories || [],
        })),
      };

      const res = await api.post<AiResponse>("/api/ai/recommend", payload);
      const data = res.data;

      setAiResult(data.text || "Herhangi bir öneri üretilemedi.");
      setSuggestedBooks(data.books || []);
    } catch (err: any) {
      console.error(err);
      setAiError(err.response?.data?.message || err.message || "Öneriler alınırken bir hata oluştu.");
    } finally {
      setAiLoading(false);
    }
  };

  const displayedSuggestions = suggestedBooks.length ? suggestedBooks : aiSections
    .filter(section => ["Kesinlikle Başlaman Gerekenler", "Satın Alabileceğin Öneriler"].includes(section.title))
    .flatMap(section => section.items.map(parsePurchaseSuggestion));

  return <SuggestionsStorefront
    books={books} suggestions={displayedSuggestions} loadingBooks={loadingBooks}
    loading={aiLoading} error={aiError} result={aiResult} sections={aiSections}
    goal={goal} onGoalChange={setGoal} mood={mood} onMoodChange={setMood}
    minutes={availableMinutes} onMinutesChange={setAvailableMinutes}
    preference={preferenceText} onPreferenceChange={setPreferenceText}
    onGenerate={handleGenerate}
  />;
}
