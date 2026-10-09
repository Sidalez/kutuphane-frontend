import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, BookOpen, Check, ChevronDown, Clock, Heart, Loader2, Search, ShoppingBag, SlidersHorizontal, Sparkles, X, AlertCircle } from "lucide-react";
import type { Book } from "../../types/book";

type Suggestion = { title: string; author: string; genre: string; summary: string; reason: string; coverImageUrl?: string; publisher?: string | null; pageCount?: number | string | null; publishYear?: string | null; isbn?: string | null; editionSource?: string; editionSources?: string[] };
type Goal = "choose_library_book" | "choose_new_book";
type Props = {
  books: Book[]; suggestions: Suggestion[]; loadingBooks: boolean; loading: boolean;
  error: string | null; result: string | null; sections: { title: string; items: string[] }[];
  goal: Goal; onGoalChange: (goal: Goal) => void;
  mood: string; onMoodChange: (mood: string) => void;
  minutes: string; onMinutesChange: (value: string) => void;
  preference: string; onPreferenceChange: (value: string) => void;
  onGenerate: () => void;
};

const genres = ["Hepsi", "Roman", "Bilimkurgu", "Polisiye", "Fantastik", "Psikoloji", "Kişisel gelişim", "Tarih"];
const palettes = ["bg-[#254b42] text-[#f7e5b6]", "bg-[#bf573c] text-[#fff0cf]", "bg-[#e4c98d] text-[#393a2e]", "bg-[#424b6d] text-[#f6e4c8]", "bg-[#784c55] text-[#f4dfc0]", "bg-[#3e6372] text-[#efdfc3]"];

function Cover({ title, author, url, index = 0, className = "" }: { title: string; author: string; url?: string | null; index?: number; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <div className={`relative aspect-[2/3] overflow-hidden rounded-r-lg rounded-l-sm shadow-[6px_10px_18px_rgba(35,27,18,.18)] ${palettes[index % palettes.length]} ${className}`}>
    <div className="absolute inset-0 flex flex-col items-center justify-between px-[12%] py-[15%] text-center">
      <span className="text-[8px] uppercase tracking-[.22em] opacity-70">OKUMA LİSTESİ</span>
      <span className="font-semibold text-[clamp(14px,2vw,24px)] font-medium leading-tight">{title}</span>
      <span className="text-[9px] uppercase tracking-wider">{author}</span>
    </div>
    {url && failedUrl !== url && <img src={url} alt={`${title} kitap kapağı`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailedUrl(url)} />}
    <div className="pointer-events-none absolute inset-y-0 left-0 w-[7%] border-r border-black/10 bg-gradient-to-r from-black/20 to-white/10" />
  </div>;
}

function BookTile({ item, index, libraryBook, saved, onSave }: { item: Suggestion; index: number; libraryBook?: Book; saved: boolean; onSave: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const publisher = libraryBook?.publisher || item.publisher;
  const pageCount = libraryBook?.totalPages || item.pageCount;
  const year = libraryBook?.publishYear || item.publishYear;
  const isbn = libraryBook?.isbn || item.isbn;
  const bookshopQuery = encodeURIComponent(item.title.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim());
  const storesQuery = encodeURIComponent(`${item.title} ${item.author} kitap satın al`);
  const known = (value: unknown) => value && !["Bilinmiyor", "Belirtilmemiş"].includes(String(value)) ? String(value) : "Henüz doğrulanmadı";
  return <article className="group overflow-hidden rounded-[22px] border border-[#e9e3d9] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(61,43,20,.08)] dark:border-slate-800 dark:bg-slate-900">
    <div className="relative flex h-64 items-center justify-center overflow-hidden bg-[#f1eee6] dark:bg-slate-800/70 sm:h-72">
      <div className="absolute inset-x-10 bottom-6 h-6 rounded-[50%] bg-[#9e8563]/15 blur-xl" />
      <span className="absolute left-4 top-4 rounded-full bg-white/85 px-2.5 py-1 text-[9px] font-bold tracking-wide text-[#777263] dark:bg-slate-900 dark:text-slate-300">{libraryBook ? "KÜTÜPHANENDE" : "YENİ KEŞİF"}</span>
      <button type="button" aria-label={`${item.title}: ${saved ? "listeden çıkar" : "listeye al"}`} aria-pressed={saved} onClick={onSave} className={`absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full transition ${saved ? "bg-orange-100 text-primary" : "bg-white/85 text-stone-500 hover:text-primary dark:bg-slate-900"}`}><Heart className="h-4 w-4" fill={saved ? "currentColor" : "none"} /></button>
      <Cover title={item.title} author={item.author} url={item.coverImageUrl || libraryBook?.coverImageUrl} index={index} className="h-[76%] transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-105" />
    </div>
    <div className="p-5">
      <p className="mb-2 truncate text-[10px] font-bold uppercase tracking-[.14em] text-primary">{item.genre || "Edebiyat"}</p>
      <h3 className="line-clamp-2 min-h-12 text-lg font-semibold leading-6 tracking-tight text-[#2c3029] dark:text-slate-50">{item.title}</h3>
      <p className="mt-2 truncate text-[13px] font-semibold text-stone-600 dark:text-slate-300"><span className="mr-1 font-normal text-stone-400">Yazar</span> {item.author || "Belirtilmemiş"}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-y border-stone-100 py-4 dark:border-slate-800">
        <div className="col-span-2"><dt className="text-[9px] font-semibold uppercase tracking-[.12em] text-stone-400">Yayınevi</dt><dd className="mt-1 text-xs font-semibold text-stone-700 dark:text-slate-200">{known(publisher)}</dd></div>
        <div><dt className="text-[9px] font-semibold uppercase tracking-[.12em] text-stone-400">Sayfa sayısı</dt><dd className="mt-1 text-xs font-semibold text-stone-700 dark:text-slate-200">{known(pageCount)}{pageCount && known(pageCount) !== "Henüz doğrulanmadı" ? " sayfa" : ""}</dd></div>
        <div><dt className="text-[9px] font-semibold uppercase tracking-[.12em] text-stone-400">Yayın yılı</dt><dd className="mt-1 text-xs font-semibold text-stone-700 dark:text-slate-200">{known(year)}</dd></div>
        <div className="col-span-2"><dt className="text-[9px] font-semibold uppercase tracking-[.12em] text-stone-400">ISBN · Seçilen baskı</dt><dd className="mt-1 font-mono text-xs font-semibold text-stone-700 dark:text-slate-200">{known(isbn)}</dd></div>
      </dl>
      {!libraryBook && item.editionSource && <a href={item.editionSource} target="_blank" rel="noopener noreferrer" className="mt-2 block text-[10px] text-stone-400 underline decoration-stone-300 underline-offset-4 hover:text-primary">Bu baskının kaynağını incele</a>}
      <div className="mt-4 rounded-xl bg-[#f8f7f2] p-3 dark:bg-slate-800/70">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-[#65745a] dark:text-emerald-300"><Sparkles className="h-3 w-3" />Neden sana uygun?</p>
        <p className={`${expanded ? "" : "line-clamp-3"} min-h-[54px] text-[11px] leading-[18px] text-stone-600 dark:text-slate-300`}>{item.reason}</p>
      </div>
      {expanded && item.summary && <p className="mt-3 text-xs leading-relaxed text-stone-600 dark:text-slate-300">{item.summary}</p>}
      {expanded && item.editionSources && <div className="mt-3 flex flex-wrap gap-3">{[...new Set(item.editionSources)].map((source, sourceIndex) => <a key={source} href={source} target="_blank" rel="noopener noreferrer" className="text-[10px] text-stone-500 underline underline-offset-4">Baskı kaynağı {sourceIndex + 1}</a>)}</div>}
      <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="my-3 flex min-h-9 items-center gap-1 text-[11px] font-semibold text-stone-500 hover:text-primary">{expanded ? "Daha az göster" : "Kitabı tanı"}<ChevronDown className={`h-3 w-3 transition ${expanded ? "rotate-180" : ""}`} /></button>
      {libraryBook ? <Link to={`/library/${libraryBook.id}`} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#283e33] text-xs font-semibold text-white hover:bg-[#365541]">Kitabına git<ArrowRight className="h-3.5 w-3.5" /></Link> : <a href={`https://www.kitapyurdu.com/index.php?route=product/list&filter_name=${bookshopQuery}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#283e33] text-xs font-semibold text-white hover:bg-[#365541]">Kitapçıda ara<ArrowRight className="h-3.5 w-3.5" /></a>}
      {!libraryBook && <a href={`https://www.google.com/search?q=${storesQuery}`} target="_blank" rel="noopener noreferrer" className="mt-2 flex min-h-8 items-center justify-center gap-1 text-[10px] text-stone-500 hover:text-primary">Diğer mağazalarda ara<ShoppingBag className="h-3 w-3" /></a>}
    </div>
  </article>;
}

export default function SuggestionsStorefront(props: Props) {
  const [genre, setGenre] = useState("Hepsi");
  const [saved, setSaved] = useState<Map<string, Suggestion>>(new Map());
  const [onlySaved, setOnlySaved] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const libraryCandidates = props.books.filter(book => book.status !== "OKUNDU");
  const inspiration = (libraryCandidates.length ? libraryCandidates : props.books).slice(0, 6);
  const heroBooks = [...inspiration].sort((a, b) => Number(!!b.coverImageUrl) - Number(!!a.coverImageUrl)).slice(0, 3);
  const preview: Suggestion[] = inspiration.map(book => ({ title: book.title, author: book.author || "", genre: book.categories?.[0] || "Kütüphanenden", summary: book.description || "", reason: book.status === "OKUNUYOR" ? "Yarım kalan hikâyene dön. Kaldığın yerden devam etmek için rafında seni bekliyor." : "Kütüphanende keşfedilmeyi bekleyen bir kitap. Yeni kitap ararken kendi rafına da bir göz at.", coverImageUrl: book.coverImageUrl || undefined }));
  const items = props.result ? props.suggestions : preview;
  const keyOf = (item: Suggestion) => `${item.title}|${item.author}`;
  const visible = onlySaved ? [...saved.values()] : items;
  const toggleSaved = (item: Suggestion) => setSaved(previous => { const next = new Map(previous); const key = keyOf(item); next.has(key) ? next.delete(key) : next.set(key, item); return next; });
  const chooseGenre = (value: string) => {
    setGenre(value);
    props.onPreferenceChange(value === "Hepsi" ? "Okuma zevkime uygun, keşfetmeye değer kitaplar öner." : `${value} türünde, Türkçe okuyabileceğim, keşfetmeye değer kitaplar öner.`);
  };
  const profile = props.sections.find(section => section.title === "Kısa Profil Özeti")?.items[0];
  const emptyMessage = props.sections.find(section => section.title === "Öneri Stratejisi")?.items[0];
  return <div className="book-discovery mx-auto max-w-[1280px] space-y-8 pb-6 text-[#30352e] dark:text-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <div><p className="text-xs font-medium text-primary">KÜTÜPHANEM / KEŞİF</p><p className="mt-1 font-semibold text-xl">Bir sonraki güzel hikâyen.</p></div>
      <button type="button" onClick={() => setOnlySaved(!onlySaved)} aria-pressed={onlySaved} className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-xs font-semibold ${onlySaved ? "border-primary bg-orange-50 text-primary dark:bg-orange-950/30" : "border-[#e4ded2] bg-white/70 dark:border-slate-700 dark:bg-slate-900"}`}><Heart className="h-3.5 w-3.5" />Bu oturumdaki listem<span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f1eee6] text-[10px] text-stone-600">{saved.size}</span></button>
    </div>

    <section className="relative isolate overflow-hidden rounded-[28px] bg-[#edeedd] dark:bg-[#26382e]">
      <div className="pointer-events-none absolute -right-20 -top-36 h-[520px] w-[520px] rounded-full border border-[#c4c8ad]/50" /><div className="pointer-events-none absolute -right-8 -top-20 h-[400px] w-[400px] rounded-full border border-[#c4c8ad]/40" />
      <div className="relative grid items-center gap-4 px-6 py-9 sm:px-10 md:grid-cols-[1.15fr_1fr] lg:px-12 lg:py-12">
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#c9ceb7] bg-white/40 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.13em] dark:border-emerald-800 dark:bg-emerald-950/40"><Sparkles className="h-3 w-3 text-primary" />Sana özel kitap keşfi</span>
          <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight md:text-3xl">Bazı kitaplar<br />tam da <span className="text-[#71805a] dark:text-[#b5c796]">seni bekler.</span></h1>
          <p className="mt-5 max-w-sm text-[13px] leading-6 text-[#777c69] dark:text-slate-300">Ruh haline, sevdiğin hikâyelere ve okuma zevkine göre seçilen kitaplarla bir sonraki favorini keşfet.</p>
          <a href="#discovery-controls" className="mt-6 inline-flex min-h-11 items-center gap-3 rounded-full bg-[#293e32] px-5 text-xs font-semibold text-white transition hover:bg-[#405b45] dark:bg-[#d6dfc0] dark:text-[#26382e]">Yeni bir hikâye bul<ArrowDown className="h-3.5 w-3.5" /></a>
          <div className="mt-6 flex items-center gap-2 text-[10px] text-[#777c69] dark:text-slate-400"><BookOpen className="h-3.5 w-3.5" />Senin zevkin. Senin sıradaki kitabın.</div>
        </div>
        <div aria-hidden="true" className="relative mx-auto flex h-56 w-full max-w-md items-end justify-center gap-0 pb-5 sm:h-72 lg:h-80">
          <div className="absolute inset-x-4 bottom-0 h-10 rounded-[50%] bg-[#7c8361]/20 blur-xl" />
          {Array.from({ length: 3 }, (_, index) => { const book = heroBooks[index]; const fallback = ["Yeni bir dünya", "Sıradaki hikâyen", "Bir sayfa daha"]; return <div key={index} className={`relative w-[27%] max-w-[140px] ${index === 0 ? "translate-x-3 -rotate-12" : index === 1 ? "z-10 -translate-y-4" : "-translate-x-3 rotate-12"}`}><Cover title={book?.title || fallback[index]} author={book?.author || "KEŞFETMEYE DEVAM ET"} url={book?.coverImageUrl} index={index} /></div>; })}
        </div>
      </div>
    </section>

    <section id="discovery-controls" className="scroll-mt-24 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-xs font-medium text-primary">KÜÇÜK BİR İPUCU VER</p><h2 className="text-xl font-semibold tracking-tight md:text-2xl">Bugün ne okumak istersin?</h2></div><button type="button" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} aria-controls="reading-preferences" className="flex min-h-10 items-center gap-2 text-xs font-semibold text-stone-500 dark:text-slate-400"><SlidersHorizontal className="h-3.5 w-3.5" />Tercihler<ChevronDown className={`h-3 w-3 transition ${showFilters ? "rotate-180" : ""}`} /></button></div>
      <div className="book-genre-rail flex gap-2 overflow-x-auto pb-2" aria-label="Kitap türü tercihi">{genres.map(value => <button key={value} type="button" onClick={() => chooseGenre(value)} aria-pressed={genre === value} className={`min-h-10 shrink-0 rounded-full border px-4 text-[11px] font-semibold transition ${genre === value ? "border-[#293e32] bg-[#293e32] text-white dark:border-[#d6dfc0] dark:bg-[#d6dfc0] dark:text-slate-900" : "border-[#e7e1d6] bg-white text-stone-500 hover:border-stone-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>{value}</button>)}</div>
      {showFilters && <div id="reading-preferences" className="grid gap-5 rounded-[22px] border border-[#e8e2d6] bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1fr_1.2fr] lg:p-6">
        <div className="space-y-4"><div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f5f3ed] p-1 dark:bg-slate-800">{([['choose_new_book', 'Yeni kitap keşfet', ShoppingBag], ['choose_library_book', 'Rafımdan seç', BookOpen]] as const).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => props.onGoalChange(value)} aria-pressed={props.goal === value} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-[11px] font-semibold ${props.goal === value ? "bg-white text-primary shadow-sm dark:bg-slate-700" : "text-stone-500 dark:text-slate-400"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div>
          <div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-[10px] font-semibold text-stone-500 dark:text-slate-400"><span>Bugünkü ruh halin</span><select value={props.mood} onChange={event => props.onMoodChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-[#e7e1d6] bg-transparent px-3 text-xs text-stone-700 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{["Normal", "Meraklı", "İlham arıyorum", "Yorgun", "Heyecanlı", "Sakin"].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="space-y-2 text-[10px] font-semibold text-stone-500 dark:text-slate-400"><span className="flex items-center gap-1"><Clock className="h-3 w-3" />Günlük okuma süren</span><select value={props.minutes} onChange={event => props.onMinutesChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-[#e7e1d6] bg-transparent px-3 text-xs text-stone-700 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{["15", "30", "45", "60", "90"].map(value => <option key={value} value={value}>{value} dakika</option>)}</select></label></div></div>
        <div className="flex flex-col gap-3"><label htmlFor="book-wishes" className="text-[10px] font-semibold text-stone-500 dark:text-slate-400">Nasıl bir hikâye arıyorsun?</label><textarea id="book-wishes" rows={2} value={props.preference} onChange={event => props.onPreferenceChange(event.target.value)} placeholder="Biraz gizem, uzak dünyalar ya da içimi ısıtacak bir hikâye…" className="min-h-20 flex-1 resize-y rounded-xl border border-[#e7e1d6] bg-[#fcfbf8] p-3 text-xs leading-5 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-950" /><button type="button" disabled={props.loading || props.loadingBooks} onClick={() => { setOnlySaved(false); props.onGenerate(); }} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-white shadow-[0_5px_16px_rgba(230,91,0,.15)] transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60">{props.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{props.loading ? "Sana uygun kitaplar seçiliyor…" : "Bana özel kitapları keşfet"}{!props.loading && <ArrowRight className="ml-2 h-4 w-4" />}</button></div>
      </div>}
    </section>

    <section aria-live="polite" aria-busy={props.loading || props.loadingBooks} className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="mb-1 text-xs font-medium text-primary">{onlySaved ? "AKLINDA KALSIN" : props.result ? "SENİN İÇİN SEÇİLDİ" : "KENDİ RAFINDA BİR KEŞİF"}</p><h2 className="text-xl font-semibold tracking-tight md:text-2xl">{onlySaved ? "Göz koydukların" : props.result ? "Sıradaki favorin burada olabilir." : "Rafından ilham al."}</h2></div><span className="text-[10px] text-stone-500">{visible.length} kitap{onlySaved && <button type="button" aria-label="Liste filtresini kapat" onClick={() => setOnlySaved(false)} className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200"><X className="h-3 w-3" /></button>}</span></div>
      {props.error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-5 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><AlertCircle className="h-4 w-4 shrink-0" /><div><p className="font-semibold">Kitaplar şu an seçilemedi.</p><p>{props.error}</p></div></div>}
      {props.loading || props.loadingBooks ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(index => <div key={index} className="overflow-hidden rounded-[22px] border border-stone-200 dark:border-slate-800"><div className="flex h-64 items-center justify-center bg-stone-100 dark:bg-slate-800"><div className="h-44 w-28 animate-pulse rounded bg-stone-200 dark:bg-slate-700" /></div><div className="space-y-3 p-5"><div className="h-4 w-2/3 animate-pulse rounded bg-stone-200 dark:bg-slate-700" /><div className="h-3 w-1/2 animate-pulse rounded bg-stone-100 dark:bg-slate-800" /><p className="pt-4 text-[11px] text-stone-500">Kitapları ve baskı bilgilerini araştırıyoruz…</p></div></div>)}</div> : <>
        {props.result && profile && !onlySaved && <div className="flex gap-3 rounded-2xl bg-[#eeefe5] p-4 dark:bg-emerald-950/30"><Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#71805a]" /><p className="text-xs leading-6 text-[#68705b] dark:text-emerald-200">{profile}</p></div>}
        {visible.length > 0 ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{visible.map((item, index) => <BookTile key={keyOf(item)} item={item} index={index} libraryBook={props.books.find(book => book.title.toLocaleLowerCase("tr-TR") === item.title.toLocaleLowerCase("tr-TR") && (book.author || "").toLocaleLowerCase("tr-TR") === item.author.toLocaleLowerCase("tr-TR"))} saved={saved.has(keyOf(item))} onSave={() => toggleSaved(item)} />)}</div> : <div className="flex flex-col items-center rounded-[22px] border border-dashed border-[#d9d5c8] px-6 py-12 text-center dark:border-slate-700"><div className="mb-4 rounded-full bg-[#eeefe5] p-4 dark:bg-slate-800">{onlySaved ? <Heart className="h-6 w-6 text-primary" /> : <Search className="h-6 w-6 text-[#71805a]" />}</div><h3 className="font-semibold text-xl">{onlySaved ? "Bir kitap kalbine dokunsun." : "Güzel bir keşifle başlayalım."}</h3><p className="mt-3 max-w-sm text-xs leading-6 text-stone-500">{onlySaved ? "Beğendiğin kitapların kalbine dokun; bu oturumda burada bir araya gelsinler." : props.result ? emptyMessage || "Tercihlerini değiştirerek yeni kitaplar keşfedebilirsin." : "Yukarıdan sevdiğin türü seç, nasıl bir hikâye aradığını anlat. Sana özel önerileri birlikte bulalım."}</p></div>}
      </>}
    </section>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6e1d6] pt-5 text-[10px] leading-5 text-stone-400 dark:border-slate-800"><span className="flex items-center gap-1.5"><Check className="h-3 w-3" />Öneriler senin tercihlerine göre hazırlanır.</span><span>Satın alma bağlantıları mağaza aramasını açar; fiyat ve stok mağazada gösterilir.</span></footer>
  </div>;
}
