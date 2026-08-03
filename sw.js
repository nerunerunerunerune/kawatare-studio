/* かわたれ studio ― PWA サービスワーカー
   目的: オフラインでも動くこと / 2回目以降を速くすること
   方針: 広告・計測など外部リクエストには一切触れない            */
var VER   = 'v3-20260801';
var SHELL = 'shell-' + VER;
var RT    = 'rt-' + VER;

/* インストール時に必ず入れる最小限（失敗するとインストール自体が失敗するので絞る） */
var CORE = ['/', '/favicon.svg', '/site.webmanifest',
            '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

/* 余裕があれば入れておきたいページ（失敗しても無視する） */
var EXTRA = ["/about", "/article-character-count", "/article-exif-location-remove", "/article-mercari-square-photo", "/article-merge-documents-pdf", "/article-pdf-to-image", "/article-receipt-to-pdf", "/article-reduce-file-size", "/article-sidejob-crowdsourcing", "/compare-ilovepdf", "/compare-tinypng", "/privacy", "/service", "/terms", "/tool-base64", "/tool-case-convert", "/tool-fullwidth-halfwidth", "/tool-hash", "/tool-image-compressor", "/tool-image-convert", "/tool-image-crop", "/tool-image-exif-remove", "/tool-image-resize", "/tool-image-rotate", "/tool-image-to-pdf", "/tool-json-format", "/tool-password", "/tool-pdf-organizer", "/tool-pdf-to-image", "/tool-qr", "/tool-remove-linebreaks", "/tool-square-photo", "/tool-url-encode", "/tool-uuid", "/tool-word-count"];

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
        if (res && res.ok) {   /* 404・5xx はキャッシュしない（アセット側と挙動を揃える） */
          var copy = res.clone();
          caches.open(RT).then(function(c){ c.put(req, copy); });
        }
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
