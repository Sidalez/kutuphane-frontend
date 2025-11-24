// src/pages/GoalsPage.tsx
import { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import type { Book } from "../types/book";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  Target,
  Trophy,
  Calendar,
  Plus,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingUp,
  BookOpen,
  Sparkles,
} from "lucide-react";

// ---- Tipler ----
type GoalType = "book" | "page";
type GoalStatus = "active" | "completed" | "failed" | "archived";
type GoalPeriod = "daily" | "weekly" | "monthly" | "yearly";

interface Goal {
  id: string;
  title: string;
  targetCount: number;
  type: GoalType; // kitap / sayfa
  startDate: string;
  endDate: string;
  status: GoalStatus;
  createdAt: any;
  periodType?: GoalPeriod;
  bookId?: string | null;
  bookIds?: string[];
}

type RiskType = "normal" | "high" | "good";

interface GoalWithStats extends Goal {
  current: number;
  percent: number;
  timePercent: number;
  computedStatus: GoalStatus;
  risk: RiskType;
  isExpired: boolean;
  aiNote: string;
  paceText?: string;
}

const PIE_COLORS = ["#10b981", "#f43f5e"];

export default function GoalsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // toast
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // kitap hedefi için aramalı seçim
  const [bookSearch, setBookSearch] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);
  const nextMonthStr = new Date(
    new Date().setMonth(new Date().getMonth() + 1)
  )
    .toISOString()
    .slice(0, 10);

  const [newGoal, setNewGoal] = useState<{
    title: string;
    targetCount: string;
    type: GoalType;
    startDate: string;
    endDate: string;
    periodType: GoalPeriod;
    bookIds: string[];
  }>({
    title: "",
    targetCount: "",
    type: "book",
    startDate: todayStr,
    endDate: nextMonthStr,
    periodType: "monthly",
    bookIds: [],
  });

  const handlePeriodChange = (p: GoalPeriod) => {
  setNewGoal((prev) => {
    const base = prev.startDate || todayStr;
    const start = new Date(base);
    const end = new Date(start);

    if (p === "daily") {
      // Aynı gün
      end.setDate(start.getDate());
    } else if (p === "weekly") {
      // 7 günlük aralık
      end.setDate(start.getDate() + 6);
    } else if (p === "monthly") {
      // 1 ay sonrası (yaklaşık)
      end.setMonth(start.getMonth() + 1);
      end.setDate(end.getDate() - 1);
    } else if (p === "yearly") {
      // 1 yıl sonrası
      end.setFullYear(start.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
    }

    const endStr = end.toISOString().slice(0, 10);

    return {
      ...prev,
      periodType: p,
      endDate: endStr,
    };
  });
};

  // ---- VERİ ÇEKME ----
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // kitaplar
        const qBooks = query(
          collection(db, "books"),
          where("userId", "==", user.uid)
        );
        const booksSnap = await getDocs(qBooks);
        const booksData = booksSnap.docs.map(
          (d) => ({ ...d.data(), id: d.id } as Book)
        );
        setBooks(booksData);

        // hedefler: users/{uid}/goals
        const qGoals = query(collection(db, "users", user.uid, "goals"));
        const goalsSnap = await getDocs(qGoals);
        const goalsData = goalsSnap.docs.map(
          (d) =>
            ({
              id: d.id,
              ...d.data(),
            } as Goal)
        );

        goalsData.sort(
          (a, b) =>
            new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
        );

        setGoals(goalsData);
      } catch (err) {
        console.error("Hedef/kitap verisi hatası:", err);
        showToast("error", "Hedef verileri yüklenirken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // ---- HESAPLAMA MOTORU ----
  const goalStats: GoalWithStats[] = useMemo(() => {
    if (!user) return [];

    const dayMs = 1000 * 60 * 60 * 24;

    return goals.map((goal) => {
      const start = new Date(goal.startDate).getTime();
      const end = new Date(goal.endDate).getTime();
      const now = new Date().getTime();

      let current = 0;

      // hedefe ilerleme
      if (goal.type === "book") {
        current = books.filter((b) => {
          if (b.status !== "OKUNDU" || !b.endDate) return false;
          const t = new Date(b.endDate).getTime();
          return t >= start && t <= end;
        }).length;
      } else {
        current = books
          .filter((b) => {
            if (b.status !== "OKUNDU" || !b.endDate) return false;
            const t = new Date(b.endDate).getTime();
            return t >= start && t <= end;
          })
          .reduce((sum, b) => sum + (b.totalPages || 0), 0);
      }

      const percent =
        goal.targetCount > 0
          ? Math.min(100, Math.round((current / goal.targetCount) * 100))
          : 0;

      const totalDuration = end - start;
      const elapsed = now - start;
      const timePercent =
        totalDuration > 0
          ? Math.min(
              100,
              Math.max(0, Math.round((elapsed / totalDuration) * 100))
            )
          : 0;

      const isExpired = now > end;
      const isSuccess = current >= goal.targetCount;

      let computedStatus: GoalStatus = goal.status;
      if (isSuccess) computedStatus = "completed";
      else if (isExpired) computedStatus = "failed";
      else computedStatus = "active";

      let risk: RiskType = "normal";
      if (computedStatus === "active") {
        if (percent < timePercent - 10) risk = "high";
        else if (percent >= timePercent) risk = "good";
      }

      // Pace hesaplama (istatistikle bağlantı gibi)
      let paceText = "";
      const totalDays =
        totalDuration > 0 ? Math.max(1, Math.round(totalDuration / dayMs)) : 0;
      if (totalDays > 0 && goal.targetCount > 0) {
        if (goal.type === "page") {
          const daily = Math.ceil(goal.targetCount / totalDays);
          if (daily > 0)
            paceText = `Bu hedef için günde ortalama ${daily} sayfa okuman gerekiyor.`;
        } else {
          const weeklyBooks = Math.max(
            0.1,
            (goal.targetCount * 7) / totalDays
          );
          paceText = `Bu hedef için haftada yaklaşık ${weeklyBooks.toFixed(
            1
          )} kitap bitirmen gerekiyor.`;
        }
      }

      // AI benzeri yorum
      let aiNote = "";
      if (computedStatus === "completed") {
        if (!isExpired && percent >= 100) {
          aiNote =
            "Bu hedefi zamanında tamamladın, tempoyu korursan daha büyük hedefleri de rahatlıkla bitirebilirsin.";
        } else {
          aiNote =
            "Hedef tamamlandı, biraz zorlanmış olsan da sonunda başardın. Sonraki hedefine biraz daha geniş zaman tanıyabilirsin.";
        }
      } else if (computedStatus === "failed") {
        aiNote =
          "Bu hedef süresi dolmuş görünüyor. Hedef boyutunu ve tarih aralığını yeniden gözden geçirip daha gerçekçi bir plan yapabilirsin.";
      } else {
        // aktif
        if (risk === "high") {
          aiNote =
            "Zaman ilerlemesine göre biraz geridesin. Küçük günlük bloklar ekleyip tempoyu artırırsan hedefi yakalaman hâlâ mümkün.";
        } else if (risk === "good") {
          aiNote =
            "Zaman çizelgesinin önündesin. Bu tempo ile giderse hedefi rahatlıkla tamamlayacaksın.";
        } else {
          aiNote =
            "İlerleme ile zaman çizelgesi birbirine yakın. Düzenli okuma ile hedefi konforlu bir şekilde tamamlayabilirsin.";
        }
      }

      return {
        ...goal,
        current,
        percent,
        timePercent,
        computedStatus,
        risk,
        isExpired,
        aiNote,
        paceText,
      };
    });
  }, [goals, books, user]);

  // ---- GENEL ÖZET + AI yorum bloğu ----
  const overview = useMemo(() => {
    const completed = goalStats.filter((g) => g.computedStatus === "completed")
      .length;
    const failed = goalStats.filter((g) => g.computedStatus === "failed")
      .length;
    const active = goalStats.filter((g) => g.computedStatus === "active")
      .length;
    const total = goalStats.length;
    const successRate =
      total > 0 ? Math.round((completed / (completed + failed || 1)) * 100) : 0;

    const ahead = goalStats.filter(
      (g) => g.computedStatus === "active" && g.risk === "good"
    ).length;
    const behind = goalStats.filter(
      (g) => g.computedStatus === "active" && g.risk === "high"
    ).length;

    let aiSummary = "";
    if (total === 0) {
      aiSummary =
        "Henüz tanımlı bir hedefin yok. Küçük bir aylık hedefle başlamak motivasyon için iyi bir adım olur.";
    } else if (active === 0 && completed > 0) {
      aiSummary =
        "Tanımlı tüm hedeflerini tamamlamış görünüyorsun. Yeni bir dönem için taze hedefler belirleyebilirsin.";
    } else {
      if (behind > 0 && ahead > 0) {
        aiSummary = `Bazı hedeflerde zamanın gerisinde (${behind}), bazı hedeflerde ise öndesin (${ahead}). Geri kalan hedeflerde günlük küçük okuma blokları ile dengeyi sağlayabilirsin.`;
      } else if (behind > 0) {
        aiSummary = `Aktif hedeflerinin bir kısmında zamanın biraz gerisindesin (${behind} hedef). Günlük okuma süreni az da olsa artırman, hedeflere yetişmeni kolaylaştırır.`;
      } else if (ahead > 0) {
        aiSummary = `Aktif hedeflerinin önemli kısmında zaman çizelgesinin önündesin (${ahead} hedef). Bu tempo ile giderse başarı oranını daha da artırman çok olası.`;
      } else {
        aiSummary =
          "Hedeflerin genel olarak zaman çizgisi ile uyumlu ilerliyor. Planlı bir şekilde devam ettiğin sürece hedeflerine rahatlıkla ulaşacaksın.";
      }
    }

    return { completed, failed, active, total, successRate, ahead, behind, aiSummary };
  }, [goalStats]);
  // --- "AI" TARZI ÖNERİLER ---
  const aiSuggestions = useMemo(() => {
    if (!goalStats.length) return [];

    const suggestions: {
      type: "success" | "risk" | "info";
      title: string;
      body: string;
    }[] = [];

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // 1) Genel başarı durumu
    if (overview.total > 0) {
      if (overview.successRate >= 70) {
        suggestions.push({
          type: "success",
          title: "Genel Başarı Yüksek 🎉",
          body: `Hedeflerinin %${overview.successRate} kadarını başarıyla tamamlamışsın. Bu tempoyu korursan uzun vadede okuma alışkanlığın çok sağlam bir çizgide kalır.`
        });
      } else if (overview.successRate <= 40 && (overview.completed + overview.failed) > 0) {
        suggestions.push({
          type: "risk",
          title: "Başarı Oranı Düşük Görünüyor",
          body: `Şu an için hedeflerde başarı oranı %${overview.successRate} seviyesinde. Belki hedeflerini biraz daha küçük parçalara bölmek (örneğin aylık yerine haftalık hedefler) motivasyonunu artırabilir.`
        });
      } else {
        suggestions.push({
          type: "info",
          title: "Denge Fena Değil",
          body: `Tamamlanan ve kaçan hedeflerin dengede. Hedef sayısını çok arttırmadan, şu anki seviyeyi stabil tutmaya odaklanmak iyi olabilir.`
        });
      }
    }

    // 2) En riskli aktif hedef (zaman ilerlemiş, ilerleme geride kalmış)
    const activeGoals = goalStats.filter((g) => g.computedStatus === "active");
    if (activeGoals.length) {
      const risky = [...activeGoals]
        .filter((g) => g.timePercent > g.percent + 10) // Zaman, ilerlemeden en az %10 önde
        .sort((a, b) => (b.timePercent - b.percent) - (a.timePercent - a.percent))[0];

      if (risky) {
        // Kalan gün & kalan hedef hesabı
        const end = new Date(risky.endDate);
        const diffDays = Math.ceil(
          (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        const remaining = Math.max(0, risky.targetCount - risky.current);
        let detail = "";

        if (diffDays <= 0) {
          detail =
            "Hedefin bitiş tarihine gelmişsin. Hedefi yumuşatarak güncellemek ya da yeniden başlatmak iyi olabilir.";
        } else {
          const perDay = remaining > 0 ? remaining / diffDays : 0;
          if (risky.type === "book") {
            detail = `Bu hedefe yetişmek için yaklaşık günde ${(perDay || 0).toFixed(
              2
            )} kitap bitirme hızına ihtiyacın var. Kitap sayısını azaltmak veya süreyi uzatmak daha gerçekçi olabilir.`;
          } else {
            detail = `Bu hedefe yetişmek için günde ortalama ${Math.ceil(
              perDay || 0
            )} sayfa okuman gerekiyor. Günlük rutinine kısa sabah/akşam oturumları eklemeyi düşünebilirsin.`;
          }
        }

        suggestions.push({
          type: "risk",
          title: `Riskli Hedef: ${risky.title}`,
          body:
            `Zamanın %${risky.timePercent}’i geçti ama hedefte %${risky.percent} seviyesindesin. ` +
            detail
        });
      }
    }

    // 3) En iyi giden aktif hedef
    const good = activeGoals
      .filter((g) => g.percent >= g.timePercent)
      .sort((a, b) => b.percent - a.percent)[0];

    if (good) {
      suggestions.push({
        type: "success",
        title: `Öne Geçtiğin Hedef: ${good.title}`,
        body: `Bu hedefte zaman çizelgesinin önündesin (ilerleme %${good.percent}, zaman %${good.timePercent}). Bu ritmi diğer hedeflere de yayarsan genel başarı oranını hızlıca yukarı çekebilirsin.`
      });
    }

    // 4) Hiç hedef yoksa
    if (!overview.total) {
      suggestions.push({
        type: "info",
        title: "Henüz Hedef Oluşturmadın",
        body: "Başlamak için küçük bir “haftalık 100 sayfa” veya “bu ay 1 kitap” hedefi belirleyebilirsin. Küçük, ulaşılabilir hedefler en istikrarlı okuma alışkanlığını getirir."
      });
    }

    return suggestions;
  }, [goalStats, overview]);

  // ---- AKSİYONLAR ----
  const handleAddGoal = async () => {
    if (!user) return;

    if (!newGoal.title.trim() || !newGoal.targetCount) {
      showToast("error", "Lütfen hedef adı ve hedef sayısını doldurun.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: newGoal.title.trim(),
        targetCount: Number(newGoal.targetCount),
        type: newGoal.type,
        startDate: newGoal.startDate,
        endDate: newGoal.endDate,
        status: "active" as GoalStatus,
        periodType: newGoal.periodType,
        bookIds: newGoal.bookIds,
        bookId: newGoal.bookIds.length === 1 ? newGoal.bookIds[0] : null,
        createdAt: serverTimestamp(),
      };

      const ref = await addDoc(
        collection(db, "users", user.uid, "goals"),
        payload
      );

      setGoals((prev) => [
        ...prev,
        { id: ref.id, ...(payload as any) } as Goal,
      ]);

      setIsModalOpen(false);
      setNewGoal({
        title: "",
        targetCount: "",
        type: "book",
        startDate: todayStr,
        endDate: nextMonthStr,
        periodType: "monthly",
        bookIds: [],
      });
      setBookSearch("");

      showToast("success", "Hedef başarıyla oluşturuldu.");
    } catch (err: any) {
      console.error(err);
      if (err?.code === "permission-denied") {
        showToast(
          "error",
          "Yetki hatası: Firestore güvenlik kurallarını (users/{uid}/goals) kontrol etmelisin."
        );
      } else {
        showToast("error", "Hedef eklenirken bir hata oluştu.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!confirm("Bu hedefi silmek istediğine emin misin?")) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "goals", id));
      setGoals((prev) => prev.filter((g) => g.id !== id));
      showToast("success", "Hedef silindi.");
    } catch (err) {
      console.error(err);
      showToast("error", "Hedef silinirken bir hata oluştu.");
    }
  };

  if (loading) {
    return (
      <div className="p-20 text-center text-slate-500 flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span>Hedefler yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* HEADER / HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-50 via-amber-100 to-orange-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6 shadow-sm">
        <div className="flex-1 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 dark:bg-slate-900/60 border border-amber-100 dark:border-slate-700 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Sparkles className="w-3 h-3" />
            Hedef Yönetimi
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-3">
            <span>Okuma hedef panosu</span>
          </h1>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-xl">
            Okuma maratonları oluştur, kitap veya sayfa hedefleri belirle ve
            sürece göre ilerlemeni takip et. Hedeflerini netleştir, motivasyonu
            yüksek tut.
          </p>

          <div className="flex flex-wrap gap-4 text-xs md:text-sm text-slate-600 dark:text-slate-300 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/70 dark:bg-slate-900/70 flex items-center justify-center">
                <Target className="w-4 h-4 text-amber-600" />
              </div>
              <span>Kitap / sayfa bazlı hedefler</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/70 dark:bg-slate-900/70 flex items-center justify-center">
                <Clock className="w-4 h-4 text-sky-500" />
              </div>
              <span>Günlük, haftalık, aylık, yıllık periyotlar</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/70 dark:bg-slate-900/70 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <span>Risk analizi ve AI yorumları</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-semibold text-sm shadow-lg shadow-slate-900/20 hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            Yeni Hedef Oluştur
          </button>
          {overview.total > 0 && (
            <div className="text-right text-xs text-slate-600 dark:text-slate-300">
              <div className="font-semibold">
                Toplam {overview.total} hedef tanımlı
              </div>
              <div className="text-[11px] text-slate-500">
                Başarı oranı: %{overview.successRate}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ANALİZ ÖZETİ + AI YORUM KARTI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Başarı oranı Pie */}
        <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-6">
          <div className="relative w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { value: overview.completed, name: "Tamamlanan" },
                    { value: overview.failed, name: "Başarısız" },
                  ]}
                  innerRadius={30}
                  outerRadius={40}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {[overview.completed, overview.failed].map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-100">
                %{overview.successRate}
              </span>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              Başarı Oranı
            </p>
            <p className="text-slate-700 dark:text-slate-100">
              Hedeflerinin{" "}
              <span className="font-semibold">{overview.completed}</span> tanesi
              tamamlandı,{" "}
              <span className="font-semibold text-rose-500">
                {overview.failed}
              </span>{" "}
              tanesi başarısız.
            </p>
            <div className="flex gap-4 text-[11px] mt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Tamamlanan
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Başarısız
              </div>
            </div>
          </div>
        </div>

        {/* Aktif Hedef Kartı */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-6 rounded-3xl shadow-lg flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1 opacity-90">
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs font-bold uppercase">
              Aktif Okuma Hedefleri
            </span>
          </div>
          <p className="text-4xl font-black">
            {overview.active}{" "}
            <span className="text-lg font-medium opacity-80">hedef</span>
          </p>
          <p className="text-xs mt-1 opacity-90">
            Şu an takibi devam eden hedef sayısı. İyi gidiyorsun!
          </p>
          {overview.behind > 0 && (
            <p className="text-[11px] mt-2 opacity-90">
              <span className="font-semibold">{overview.behind}</span> hedefte
              zamanın biraz gerisindesin. Küçük günlük bloklarla bunu
              yakalayabilirsin.
            </p>
          )}
        </div>

        {/* AI Yorum Kartı */}
        <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300">
              AI Hedef Değerlendirmesi
            </span>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {overview.aiSummary}
          </p>
        </div>
      </div>
      {/* --- AI TARZI ÖNERİ PANELİ --- */}
      {aiSuggestions.length > 0 && (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20">
              <TrendingUp className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-bold tracking-wide text-amber-600 uppercase">
                Akıllı Öneriler
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Hedeflerin, süreler ve gerçekleşen performansa göre otomatik yorumlar.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {aiSuggestions.map((s, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-2xl border text-sm leading-relaxed ${
                  s.type === "success"
                    ? "border-emerald-200 bg-emerald-50/70 dark:bg-emerald-900/20 dark:border-emerald-700/40"
                    : s.type === "risk"
                    ? "border-rose-200 bg-rose-50/70 dark:bg-rose-900/20 dark:border-rose-700/40"
                    : "border-slate-200 bg-slate-50/80 dark:bg-slate-900/40 dark:border-slate-700/40"
                }`}
              >
                <p className="text-xs font-semibold mb-1 text-slate-700 dark:text-slate-100">
                  {s.title}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HEDEFLER LİSTESİ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100">
            Hedeflerim
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Toplam {overview.total} hedef tanımlı
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {goalStats.map((goal) => (
            <div
              key={goal.id}
              className={`relative p-6 rounded-3xl border transition-all group ${
                goal.computedStatus === "active"
                  ? "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md"
                  : "bg-slate-50 dark:bg-slate-900/60 border-slate-100 dark:border-slate-800 opacity-80 hover:opacity-100"
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4 gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-3 rounded-2xl ${
                      goal.computedStatus === "completed"
                        ? "bg-emerald-100 text-emerald-600"
                        : goal.computedStatus === "failed"
                        ? "bg-rose-100 text-rose-600"
                        : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {goal.computedStatus === "completed" ? (
                      <Trophy className="w-6 h-6" />
                    ) : (
                      <Target className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base md:text-lg">
                      {goal.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(goal.startDate).toLocaleDateString("tr-TR")}{" "}
                        - {new Date(goal.endDate).toLocaleDateString("tr-TR")}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                        {goal.type === "book" ? "Kitap hedefi" : "Sayfa hedefi"}
                      </span>
                      {goal.periodType && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-900">
                          <Clock className="w-3 h-3" />
                          {goal.periodType === "daily"
                            ? "Günlük"
                            : goal.periodType === "weekly"
                            ? "Haftalık"
                            : goal.periodType === "monthly"
                            ? "Aylık"
                            : "Yıllık"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                    goal.computedStatus === "completed"
                      ? "bg-emerald-100 text-emerald-700"
                      : goal.computedStatus === "failed"
                      ? "bg-rose-100 text-rose-700"
                      : goal.risk === "high"
                      ? "bg-red-100 text-red-600 animate-pulse"
                      : goal.risk === "good"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-blue-50 text-blue-600"
                  }`}
                >
                  {goal.computedStatus === "completed"
                    ? "BAŞARILDI"
                    : goal.computedStatus === "failed"
                    ? "BAŞARISIZ"
                    : goal.risk === "high"
                    ? "RİSKLİ"
                    : goal.risk === "good"
                    ? "İYİ GİDİYOR"
                    : "AKTİF"}
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs md:text-sm font-medium text-slate-600 dark:text-slate-300">
                  <span>
                    {goal.current} / {goal.targetCount}{" "}
                    {goal.type === "book" ? "kitap" : "sayfa"}
                  </span>
                  <span>%{goal.percent}</span>
                </div>
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                  {goal.computedStatus === "active" && (
                    <div
                      className="absolute top-0 left-0 h-full bg-slate-200 dark:bg-slate-700 opacity-60 border-r border-slate-400/80"
                      style={{ width: `${goal.timePercent}%` }}
                    />
                  )}
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      goal.computedStatus === "completed"
                        ? "bg-emerald-500"
                        : goal.computedStatus === "failed"
                        ? "bg-rose-500"
                        : goal.risk === "high"
                        ? "bg-red-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${goal.percent}%` }}
                  />
                </div>
                {goal.computedStatus === "active" && (
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Başlangıç</span>
                    <span
                      className={
                        goal.timePercent > goal.percent
                          ? "text-red-500 font-semibold"
                          : "text-emerald-500 font-semibold"
                      }
                    >
                      {goal.timePercent > goal.percent
                        ? "Zamanın gerisindesin"
                        : "Zamanın önündesin"}
                    </span>
                    <span>Bitiş</span>
                  </div>
                )}
              </div>

              {/* AI not + pace */}
              <div className="mt-3 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                {goal.paceText && (
                  <p className="flex items-start gap-1.5">
                    <Clock className="w-3 h-3 mt-[2px] text-sky-500" />
                    <span>{goal.paceText}</span>
                  </p>
                )}
                <p className="flex items-start gap-1.5">
                  <Sparkles className="w-3 h-3 mt-[2px] text-amber-500" />
                  <span>{goal.aiNote}</span>
                </p>
              </div>

              {/* Sil butonu */}
              <button
                onClick={() => handleDelete(goal.id)}
                className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {goalStats.length === 0 && (
            <div className="col-span-2 text-center py-12 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60">
              <Target className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-300">
                Henüz bir hedef oluşturmadın.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-amber-600 font-semibold text-sm mt-2 hover:underline"
              >
                Hemen bir hedef tanımla
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL – YENİ HEDEF (overflow fix) */}
  {/* ------------------ PRO MODAL --------------------- */}
{isModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">

    {/* MODAL KUTUSU */}
    <div className="w-full max-w-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl 
                    border border-white/30 dark:border-slate-700/30 rounded-3xl 
                    shadow-2xl shadow-black/30 flex flex-col max-h-[85vh]">

      {/* HEADER */}
      <div className="px-6 py-5 border-b border-white/20 dark:border-slate-700/40">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-500" />
            Yeni Okuma Hedefi
          </h2>

          <button
            onClick={() => setIsModalOpen(false)}
            className="p-2 rounded-full hover:bg-white/30 dark:hover:bg-slate-800/50 transition"
          >
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Hedef tipini seç, tarih aralığını belirle ve kitaplarını ilişkilendir.
        </p>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Hedef Adı */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">
            Hedef Adı
          </label>
          <input
            value={newGoal.title}
            onChange={(e) =>
              setNewGoal((prev) => ({ ...prev, title: e.target.value }))
            }
            className="w-full mt-1.5 p-3 bg-white/60 dark:bg-slate-800/60 
                       border border-slate-300 dark:border-slate-700 rounded-xl
                       placeholder-slate-400
                       focus:ring-2 focus:ring-amber-400/70 focus:border-transparent 
                       outline-none text-sm shadow-inner"
            placeholder="Örn: Ocak Ayı Okuma Challange"
          />
        </div>

        {/* Tip seçimi */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">
            Hedef Türü
          </label>

          <div className="mt-2 flex bg-slate-100/70 dark:bg-slate-800/60 
                          rounded-xl p-1 shadow-inner">

            <button
              onClick={() =>
                setNewGoal((prev) => ({ ...prev, type: "book" }))
              }
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition 
              ${
                newGoal.type === "book"
                  ? "bg-white dark:bg-slate-900 shadow text-amber-600"
                  : "text-slate-500"
              }`}
            >
              <BookOpen className="w-4 h-4" /> Kitap
            </button>

            <button
              onClick={() =>
                setNewGoal((prev) => ({ ...prev, type: "page" }))
              }
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition 
              ${
                newGoal.type === "page"
                  ? "bg-white dark:bg-slate-900 shadow text-amber-600"
                  : "text-slate-500"
              }`}
            >
              📄 Sayfa
            </button>
          </div>
        </div>

        {/* Hedef değeri */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">
            Hedef Değeri
          </label>
          <input
            type="number"
            min="1"
            value={newGoal.targetCount}
            onChange={(e) =>
              setNewGoal((prev) => ({ ...prev, targetCount: e.target.value }))
            }
            className="w-full mt-1.5 p-3 bg-white/60 dark:bg-slate-800/60 
                       border border-slate-300 dark:border-slate-700 rounded-xl
                       placeholder-slate-400
                       focus:ring-2 focus:ring-amber-400/70 focus:border-transparent 
                       outline-none text-sm shadow-inner"
            placeholder={newGoal.type === "book" ? "Örn: 5 kitap" : "Örn: 350 sayfa"}
          />
        </div>

        {/* Tarih seçimleri */}
       {/* Periyot + Tarih Seçimleri */}
<div className="space-y-3">
  {/* Periyot butonları */}
  <div>
    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">
      Periyot
    </label>
    <div className="mt-2 flex bg-slate-100/70 dark:bg-slate-800/60 rounded-xl p-1 shadow-inner">
      {(
        [
          { id: "daily", label: "Günlük" },
          { id: "weekly", label: "Haftalık" },
          { id: "monthly", label: "Aylık" },
          { id: "yearly", label: "Yıllık" },
        ] as { id: GoalPeriod; label: string }[]
      ).map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => handlePeriodChange(p.id)}
          className={`flex-1 py-2 rounded-lg text-xs md:text-sm font-semibold transition ${
            newGoal.periodType === p.id
              ? "bg-white dark:bg-slate-900 shadow text-amber-600"
              : "text-slate-500"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
    <p className="text-[11px] text-slate-400 mt-1">
      Periyodu değiştirdiğinde, bitiş tarihi otomatik olarak güncellenir. İstersen
      manuel olarak da düzeltebilirsin.
    </p>
  </div>

  {/* Başlangıç / Bitiş tarihleri */}
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">
        Başlangıç
      </label>
      <input
        type="date"
        value={newGoal.startDate}
        onChange={(e) =>
          setNewGoal((prev) => ({ ...prev, startDate: e.target.value }))
        }
        className="w-full mt-1.5 p-3 bg-white/60 dark:bg-slate-800/60 
                   border border-slate-300 dark:border-slate-700 rounded-xl
                   focus:ring-2 focus:ring-amber-400/70 outline-none text-sm shadow-inner"
      />
    </div>

    <div>
      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">
        Bitiş
      </label>
      <input
        type="date"
        value={newGoal.endDate}
        onChange={(e) =>
          setNewGoal((prev) => ({ ...prev, endDate: e.target.value }))
        }
        className="w-full mt-1.5 p-3 bg-white/60 dark:bg-slate-800/60 
                   border border-slate-300 dark:border-slate-700 rounded-xl
                   focus:ring-2 focus:ring-amber-400/70 outline-none text-sm shadow-inner"
      />
    </div>
  </div>
</div>

        {/* Kitap Multi Select */}
        <div
          className={`mt-3 p-4 rounded-2xl border ${
            newGoal.type === "book"
              ? "opacity-40 pointer-events-none"
              : ""
          } bg-white/60 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 shadow-inner`}
        >
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold uppercase text-slate-600">
              Belirli Kitap Hedefi
            </h3>
          </div>

          {/* Arama kutusu */}
          <input
            type="text"
            placeholder="Kitap ara..."
            value={bookSearch}
            onChange={(e) => setBookSearch(e.target.value)}
            className="w-full mb-3 p-2 bg-white dark:bg-slate-900 rounded-lg border
                       border-slate-300 dark:border-slate-700 text-sm shadow-inner"
          />

          {/* Seçim listesi */}
          <div className="max-h-40 overflow-y-auto space-y-2">
            {books
              .filter((b) =>
                (b.title + b.author)
                  .toLowerCase()
                  .includes(bookSearch.toLowerCase())
              )
              .map((b) => {
                const selected = newGoal.bookIds.includes(b.id);
                return (
                  <button
                    key={b.id}
                    onClick={() =>
                      setNewGoal((prev) => ({
                        ...prev,
                        bookIds: selected
                          ? prev.bookIds.filter((x) => x !== b.id)
                          : [...prev.bookIds, b.id],
                      }))
                    }
                    className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-3 transition
                      ${
                        selected
                          ? "bg-amber-100 dark:bg-amber-900/40 border border-amber-300"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      }`}
                  >
                    <div className="w-8 h-12 rounded-lg overflow-hidden bg-slate-200">
                      {b.coverImageUrl && (
                        <img
                          src={b.coverImageUrl}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">
                        {b.title}
                      </p>
                      <p className="text-xs text-slate-500">{b.author}</p>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="px-6 py-4 border-t border-white/20 dark:border-slate-700/40 flex gap-3">
        <button
          onClick={() => setIsModalOpen(false)}
          className="flex-1 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 
                     bg-white/40 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700
                     hover:bg-white/60 dark:hover:bg-slate-700/50 transition font-semibold"
        >
          İptal
        </button>

        <button
          onClick={handleAddGoal}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-semibold 
                     shadow-lg shadow-amber-500/40 hover:bg-amber-600 transition flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 
          Kaydet
        </button>
      </div>

    </div>
  </div>
)}

      {/* TOAST */}
      {toast && (
        <div className="fixed right-4 bottom-4 md:right-8 md:bottom-8 z-50">
          <div
            className={`flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg border text-sm max-w-xs ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-100"
                : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/20 dark:border-rose-700 dark:text-rose-100"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 mt-0.5" />
            )}
            <p>{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
