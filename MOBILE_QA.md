# Mobil doğrulama durumu

## Otomatik olarak doğrulananlar

- Sayaç: mola süresi dışarıda kalır; kayıt yeniden yüklendiğinde çalışan/duraklatılmış/bitmiş durum korunur. Ekran kapalıyken geçen süre `Date.now()` farkıyla hesaplanır; interval sayısına bağlı değildir.
- Tarih: Türkiye saati 00:05 yeni güne yazılır; UTC an bilgisi korunur.
- Tema: açık/koyu geçişinde safe-area, color-scheme ve tarayıcı renk ipuçları birlikte güncellenir.
- Push: hatalı payload dahil görünür bildirim; açık pencerelere yenileme mesajı; bildirim tıklamasında dış URL engeli.
- Geri yükleme: dosya sürümü, referans eşleme, hesap sahipliği, tekrar içe aktarmada idempotency, geçersiz yolları reddetme.
- Cihaz oturumları: sunucu iptal edilen sessionId'yi yeniden kaydettirme ve kullanma girişimlerini reddeder.
- Üretim PWA derlemesi: uygulama kabuğu precache; API yanıtları service worker cache'ine alınmaz. Sürüm dosyası cache dışında kalır.

## Gerçek cihazda henüz yapılmayanlar

Bu çalışma oturumunda erişilebilir tarayıcı/telefon bulunmadığı için aşağıdaki kontroller tamamlandı olarak işaretlenmedi.

| Kontrol | iPhone Safari/PWA | Android Chrome/PWA |
|---|---|---|
| 360–430 px: yatay taşma, alt menü ve güvenli alan | Bekliyor | Bekliyor |
| Sayaç açıkken ekranı 5 dakika kilitle, dön, duraklat/devam et | Bekliyor | Bekliyor |
| Gece yarısı öncesi başlat, sonrası bitir; başlangıç gününü koru | Bekliyor | Bekliyor |
| Önceden açılmış kitap/takvim/notları çevrimdışı aç | Bekliyor | Bekliyor |
| Bağlantı gelince bekleyen not/koleksiyonları eşitle | Bekliyor | Bekliyor |
| Yedek indir, aynı dosyayı iki kez yükle, tekrar kayıt olmadığını doğrula | Bekliyor | Bekliyor |
| Başka tarayıcıdan cihazı kapat; veri erişimi reddedilsin | Bekliyor | Bekliyor |
| Yeni sürüm uyarısını kabul et; kaydedilmemiş taslak için uyarı gör | Bekliyor | Bekliyor |
| Push izni, kilit ekranı bildirimi ve uygulama içi kutu | Bekliyor | Bekliyor |

Otomatik test komutu: `node --test tests/*.test.cjs`. Üretim derlemesi: `npm run build`.
