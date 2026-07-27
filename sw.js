/* かわたれ studio ― PWA サービスワーカー
   目的: オフラインでも動くこと / 2回目以降を速くすること
   方針: 広告・計測など外部リクエストには一切触れない            */
var VER   = 'v1-20260727';
var SHELL = 'shell-' + VER;
var RT    = 'rt-' + VER;

/* インストール時に必ず入れる最小限（失敗するとインストール自体が失敗するので絞る） */
var CORE = ['/', '/favicon.svg', '/site.webmanifest',
            '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

/* 余裕があれば入れておきたいページ（失敗しても無視する） */
var EXTRA = ["/about.html", "/article-sidejob-crowdsourcing.html", "/compare-ilovepdf.html", "/compare-tinypng.html", "/privacy.html", "/service.html", "/terms.html", "/tool-base64.html", "/tool-case-convert.html", "/tool-fullwidth-halfwidth.html", "/tool-hash.html", "/tool-image-compressor.html", "/tool-image-convert.html", "/tool-image-crop.html", "/tool-image-exif-remove.html", "/tool-image-resize.html", "/tool-image-rotate.html", "/tool-image-to-pdf.html", "/tool-json-format.html", "/tool-password.html", "/tool-pdf-organizer.html", "/tool-pdf-to-image.html", "/tool-qr.html", "/tool-remove-linebreaks.html", "/tool-square-photo.html", "/tool-url-encode.html", "/tool-uuid.html", "/tool-word-count.html"];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(SHELL).then(function(c){ return c.addAll(CORE); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if (k !== SHELL && k !== RT) { return caches.delete(k); }
      }));
    }).then(function(){
      return caches.open(SHELL).then(function(c){
        return Promise.all(EXTRA.map(function(u){
          return c.add(u).catch(function(){});
        }));
      });
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') { return; }

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) { return; }   /* 広告・GA4はそのまま通す */

  /* ページ遷移: まずネットワーク（内容を最新に）、落ちたらキャッシュ */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(RT).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(hit){
          return hit || caches.match('/');
        });
      })
    );
    return;
  }

  /* それ以外（画像・アイコン等）: まずキャッシュ、なければ取得して保存 */
  e.respondWith(
    caches.match(req).then(function(hit){
      if (hit) { return hit; }
      return fetch(req).then(function(res){
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(RT).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit; });
    })
  );
});

/* ページ側から即時更新を指示できるようにする */
self.addEventListener('message', function(e){
  if (e.data === 'skipWaiting') { self.skipWaiting(); }
});
