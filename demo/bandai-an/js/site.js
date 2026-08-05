/* ばんだい庵 — サイト挙動（バニラJS） */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- お知らせ（データ駆動） --- */
  var NEWS = [
    { date: '2026-07-20', tag: '甘味', text: '湧水の水羊羹、今年もはじめました。' },
    { date: '2026-07-12', tag: '営業', text: 'お盆（8/13–16）は混み合います。ご予約をおすすめします。' },
    { date: '2026-06-28', tag: '体験', text: '蕎麦打ち体験、金・土・日に開いています。' }
  ];
  function renderNews() {
    var ul = document.getElementById('news-list');
    if (!ul) return;
    ul.innerHTML = NEWS.slice(0, 3).map(function (n) {
      var d = n.date.replace(/-/g, '.');
      return '<li><time datetime="' + n.date + '">' + d + '</time>' +
             '<span class="news__tag">' + n.tag + '</span>' +
             '<span>' + n.text + '</span></li>';
    }).join('');
  }

  /* --- 営業状況（現在時刻から自動判定） --- */
  function updateStatus() {
    var el = document.getElementById('open-status');
    if (!el) return;
    var now = new Date();
    var day = now.getDay();               // 0=日 … 3=水
    var mins = now.getHours() * 60 + now.getMinutes();
    var open = day !== 3 && mins >= 660 && mins <= 900; // 11:00-15:00, 水曜定休
    var label = day === 3 ? '本日 定休' : (open ? '本日 営業中' : 'ただいま準備中');
    var t = el.querySelector('.label');
    if (t) t.textContent = label;
    el.classList.toggle('is-open', open);
  }

  /* --- タブ（アクセシブル） --- */
  function initTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;
    function panelOf(tab) { return document.getElementById(tab.getAttribute('aria-controls')); }
    function activate(tab, focus) {
      tabs.forEach(function (t) {
        var sel = t === tab;
        t.setAttribute('aria-selected', sel ? 'true' : 'false');
        var p = panelOf(t);
        if (p) p.hidden = !sel;
      });
      if (focus !== false) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { activate(tab); });
      tab.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); activate(tabs[(i + 1) % tabs.length]); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); activate(tabs[(i - 1 + tabs.length) % tabs.length]); }
      });
    });
    // アンカー来訪でタブを開く（#reserve は独立した節なので対象外）
    var map = { '#menu': 't-menu', '#story': 't-story', '#access': 't-access' };
    function fromHash() {
      var id = map[location.hash];
      if (id) activate(document.getElementById(id), false);
    }
    window.addEventListener('hashchange', fromHash);
    fromHash();
  }

  /* --- 追従ナビ（ヒーローが画面外で出現） --- */
  function initNav() {
    var nav = document.querySelector('.sitenav');
    var hero = document.querySelector('.hero');
    if (!nav || !hero || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      nav.classList.toggle('is-visible', !entries[0].isIntersecting);
    }, { threshold: 0.06 }).observe(hero);
  }

  /* --- スクロール出現 --- */
  function initReveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    els.forEach(function (el) { io.observe(el); });
  }

  function init() {
    renderNews();
    updateStatus();
    initTabs();
    initNav();
    initReveal();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
