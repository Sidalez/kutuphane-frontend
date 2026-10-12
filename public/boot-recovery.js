/* Runs before the module entry, so a missing old bundle cannot strand the boot screen. */
(function () {
  var busy = false;
  function showRetry() {
    var boot = document.querySelector('.boot');
    if (!boot || document.getElementById('boot-retry')) return;
    var message = document.createElement('span');
    message.textContent = navigator.onLine ? 'Uygulama dosyaları yüklenemedi. Yeniden deneyebilirsin.' : 'İnternet bağlantını kontrol edip yeniden dene.';
    var button = document.createElement('button');
    button.id = 'boot-retry'; button.textContent = 'Yeniden dene';
    button.style.cssText = 'min-height:48px;padding:12px 24px;border:0;border-radius:16px;background:#ea580c;color:white;font:600 14px system-ui;cursor:pointer';
    button.onclick = function () { void recover(true); };
    boot.appendChild(message); boot.appendChild(button);
  }
  async function recover(manual) {
    if (busy) return;
    if (!navigator.onLine) { showRetry(); return; }
    // Never repeatedly reload or silently discard edits on an already mounted page.
    if (!manual && !document.querySelector('.boot')) return;
    try {
      var last = Number(sessionStorage.getItem('app-boot-recovery') || 0);
      if (!manual && Date.now() - last < 600000) { showRetry(); return; }
      sessionStorage.setItem('app-boot-recovery', String(Date.now()));
    } catch (_) { if (!manual) { showRetry(); return; } }
    busy = true;
    try {
      if ('serviceWorker' in navigator) {
        var registration = await Promise.race([navigator.serviceWorker.getRegistration(), new Promise(function(resolve){setTimeout(resolve,3000);})]);
        if (registration) {
          await Promise.race([registration.update().catch(function(){}), new Promise(function(resolve){setTimeout(resolve,5000);})]);
          if (registration.waiting) {
            await new Promise(function(resolve){
              var done = function(){navigator.serviceWorker.removeEventListener('controllerchange',done);resolve();};
              navigator.serviceWorker.addEventListener('controllerchange',done);
              setTimeout(done,3000);
              registration.waiting.postMessage({type:'SKIP_WAITING'});
            });
          }
        }
      }
    } catch (_) {} finally { window.location.reload(); }
  }
  window.recoverAppVersion = recover;
  window.addEventListener('vite:preloadError',function(event){
    if (document.querySelector('.boot')) { event.preventDefault(); void recover(false); }
  });
  window.addEventListener('error',function(event){
    if (event.target && event.target.tagName === 'SCRIPT' && event.target.type === 'module') void recover(false);
  },true);
})();
