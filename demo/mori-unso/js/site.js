/* 杜運送 — サイト挙動（バニラJS・環境差に強いスクロール連動） */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* スクロール出現（IO＋安全ネット） */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  function showAll() { reveals.forEach(function (el) { el.classList.add('is-in'); }); }
  if (reduce || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { io.observe(el); });
    // フォールバック: 何らかの理由でIOが発火しなくても内容は必ず表示する
    setTimeout(showAll, 2500);
  }

  /* 数字カウントアップ */
  function runCount() {
    Array.prototype.slice.call(document.querySelectorAll('[data-count]')).forEach(function (s) {
      var target = parseInt(s.getAttribute('data-count'), 10);
      if (s.getAttribute('data-plain') || reduce) { s.textContent = target; return; }
      var start = null, dur = 1100;
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        s.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step); else s.textContent = target;
      }
      requestAnimationFrame(step);
    });
  }

  /* スクロール連動：追従ナビ＋カウント発火 */
  var nav = document.querySelector('.sitenav');
  var hero = document.querySelector('.hero');
  var numbers = document.getElementById('numbers');
  var counted = false;
  function onScroll() {
    if (nav && hero) {
      nav.classList.toggle('is-visible', window.scrollY > (hero.offsetHeight - 80));
    }
    if (!counted && numbers && numbers.getBoundingClientRect().top < window.innerHeight * 0.85) {
      counted = true;
      runCount();
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  function init() { onScroll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
