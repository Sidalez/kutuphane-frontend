import { useEffect, useState, useMemo, useRef } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import type { Book, BookStatus } from "../types/book";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Zap,
  Clock,
  Award,
  Flame,
  Target,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  Table2,
  LayoutDashboard,
  Library,
  Search,
  Calendar,
  Star,
  Activity,
  BookOpen,
  BookOpenCheck,
} from "lucide-react";

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e"];

interface LogData {
  date: string;
  startTime?: string;
  endTime?: string;
  totalRead: number;
  bookId: string;
}

type TabType = "dashboard" | "books" | "shelves";
type ViewMode = "week" | "month" | "year";
type MetricMode = "pages" | "time";

const formatDuration = (minutes: number) => {
  if (!minutes || minutes === 0) return "0dk";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}dk`;
  return `${h}sa ${m}dk`;
};

const calculateMinutes = (start?: string, end?: string) => {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  return Math.max(0, h2 * 60 + m2 - (h1 * 60 + m1));
};

export default function StatisticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [allLogs, setAllLogs] = useState<(LogData & { bookId: string })[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [metricMode, setMetricMode] = useState<MetricMode>("pages");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [tableFilter, setTableFilter] = useState<BookStatus | "ALL">("ALL");
  const reportRef = useRef<HTMLDivElement>(null);

  // ----------------- VERİ ÇEKME -----------------
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const booksQuery = query(
          collection(db, "books"),
          where("userId", "==", user.uid)
        );
        const booksSnap = await getDocs(booksQuery);
        const booksData = booksSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Book)
        );
        setBooks(booksData);

        const logsPromises = booksSnap.docs.map(async (bookDoc) => {
          const logsSnap = await getDocs(
            collection(db, "books", bookDoc.id, "logs")
          );
          return logsSnap.docs.map(
            (d) =>
              ({ ...d.data(), bookId: bookDoc.id } as LogData & {
                bookId: string;
              })
          );
        });

        const logsResults = await Promise.all(logsPromises);
        const flatLogs = logsResults
          .flat()
          .sort((a, b) => a.date.localeCompare(b.date));
        setAllLogs(flatLogs);
      } catch (error) {
        console.error("Veri hatası:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // ----------------- PDF EXPORT -----------------
  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Okuma_Raporu_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error("PDF Hatası:", e);
      alert("PDF oluşturulurken hata oluştu.");
    } finally {
      setExporting(false);
    }
  };

  // ----------------- TARİH NAV -----------------
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") newDate.setDate(currentDate.getDate() - 7);
    if (viewMode === "month") newDate.setMonth(currentDate.getMonth() - 1);
    if (viewMode === "year") newDate.setFullYear(currentDate.getFullYear() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") newDate.setDate(currentDate.getDate() + 7);
    if (viewMode === "month") newDate.setMonth(currentDate.getMonth() + 1);
    if (viewMode === "year") newDate.setFullYear(currentDate.getFullYear() + 1);
    setCurrentDate(newDate);
  };

  // ----------------- İSTATİSTİK MOTORU -----------------
  const stats = useMemo(() => {
    if (allLogs.length === 0 && books.length === 0) return null;

    const start = new Date(currentDate);
    let end = new Date(currentDate);
    let periodLabel = "";

    if (viewMode === "week") {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      periodLabel = `${start.getDate()} ${start.toLocaleDateString("tr-TR", {
        month: "short",
      })} - ${end.getDate()} ${end.toLocaleDateString("tr-TR", {
        month: "short",
      })}`;
    } else if (viewMode === "month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      periodLabel = start.toLocaleDateString("tr-TR", {
        month: "long",
        year: "numeric",
      });
    } else {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      periodLabel = start.getFullYear().toString();
    }

    // Günlük toplamlar
    const dailyPagesMap = new Map<string, number>();
    const dailyTimeMap = new Map<string, number>();
    let totalPages = 0;
    let totalMinutes = 0;

    allLogs.forEach((log) => {
      const dStr = log.date;
      const pages = Number(log.totalRead) || 0;
      const mins = calculateMinutes(log.startTime, log.endTime);

      dailyPagesMap.set(dStr, (dailyPagesMap.get(dStr) || 0) + pages);
      if (mins > 0) {
        dailyTimeMap.set(dStr, (dailyTimeMap.get(dStr) || 0) + mins);
        totalMinutes += mins;
      }
      totalPages += pages;
    });

    // Dönemsel logs
    const periodLogs = allLogs.filter((l) => {
      const d = new Date(l.date);
      return d >= start && d <= end;
    });
    const periodPages = periodLogs.reduce(
      (acc, l) => acc + Number(l.totalRead),
      0
    );
    const periodMinutes = periodLogs.reduce(
      (acc, l) => acc + calculateMinutes(l.startTime, l.endTime),
      0
    );

    // Streak hesapları
    const sortedDates = Array.from(dailyPagesMap.keys()).sort();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    let currentStreak = 0;
    let tempDate = new Date();
    if (!dailyPagesMap.has(todayStr)) tempDate.setDate(tempDate.getDate() - 1);

    while (true) {
      const dStr = tempDate.toISOString().slice(0, 10);
      if (dailyPagesMap.has(dStr)) {
        currentStreak++;
        tempDate.setDate(tempDate.getDate() - 1);
      } else break;
    }

    let longestStreak = 0,
      tempStreak = 0;
    for (let i = 0; i < sortedDates.length; i++) {
      const d = new Date(sortedDates[i]);
      const prev = i > 0 ? new Date(sortedDates[i - 1]) : null;
      if (prev) {
        const diff =
          (d.getTime() - prev.getTime()) / (1000 * 3600 * 24);
        if (diff === 1) tempStreak++;
        else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      } else tempStreak = 1;
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // Okuma hızı
    const totalHours = totalMinutes / 60;
    const speed =
      totalHours > 0 ? Math.round(totalPages / totalHours) : 0;

    // Kitap durumları
    const completedBooks = books.filter((b) => b.status === "OKUNDU");
    const inProgressBooks = books.filter(
      (b) => b.status === "OKUNUYOR"
    );
    const plannedBooks = books.filter((b) => b.status === "OKUNACAK");

    const statusSummary = {
      OKUNACAK: {
        count: plannedBooks.length,
        pages: plannedBooks.reduce(
          (acc, b) => acc + (b.totalPages || 0),
          0
        ),
      },
      OKUNUYOR: {
        count: inProgressBooks.length,
        pages: inProgressBooks.reduce(
          (acc, b) => acc + (b.totalPages || 0),
          0
        ),
      },
      OKUNDU: {
        count: completedBooks.length,
        pages: completedBooks.reduce(
          (acc, b) => acc + (b.totalPages || 0),
          0
        ),
      },
    };

    // Bugün / dün / son 7 gün karşılaştırma
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const todayPages = dailyPagesMap.get(todayStr) || 0;
    const todayMinutes = dailyTimeMap.get(todayStr) || 0;
    const yesterdayPages = dailyPagesMap.get(yesterdayStr) || 0;
    const yesterdayMinutes = dailyTimeMap.get(yesterdayStr) || 0;

    let last7Pages = 0;
    let last7Minutes = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      last7Pages += dailyPagesMap.get(ds) || 0;
      last7Minutes += dailyTimeMap.get(ds) || 0;
    }
    const last7Avg = {
      pages: Math.round(last7Pages / 7),
      minutes: Math.round(last7Minutes / 7),
    };

    // Tahmin: aktif kitap (eski tekli)
    const currentBook = inProgressBooks[0];
    let forecast: {
      title: string;
      remaining: number;
      daysLeft: number;
      date: string;
      cover?: string | null;
    } | null = null;
    if (
      currentBook &&
      currentBook.totalPages &&
      currentBook.pagesRead !== undefined
    ) {
      const remaining = currentBook.totalPages - (currentBook.pagesRead || 0);
      const activeDays = new Set(periodLogs.map((l) => l.date));
      const dailyAvg =
        activeDays.size > 0
          ? Math.round(periodPages / activeDays.size)
          : 20;
      if (remaining > 0 && dailyAvg > 0) {
        const daysLeft = Math.ceil(remaining / dailyAvg);
        const finishDate = new Date();
        finishDate.setDate(finishDate.getDate() + daysLeft);
        forecast = {
          title: currentBook.title,
          remaining,
          daysLeft,
          date: finishDate.toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
          }),
          cover: currentBook.coverImageUrl || null,
        };
      }
    }

    // Tüm OKUNUYOR kitaplar için tahmin
    const inProgressForecasts = inProgressBooks
      .map((b) => {
        if (!b.totalPages) return null;
        const remaining = b.totalPages - (b.pagesRead || 0);
        if (remaining <= 0) return null;

        const last21 = new Date();
        last21.setDate(today.getDate() - 21);

        const bookLogsRecent = allLogs.filter(
          (l) =>
            l.bookId === b.id && new Date(l.date) >= last21
        );
        const recentPages = bookLogsRecent.reduce(
          (acc, l) => acc + Number(l.totalRead || 0),
          0
        );
        const recentDays =
          new Set(bookLogsRecent.map((l) => l.date)).size || 0;

        let dailyAvg = 0;
        if (recentPages > 0 && recentDays > 0) {
          dailyAvg = recentPages / recentDays;
        } else {
          const activeDays =
            new Set(periodLogs.map((l) => l.date)).size || 0;
          dailyAvg =
            activeDays > 0
              ? periodPages / activeDays
              : 20;
        }

        if (dailyAvg <= 0) dailyAvg = 20;

        const daysLeft = Math.ceil(remaining / dailyAvg);
        const finishDate = new Date();
        finishDate.setDate(finishDate.getDate() + daysLeft);

        return {
          book: b,
          remaining,
          dailyAvg: Math.round(dailyAvg),
          daysLeft,
          date: finishDate.toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
          }),
        };
      })
      .filter(Boolean) as {
      book: Book;
      remaining: number;
      dailyAvg: number;
      daysLeft: number;
      date: string;
    }[];

    // Grafik verisi
    const chartData: { name: string; pages: number; minutes: number }[] = [];
    if (viewMode === "week") {
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const dStr = d.toISOString().slice(0, 10);
        const dayName = d.toLocaleDateString("tr-TR", {
          weekday: "short",
        });
        chartData.push({
          name: dayName,
          pages: dailyPagesMap.get(dStr) || 0,
          minutes: dailyTimeMap.get(dStr) || 0,
        });
      }
    } else if (viewMode === "month") {
      const days = end.getDate();
      for (let i = 1; i <= days; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), i);
        const dStr = d.toISOString().slice(0, 10);
        chartData.push({
          name: String(i),
          pages: dailyPagesMap.get(dStr) || 0,
          minutes: dailyTimeMap.get(dStr) || 0,
        });
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const mStart = new Date(start.getFullYear(), i, 1);
        const mName = mStart.toLocaleDateString("tr-TR", {
          month: "short",
        });
        const prefix = `${start.getFullYear()}-${String(i + 1).padStart(
          2,
          "0"
        )}`;
        let p = 0,
          m = 0;
        dailyPagesMap.forEach((v, k) => {
          if (k.startsWith(prefix)) p += v;
        });
        dailyTimeMap.forEach((v, k) => {
          if (k.startsWith(prefix)) m += v;
        });
        chartData.push({ name: mName, pages: p, minutes: m });
      }
    }

    // Raf & kategori istatistikleri
    const shelfStatsMap: Record<
      string,
      { count: number; pages: number; ratingSum: number; ratingCount: number }
    > = {};
    books.forEach((b) => {
      const shelf = b.shelf || "Rafsız";
      if (!shelfStatsMap[shelf]) {
        shelfStatsMap[shelf] = {
          count: 0,
          pages: 0,
          ratingSum: 0,
          ratingCount: 0,
        };
      }
      shelfStatsMap[shelf].count++;
      shelfStatsMap[shelf].pages += b.pagesRead || 0;
      const r = b.finalRating ?? b.overallRating;
      if (r && r > 0) {
        shelfStatsMap[shelf].ratingSum += r;
        shelfStatsMap[shelf].ratingCount++;
      }
    });
    const shelfStats = Object.entries(shelfStatsMap).map(
      ([name, v]) => ({
        name,
        count: v.count,
        pages: v.pages,
        avgRating:
          v.ratingCount > 0
            ? v.ratingSum / v.ratingCount
            : 0,
      })
    );

    const categoryMap: Record<string, number> = {};
    books.forEach((b) => {
      const c = b.categories?.[0] || "Diğer";
      categoryMap[c] = (categoryMap[c] || 0) + 1;
    });
    const categoryData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Heatmap son 30 gün
    const heatmap: { date: string; label: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const value = dailyPagesMap.get(dStr) || 0;
      heatmap.push({
        date: dStr,
        label: d.toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
        }),
        value,
      });
    }

    // En yoğun gün
    let busiestDay: { date: string; value: number } | null = null;
    dailyPagesMap.forEach((val, key) => {

     const bd: any = busiestDay;
  let message = ""; // ✅ BURAYI EKLE
if (bd && bd.value > 0) {
  const d = new Date(bd.date);
  message += `\n\nAyrıca ${d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })} tarihinde ${bd.value.toLocaleString()} sayfa ile rekor kırmışsın.`;
}

    });

    // En'ler
    const topByRating = [...completedBooks]
      .filter((b) => (b.finalRating ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.finalRating ?? 0) - (a.finalRating ?? 0)
      )
      .slice(0, 3);

    const topByPages = [...completedBooks]
      .filter((b) => (b.totalPages || 0) > 0)
      .sort(
        (a, b) =>
          (b.totalPages || 0) - (a.totalPages || 0)
      )
      .slice(-3)
      .reverse();

    const bookMinutesMap: Record<string, number> = {};
    allLogs.forEach((l) => {
      const mins = calculateMinutes(l.startTime, l.endTime);
      if (mins > 0) {
        bookMinutesMap[l.bookId] =
          (bookMinutesMap[l.bookId] || 0) + mins;
      }
    });
    const topByTime = [...completedBooks]
      .map((b) => ({
        book: b,
        mins: bookMinutesMap[b.id] || 0,
      }))
      .sort((a, b) => b.mins - a.mins)
      .slice(0, 3);

    // "AI benzeri" akıllı yorumlar
    const insights: string[] = [];

    if (periodPages > 0) {
      insights.push(
        `Seçili dönemde ${periodPages.toLocaleString()} sayfa okudun ve ${formatDuration(
          periodMinutes
        )} zaman harcadın.`
      );
    }

    if (speed > 0) {
      insights.push(
        `Ortalama okuma hızın yaklaşık ${speed} sayfa/saat.`
      );
    }

    if (currentStreak >= 3) {
      insights.push(
        `${currentStreak} gündür üst üste okuyorsun, bu çok güçlü bir alışkanlık sinyali.`
      );
    } else if (currentStreak === 0 && periodPages > 0) {
      insights.push(
        `Bu dönemde okuma yaptın ama zincir kesilmiş görünüyor. Küçük hedeflerle tekrar seri oluşturabilirsin.`
      );
    }

  const bd = busiestDay as { value: number; date: string } | null;

if (bd && bd.value > 0) {
  const d = new Date(bd.date);

  insights.push(
    `${d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
    })} tarihinde ${bd.value.toLocaleString()} sayfa ile rekor kırmışsın.`
  );
}
    if (categoryData.length > 0) {
      const topCat = categoryData[0];
      insights.push(
        `En çok okuduğun kategori "${topCat.name}" (${topCat.value} kitap).`
      );
    }

    if (completedBooks.length > 0 && plannedBooks.length > 0) {
      insights.push(
        `Okuduğun kitap sayısı (${completedBooks.length}) ile sırada bekleyen kitap sayısı (${plannedBooks.length}) güzel bir dengede görünüyor.`
      );
    }

    const suggestion =
      insights.length > 0
        ? insights
        : [
            "Daha fazla okuma kaydı ekledikçe, okuma alışkanlıkların hakkında daha zengin analizler göreceksin.",
          ];

    return {
      periodLabel,
      periodPages,
      periodMinutes,
      currentStreak,
      longestStreak,
      chartData,
      speed,
      forecast,
      shelfStats,
      categoryData,
      heatmap,
      busiestDay,
      completedCount: completedBooks.length,
      inProgressCount: inProgressBooks.length,
      plannedCount: plannedBooks.length,
      topByRating,
      topByPages,
      topByTime,
      aiInsights: suggestion,
      totalPages,
      totalMinutes,
      statusSummary,
      todaySummary: { pages: todayPages, minutes: todayMinutes },
      yesterdaySummary: {
        pages: yesterdayPages,
        minutes: yesterdayMinutes,
      },
      last7Avg,
      inProgressForecasts,
    };
  }, [allLogs, books, viewMode, currentDate]);

  // ----------------- TABLO VERİSİ -----------------
  const tableData = useMemo(() => {
    return books
      .filter((b) => {
        if (tableFilter !== "ALL" && b.status !== tableFilter)
          return false;
        if (tableSearch) {
          const q = tableSearch.toLowerCase();
          return (
            b.title.toLowerCase().includes(q) ||
            (b.author || "").toLowerCase().includes(q)
          );
        }
        return true;
      })
      .map((b) => {
        const bookLogs = allLogs.filter((l) => l.bookId === b.id);
        const totalMins = bookLogs.reduce(
          (acc, l) =>
            acc + calculateMinutes(l.startTime, l.endTime),
          0
        );
        return { ...b, totalMins };
      });
  }, [books, allLogs, tableFilter, tableSearch]);

  if (loading)
    return (
      <div className="p-20 text-center flex justify-center text-slate-500">
        <Loader2 className="animate-spin mr-2" /> Veriler yükleniyor...
      </div>
    );

  return (
    <div
      className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 text-slate-800 dark:text-slate-100"
      ref={reportRef}
    >
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-400 to-orange-600 rounded-xl shadow-lg shadow-orange-500/20">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            Okuma Raporu
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Toplam{" "}
            <strong>
              {(stats?.totalPages || 0).toLocaleString()} sayfa
            </strong>{" "}
            ve{" "}
            <strong>{formatDuration(stats?.totalMinutes || 0)}</strong>{" "}
            okuma süresi kaydın var.
          </p>
          {stats && (
            <p className="text-xs text-slate-400 mt-1">
              Tamamlanan kitaplar:{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {stats.completedCount}
              </span>{" "}
              • Devam eden:{" "}
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {stats.inProgressCount}
              </span>{" "}
              • Sırada bekleyen:{" "}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {stats.plannedCount}
              </span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-xl text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            PDF İndir
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-fit overflow-x-auto">
        {[
          {
            id: "dashboard",
            icon: LayoutDashboard,
            label: "Özet",
          },
          { id: "books", icon: Table2, label: "Kitap Listesi" },
          { id: "shelves", icon: Library, label: "Raflar" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white dark:bg-slate-800 shadow text-amber-600"
                : "text-slate-500"
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* ============= DASHBOARD TABI ============= */}
      {activeTab === "dashboard" && stats && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* TARİH + MOD */}
          <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-950 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
              {(["week", "month", "year"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                    viewMode === m
                      ? "bg-white dark:bg-slate-800 shadow text-amber-600"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {m === "week" ? "Hafta" : m === "month" ? "Ay" : "Yıl"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 px-4 py-2">
              <button
                onClick={handlePrev}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-lg font-bold min-w-[140px] text-center">
                {stats.periodLabel}
              </span>
              <button
                onClick={handleNext}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="hidden md:block w-32" />
          </div>

          {/* GÜNLÜK KARŞILAŞTIRMA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bugün */}
            <div className="bg-white dark:bg-slate-950 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Bugün
                </span>
              </div>
              <p className="text-xl font-black">
                {stats.todaySummary.pages}{" "}
                <span className="text-xs font-medium text-slate-500">
                  sf
                </span>
              </p>
              <p className="text-[11px] text-slate-400">
                {formatDuration(stats.todaySummary.minutes)}
              </p>
            </div>
            {/* Dün */}
            <div className="bg-white dark:bg-slate-950 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Dün
                </span>
              </div>
              <p className="text-xl font-black">
                {stats.yesterdaySummary.pages}{" "}
                <span className="text-xs font-medium text-slate-500">
                  sf
                </span>
              </p>
              <p className="text-[11px] text-slate-400">
                {formatDuration(stats.yesterdaySummary.minutes)}
              </p>
              <p className="text-[10px] mt-1 text-slate-500">
                Fark:{" "}
                {stats.todaySummary.pages - stats.yesterdaySummary.pages >=
                0 ? (
                  <span className="text-emerald-500 font-semibold">
                    +
                    {stats.todaySummary.pages -
                      stats.yesterdaySummary.pages}{" "}
                    sf
                  </span>
                ) : (
                  <span className="text-rose-500 font-semibold">
                    {stats.todaySummary.pages -
                      stats.yesterdaySummary.pages}{" "}
                    sf
                  </span>
                )}
              </p>
            </div>
            {/* Son 7 Gün Ort */}
            <div className="bg-white dark:bg-slate-950 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Son 7 Gün Ort.
                </span>
              </div>
              <p className="text-xl font-black">
                {stats.last7Avg.pages}{" "}
                <span className="text-xs font-medium text-slate-500">
                  sf/gün
                </span>
              </p>
              <p className="text-[11px] text-slate-400">
                {formatDuration(stats.last7Avg.minutes)} / gün
              </p>
            </div>
          </div>

          {/* KPI KARTLARI */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* SERİ */}
            <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 opacity-90">
                  <Flame className="w-5 h-5 text-yellow-300" />
                  <span className="text-xs font-bold">SERİ</span>
                </div>
                <p className="text-4xl font-black">
                  {stats.currentStreak}{" "}
                  <span className="text-lg font-medium opacity-80">
                    Gün
                  </span>
                </p>
                <p className="text-xs mt-1 opacity-80">
                  {stats.currentStreak > 0
                    ? "Harika! Zinciri kırma."
                    : "Bugün okuyarak yeni bir seri başlat."}
                </p>
              </div>
              <Flame className="absolute -bottom-4 -right-4 w-24 h-24 text-white/10" />
            </div>

            {/* DÖNEM SÜRE */}
            <div className="bg-white dark:bg-slate-950 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                  <Clock className="w-5 h-5 text-emerald-500" />
                </div>
              </div>
              <p className="text-xs text-slate-400 uppercase font-bold">
                Seçili Dönemde
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {formatDuration(stats.periodMinutes || 0)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                {stats.periodPages.toLocaleString()} sayfa
              </p>
            </div>

            {/* HIZ */}
            <div className="bg-white dark:bg-slate-950 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                  <Zap className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <p className="text-xs text-slate-400 uppercase font-bold">
                Okuma Hızı
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {stats.speed || 0}{" "}
                <span className="text-sm font-medium text-slate-500">
                  sf/saat
                </span>
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Tüm zaman toplam hızın
              </p>
            </div>

            {/* TAHMİN (TEK AKTİF ÖZET) */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-5 rounded-3xl shadow-lg">
              <div className="flex items-center gap-2 mb-2 text-indigo-300">
                <Target className="w-5 h-5" />
                <span className="text-xs font-bold">TAHMİN</span>
              </div>
              {stats.forecast ? (
                <>
                  <p className="text-xs font-bold uppercase truncate opacity-80">
                    {stats.forecast.title}
                  </p>
                  <p className="text-xl font-black mt-1">
                    {stats.forecast.date}
                  </p>
                  <p className="text-[10px] opacity-60">
                    {stats.forecast.daysLeft} gün içinde bitmesi
                    bekleniyor.
                  </p>
                </>
              ) : (
                <p className="text-sm opacity-60">
                  Aktif bir okuma görünmüyor. Yeni bir kitap seçip
                  başlayabilirsin.
                </p>
              )}
            </div>
          </div>

          {/* KİTAP DURUM ÖZET KARTLARI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* OKUNACAK */}
            <div className="bg-white dark:bg-slate-950 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                <Library className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Okunacak
                </p>
                <p className="text-lg font-bold">
                  {stats.statusSummary.OKUNACAK.count} kitap
                </p>
                <p className="text-[11px] text-slate-400">
                  Toplam{" "}
                  {stats.statusSummary.OKUNACAK.pages.toLocaleString()}{" "}
                  sayfa
                </p>
              </div>
            </div>
            {/* OKUNUYOR */}
            <div className="bg-white dark:bg-slate-950 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <BookOpen className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Okunuyor
                </p>
                <p className="text-lg font-bold">
                  {stats.statusSummary.OKUNUYOR.count} kitap
                </p>
                <p className="text-[11px] text-slate-400">
                  Toplam{" "}
                  {stats.statusSummary.OKUNUYOR.pages.toLocaleString()}{" "}
                  sayfa
                </p>
              </div>
            </div>
            {/* OKUNDU */}
            <div className="bg-white dark:bg-slate-950 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                <BookOpenCheck className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Okundu
                </p>
                <p className="text-lg font-bold">
                  {stats.statusSummary.OKUNDU.count} kitap
                </p>
                <p className="text-[11px] text-slate-400">
                  Toplam{" "}
                  {stats.statusSummary.OKUNDU.pages.toLocaleString()}{" "}
                  sayfa
                </p>
              </div>
            </div>
          </div>

          {/* GRAFİK + AI KOÇ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* GRAFİK */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Okuma Grafiği
                </h3>
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => setMetricMode("pages")}
                    className={`px-3 py-1 rounded-md ${
                      metricMode === "pages"
                        ? "bg-white dark:bg-slate-800 shadow text-amber-600"
                        : "text-slate-500"
                    }`}
                  >
                    Sayfa
                  </button>
                  <button
                    onClick={() => setMetricMode("time")}
                    className={`px-3 py-1 rounded-md ${
                      metricMode === "time"
                        ? "bg-white dark:bg-slate-800 shadow text-purple-600"
                        : "text-slate-500"
                    }`}
                  >
                    Süre
                  </button>
                </div>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartData}>
                    <defs>
                      <linearGradient id="colorGraph" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={
                            metricMode === "pages" ? "#f59e0b" : "#8b5cf6"
                          }
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={
                            metricMode === "pages" ? "#f59e0b" : "#8b5cf6"
                          }
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      opacity={0.3}
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      interval={viewMode === "month" ? 2 : 0}
                    />
                    <Tooltip
                      formatter={(val: number) =>
                        metricMode === "time"
                          ? formatDuration(val)
                          : `${val} sayfa`
                      }
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={metricMode === "pages" ? "pages" : "minutes"}
                      stroke={metricMode === "pages" ? "#f59e0b" : "#8b5cf6"}
                      strokeWidth={3}
                      fill="url(#colorGraph)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI BENZERİ KOÇ */}
            <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-3">
                <Activity className="w-7 h-7 text-indigo-500" />
              </div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                Akıllı Okuma Analizi
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Bu bölümdeki yorumlar, kayıtlı verilerine göre
                otomatik üretilen "mini koç" notlarıdır.
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {stats.aiInsights.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-left"
                  >
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DEVAM EDEN KİTAPLAR & TAHMİNLER */}
          {stats.inProgressForecasts.length > 0 && (
            <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Devam Eden Kitaplar & Tahminler
                </h3>
                <p className="text-xs text-slate-400">
                  Okuma hızına göre her kitabın tahmini bitiş tarihi.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.inProgressForecasts.map((item) => {
                  const b = item.book;
                  const progress =
                    b.totalPages && b.totalPages > 0
                      ? Math.min(
                          100,
                          Math.round(
                            ((b.pagesRead || 0) / b.totalPages) * 100
                          )
                        )
                      : 0;
                  return (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4 flex gap-3"
                    >
                      <div className="w-14 h-20 rounded-lg bg-slate-200 overflow-hidden flex-shrink-0">
                        {b.coverImageUrl && (
                          <img
                            src={b.coverImageUrl}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-amber-500 mb-1">
                          Okunuyor
                        </p>
                        <p className="text-sm font-bold truncate">
                          {b.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mb-2">
                          {b.author}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          İlerleme:{" "}
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {b.pagesRead || 0} / {b.totalPages || "-"} sf
                          </span>
                        </p>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-1 mb-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Tahmini bitiş:{" "}
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {item.date}
                          </span>{" "}
                          • günde ~{item.dailyAvg} sf •{" "}
                          <span className="font-medium">
                            {item.daysLeft} gün
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* HEATMAP + EN'LER */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* HEATMAP */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Son 30 Gün Okuma Haritası
                </h3>
                <span className="text-xs text-slate-400">
                  Her kare bir günü temsil eder.
                </span>
              </div>
              <div className="grid grid-cols-10 gap-1">
                {stats.heatmap.map((d) => {
                  const v = d.value;
                  let cls =
                    "bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60";
                  if (v > 0 && v <= 10)
                    cls = "bg-emerald-100 dark:bg-emerald-900/30";
                  if (v > 10 && v <= 30)
                    cls = "bg-emerald-300 dark:bg-emerald-700/70";
                  if (v > 30)
                    cls = "bg-emerald-500 dark:bg-emerald-500";
                  return (
                    <div
                      key={d.date}
                      className={`group h-6 rounded-md transition ${cls}`}
                    ></div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 mt-3 items-center text-[10px] text-slate-400">
                <span>Az</span>
                <div className="h-2 w-4 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-2 w-4 rounded bg-emerald-200/80" />
                <div className="h-2 w-4 rounded bg-emerald-400" />
                <div className="h-2 w-4 rounded bg-emerald-600" />
                <span>Çok</span>
              </div>
            </div>

            {/* EN'LER */}
            <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                En'ler
              </h3>
              {/* En yüksek puanlı */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1">
                  En yüksek puanlı kitaplar
                </p>
                {stats.topByRating.length === 0 && (
                  <p className="text-xs text-slate-500">
                    Henüz puanladığın kitap yok.
                  </p>
                )}
                <div className="space-y-1">
                  {stats.topByRating.map((b, i) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="truncate max-w-[160px]">
                        {i + 1}. {b.title}
                      </span>
                      <span className="flex items-center gap-1 text-amber-500 font-semibold">
                        {b.finalRating?.toFixed(1)} ★
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* En uzun kitaplar */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1">
                  En uzun kitaplar
                </p>
                <div className="space-y-1 text-xs">
                  {stats.topByPages.map((b, i) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between"
                    >
                      <span className="truncate max-w-[160px]">
                        {i + 1}. {b.title}
                      </span>
                      <span className="text-slate-500">
                        {b.totalPages} sf
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* En çok zaman harcanan */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1">
                  En çok zaman harcadığın kitaplar
                </p>
                <div className="space-y-1 text-xs">
                  {stats.topByTime.map((entry, i) => (
                    <div
                      key={entry.book.id}
                      className="flex items-center justify-between"
                    >
                      <span className="truncate max-w-[160px]">
                        {i + 1}. {entry.book.title}
                      </span>
                      <span className="text-slate-500">
                        {formatDuration(entry.mins)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============= KİTAPLAR TABI ============= */}
      {activeTab === "books" && (
        <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder="Kitap ara..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border-none text-sm focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <select
              value={tableFilter}
              onChange={(e: any) =>
                setTableFilter(e.target.value as BookStatus | "ALL")
              }
              className="bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm px-4 py-2"
            >
              <option value="ALL">Tümü</option>
              <option value="OKUNUYOR">Okunuyor</option>
              <option value="OKUNDU">Okundu</option>
              <option value="OKUNACAK">Okunacak</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Kitap</th>
                  <th className="px-6 py-4">Durum</th>
                  <th className="px-6 py-4">İlerleme</th>
                  <th className="px-6 py-4">Süre</th>
                  <th className="px-6 py-4">Puan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tableData.map((book) => (
                  <tr
                    key={book.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-11 bg-slate-200 rounded overflow-hidden shrink-0">
                          {book.coverImageUrl && (
                            <img
                              src={book.coverImageUrl}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white line-clamp-1">
                            {book.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {book.author}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          book.status === "OKUNDU"
                            ? "bg-emerald-100 text-emerald-700"
                            : book.status === "OKUNUYOR"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-indigo-100 text-indigo-700"
                        }`}
                      >
                        {book.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium">
                        {book.pagesRead || 0}
                      </span>{" "}
                      /{" "}
                      <span className="text-slate-400">
                        {book.totalPages || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {formatDuration(book.totalMins)}
                    </td>
                    <td className="px-6 py-4 font-bold text-amber-500">
                      {book.finalRating || book.overallRating || "-"} ★
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============= RAFLAR TABI ============= */}
      {activeTab === "shelves" && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
          {stats.shelfStats.map((shelf, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Library className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300">
                  {shelf.count} Kitap
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 truncate">
                {shelf.name}
              </h3>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span>Toplam Okunan Sayfa</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {shelf.pages.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Ortalama Puan</span>
                  <span className="font-semibold text-amber-500 flex items-center gap-1">
                    {(shelf.avgRating || 0).toFixed(1)}
                    <span className="text-xs">★</span>
                  </span>
                </div>
              </div>
            </div>
          ))}

          {stats.categoryData && stats.categoryData.length > 0 && (
            <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mt-6 flex flex-col md:flex-row items-center">
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2">
                  Kategori Dağılımı
                </h3>
                <p className="text-sm text-slate-500">
                  Kütüphanendeki türlerin oransal dağılımı.
                </p>
              </div>
              <div className="w-full md:w-1/2 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.categoryData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      verticalAlign="middle"
                      align="right"
                      layout="vertical"
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
