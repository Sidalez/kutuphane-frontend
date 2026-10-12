import type { PageLoadingProps } from "./PageLoading";

/** Used both while a page bundle opens and while its data loads. */
export function pageLoadingConfig(path: string): PageLoadingProps {
  if (["/today","/calendar","/notes","/collections","/data","/support"].includes(path)) return {variant:"dashboard", section:"Kişisel alanın", label:"Kişisel alanın hazırlanıyor…", description:"Kitapların, izlediklerin ve kişisel kayıtların getiriliyor."};
  if (path === "/notifications") return {variant:"settings", section:"Bildirim merkezi", label:"Bildirimlerin hazırlanıyor…", description:"Yeni gelişmeler ve bildirim tercihlerin getiriliyor."};
  if (path === "/media/reports") return {variant:"dashboard", section:"İzleme raporları", label:"İzleme raporların hazırlanıyor…", description:"İzleme geçmişin, sürelerin ve dönem özetlerin getiriliyor."};
  if (path === "/media/suggestions") return {variant:"media-suggestions", section:"Film ve dizi keşfi", label:"Keşif alanın hazırlanıyor…", description:"İzleme geçmişin ve tercihlerin getiriliyor."};
  if (path === "/add-media") return {variant:"media-form", section:"Film ve dizi ekle", label:"İçerik ekleme alanı hazırlanıyor…", description:"Arama ve izleme bilgisi alanları açılıyor."};
  if (/^\/media\/[^/]+$/.test(path)) return {variant:"media-detail", section:"İçerik detayı", label:"Film ve dizi bilgileri hazırlanıyor…", description:"Poster, içerik bilgileri ve izleme ilerlemen getiriliyor."};
  if (path === "/media") return {variant:"media", label:"İzleme rafın hazırlanıyor…"};
  if (path === "/statistics") return {variant:"dashboard", section:"Okuma istatistikleri", label:"Okuma istatistiklerin hazırlanıyor…", description:"Okuma geçmişin ve ilerleme özetlerin hesaplanıyor."};
  if (path === "/goals") return {variant:"dashboard", section:"Okuma hedefleri", label:"Hedeflerin hazırlanıyor…", description:"Okuma hedeflerin ve güncel ilerlemen getiriliyor."};
  if (path === "/suggestions") return {variant:"suggestions", label:"Kitap keşif alanın hazırlanıyor…", description:"Kütüphanen ve okuma tercihlerin getiriliyor."};
  if (path === "/profile") return {variant:"profile", label:"Profilin hazırlanıyor…", description:"Hesap bilgilerin ve profil fotoğrafın getiriliyor."};
  if (path === "/settings") return {variant:"settings", label:"Ayarların hazırlanıyor…", description:"Görünüm ve hesap seçeneklerin açılıyor."};
  if (path.startsWith("/edit/")) return {variant:"form", label:"Kitap bilgileri hazırlanıyor…"};
  if (path === "/add-book") return {variant:"form", section:"Kitap ekle", label:"Kitap ekleme alanı hazırlanıyor…", description:"ISBN araması ve kitap bilgisi alanları açılıyor."};
  if (/^\/library\/[^/]+$/.test(path)) return {variant:"detail", label:"Kitabın hazırlanıyor…"};
  return {variant:"list", label:"Kütüphanen hazırlanıyor…"};
}
