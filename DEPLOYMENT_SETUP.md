# Canlı yayın

Bu repo Vercel'in bağlı Git entegrasyonuyla veya `.github/workflows/deploy.yml` üzerinden yayınlanabilir.

Git entegrasyonu için Vercel → proje → Settings → Git: depo `Sidalez/kutuphane-frontend`, Production Branch `main` olmalı. Deployments'ta GitHub'daki son commit için bir Ready deployment görünmeli. Sadece GitHub push başarısı, canlı yayının tamamlandığını kanıtlamaz.

GitHub Actions yöntemi için repo Settings → Secrets and variables → Actions bölümünde `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` gerekir. Token'ı sohbete veya repoya yazma. Proje/organizasyon kimliği Vercel proje ve takım ayarlarından alınır. Mevcut `kisiseltakip.vercel.app` projesinin kimliğini kullan; yeni bir proje oluşturma.

Workflow önce testleri ve derlemeyi çalıştırır; sonra mevcut Vercel projesinin üretim ortamını çekip `vercel build` ve `vercel deploy --prebuilt --prod` çalıştırır. Secret yoksa yayın adımı açık bir kurulum hatasıyla durur.

Yayın kanıtı: `https://kisiseltakip.vercel.app/version.json` içindeki `commit`, GitHub'daki son commit'in ilk 7 karakteriyle eşleşmeli. Ayarlar → Uygulama sürümü aynı bilgiyi kullanıcıya gösterir. Eski PWA'nın yeni worker'ı bulması için ekran odağında ve 5 dakikada bir kontrol yapılır; yeniden yükleme kullanıcı onayıyla olur.

Backend bağımsız Render servisidir. Önce yeni backend yayınlanmalı; `/api/sessions/config` başarılı JSON döndürmeli. Güvenli oturumları etkinleştirme adımları backend reposundaki `SECURE_SESSIONS_SETUP.md` dosyasındadır.
