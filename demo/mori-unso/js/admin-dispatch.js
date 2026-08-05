/* 杜運送 — 配車管理画面（デモ／localStorage・バックエンド不要）
   サイト側の集荷依頼（js/pickup.js）と同じ保存領域を読むので、依頼がそのまま流れてくる。 */
(function () {
  'use strict';

  var STORE = 'moriunso_orders_v1';
  var DOW = ['日', '月', '火', '水', '木', '金', '土'];
  var HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];   // 14コマ

  var AREA = {
    sendai: { label: '仙台市内', span: 2 },
    miyagi: { label: '宮城県内', span: 3 },
    tohoku: { label: '東北6県',  span: 5 },
    kanto:  { label: '首都圏',   span: 6 }
  };

  var DRIVERS = [
    { id: 'd1', name: '佐藤', car: '4t ウイング' },
    { id: 'd2', name: '鈴木', car: '2t 平ボディ' },
    { id: 'd3', name: '高橋', car: '10t ウイング' },
    { id: 'd4', name: '伊藤', car: '4t 冷凍' },
    { id: 'd5', name: '渡辺', car: '2t ゲート付' }
  ];

  /* --- 日付 ----------------------------------------------------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function jpFull(s) {
    var d = parse(s);
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日（' + DOW[d.getDay()] + '）';
  }

  /* --- 保存領域 ------------------------------------------------------- */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(STORE, JSON.stringify(list)); } catch (e) {}
  }

  /* --- デモ用の初期データ（画面が空だと配車の様子が伝わらないため）------ */
  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  var CO = ['東北精機工業', '仙台フーズ', '宮城建材', '北都electronics', '青葉物産',
            '広瀬川製作所', '泉パーツ', '若林紙業', '名取ケミカル', '多賀城印刷'];
  var CARGO = ['パレット', 'カゴ車', 'バラ積み'];
  var AREAKEYS = ['sendai', 'miyagi', 'tohoku', 'kanto'];

  var SEEDED = 'moriunso_seeded_v1';

  /* 指定ドライバーの、その日の空き開始時刻を探す。無ければ null。
     busy は {時:1} の形。割当（assign）とデモデータ投入（seedIfNeeded）で共用する。 */
  function findSlot(busy, span) {
    for (var s = 0; s <= HOURS.length - span; s++) {
      var ok = true;
      for (var k = 0; k < span; k++) { if (busy[HOURS[s] + k]) { ok = false; break; } }
      if (ok) return HOURS[s];
    }
    return null;
  }
  function occupy(busy, hour, span) {
    for (var k = 0; k < span; k++) busy[hour + k] = 1;
  }

  /* 荷主が入れた依頼とは別枠で1度だけ投入する（利用者の依頼があっても盤面を空にしない） */
  function seedIfNeeded() {
    try { if (localStorage.getItem(SEEDED)) return; } catch (e) { return; }

    var list = load(), base = today(), days = [], d = 0;
    while (days.length < 3 && d < 10) {                 // 日曜は運休なので飛ばす
      var cand = addDays(base, d);
      if (cand.getDay() !== 0) days.push(ymd(cand));
      d++;
    }

    days.forEach(function (date, dayIndex) {
      var n = 5 + (hash(date) % 3);
      var busy = {};                                    // ドライバーID → {時:1}
      DRIVERS.forEach(function (d) { busy[d.id] = {}; });

      for (var i = 0; i < n; i++) {
        var h = hash(date + i);
        var area = AREAKEYS[h % 4];
        var span = AREA[area].span;
        var assigned = (h % 10) < 6;                    // 6割は配車済
        var done = dayIndex === 0 && (h % 10) < 2;      // 初日の一部は完了
        var drvId = null, start = null;

        if (assigned || done) {
          /* 空いているドライバーを順に探す。全員埋まっていれば未割当のままにする */
          for (var t = 0; t < DRIVERS.length; t++) {
            var cand = DRIVERS[(h + t) % DRIVERS.length];
            var at = findSlot(busy[cand.id], span);
            if (at !== null) { drvId = cand.id; start = at; occupy(busy[cand.id], at, span); break; }
          }
          if (drvId === null) { assigned = false; done = false; }
        }

        list.push({
          id: 'MU-' + date.replace(/-/g, '').slice(2) + '-' + (100 + (h % 900)),
          date: date, area: area,
          company: CO[h % CO.length] + '株式会社',
          person: '担当者', tel: '022-000-' + pad(h % 100) + pad((h >> 3) % 100),
          from: ['仙台市青葉区', '仙台市宮城野区', '名取市', '多賀城市', '富谷市'][h % 5] + '〇〇',
          cargo: CARGO[h % 3], qty: 1 + (h % 12), note: '',
          status: done ? 'done' : (assigned ? 'assigned' : 'new'),
          driver: drvId,
          hour: start,
          created: date, seed: true
        });
      }
    });
    save(list);
    try { localStorage.setItem(SEEDED, '1'); } catch (e) {}
  }

  /* 依頼のある日を初期表示にする（本日が運休だと盤面が空に見えるため） */
  function firstBusyDay() {
    var all = load(), t = today();
    for (var i = 0; i < 10; i++) {
      var d = ymd(addDays(t, i));
      if (all.some(function (o) { return o.date === d; })) return addDays(t, i);
    }
    return t;
  }

  /* --- 状態 ------------------------------------------------------------ */
  var view = null;      // 表示中の日
  var filter = 'all';
  var picked = null;    // 割当待ちで選択中の依頼ID

  function ofDay() {
    return load().filter(function (o) { return o.date === ymd(view) && o.status !== 'cancelled'; });
  }

  /* --- KPI ------------------------------------------------------------- */
  function renderKpis() {
    var list = ofDay();
    var neu = list.filter(function (o) { return o.status === 'new'; }).length;
    var drv = {};
    list.forEach(function (o) { if (o.driver) drv[o.driver] = 1; });
    var drvN = Object.keys(drv).length;
    var qty = list.reduce(function (s, o) { return s + o.qty; }, 0);
    var load_ = Math.min(100, Math.round(qty / (DRIVERS.length * 14) * 100));

    document.getElementById('kpi-total').innerHTML = list.length + '<small>件</small>';
    document.getElementById('kpi-new').innerHTML = neu + '<small>件</small>';
    document.getElementById('kpi-drivers').innerHTML = drvN + '<small>/' + DRIVERS.length + '名</small>';
    document.getElementById('kpi-load').innerHTML = load_ + '<small>%</small>';
    document.getElementById('kpi-load-bar').style.width = load_ + '%';
  }

  /* --- 配車ボード ------------------------------------------------------ */
  function renderBoard() {
    var el = document.getElementById('adm-board');
    var list = ofDay();

    var head = '<div class="bd__head"><div class="bd__label">ドライバー／車両</div><div class="bd__hours">' +
      HOURS.map(function (h) { return '<div class="bd__hcell">' + h + '</div>'; }).join('') +
      '</div></div>';

    var rows = DRIVERS.map(function (d) {
      var jobs = list.filter(function (o) { return o.driver === d.id && o.hour != null; })
                     .sort(function (a, b) { return a.hour - b.hour; });
      /* 万一時間が重なっても隠れないよう、重なる分は下の段に落とす */
      var lanes = [];
      var cells = jobs.map(function (o) {
        var col = Math.max(1, HOURS.indexOf(o.hour) + 1);
        var span = Math.min(AREA[o.area].span, HOURS.length - col + 1);
        var row = 0;
        while (lanes[row] != null && lanes[row] > col) row++;
        lanes[row] = col + span;
        return '<div class="bd__job' + (o.status === 'done' ? ' is-done' : '') + '"' +
               ' style="grid-column:' + col + ' / span ' + span + ';grid-row:' + (row + 1) + '"' +
               ' title="' + o.company + '／' + AREA[o.area].label + '／' + o.cargo + o.qty + '">' +
               '<p class="bd__job-c">' + o.company + '</p>' +
               '<p class="bd__job-m">' + o.hour + ':00 ' + AREA[o.area].label + ' ' + o.cargo + o.qty + '</p>' +
               '</div>';
      }).join('');
      if (!jobs.length) cells = '<p class="bd__empty">— 空き —</p>';

      return '<div class="bd__row">' +
        '<div class="bd__drv"><span class="bd__drv-n">' + d.name + '</span>' +
        '<span class="bd__drv-c">' + d.car + '</span></div>' +
        '<div class="bd__lane' + (picked ? ' is-target' : '') + '" data-driver="' + d.id + '">' + cells + '</div>' +
        '</div>';
    }).join('');

    el.innerHTML = '<div class="bd">' + head + rows + '</div>';
  }

  /* --- 依頼一覧 -------------------------------------------------------- */
  var STATUS = { new: '未割当', assigned: '配車済', done: '完了' };

  function renderOrders() {
    var el = document.getElementById('adm-orders');
    var list = ofDay().filter(function (o) { return filter === 'all' || o.status === filter; });

    if (!list.length) {
      el.innerHTML = '<p class="tbl__empty">該当する集荷依頼はありません。</p>';
      return;
    }

    var rows = list.map(function (o) {
      var d = o.driver ? DRIVERS.filter(function (x) { return x.id === o.driver; })[0] : null;
      var act = o.status === 'new'
        ? '<button type="button" class="act act--pri" data-pick="' + o.id + '">' +
          (picked === o.id ? '割当先を選択中…' : 'ドライバーを割当') + '</button>'
        : (o.status === 'assigned'
            ? '<button type="button" class="act" data-done="' + o.id + '">完了にする</button>'
            : '<button type="button" class="act" data-undo="' + o.id + '">配車済に戻す</button>');

      return '<tr class="' + (picked === o.id ? 'is-sel' : '') + '">' +
        '<td class="tbl__id">' + o.id + '</td>' +
        '<td><p class="tbl__co">' + o.company + '</p><p class="tbl__sub">' + o.from + '</p></td>' +
        '<td><span class="chip chip--area">' + AREA[o.area].label + '</span></td>' +
        '<td class="tbl__num">' + o.cargo + ' ' + o.qty + '</td>' +
        '<td class="tbl__num">' + (o.hour != null ? o.hour + ':00' : '—') + '</td>' +
        '<td>' + (d ? d.name + '<span class="tbl__sub"> ／ ' + d.car + '</span>' : '<span class="tbl__sub">未定</span>') + '</td>' +
        '<td><span class="chip chip--' + o.status + '">' + STATUS[o.status] + '</span></td>' +
        '<td>' + act + '</td>' +
      '</tr>';
    }).join('');

    el.innerHTML = '<table class="tbl"><thead><tr>' +
      '<th>受付番号</th><th>荷主・集荷先</th><th>エリア</th><th>荷姿・数量</th>' +
      '<th>集荷時刻</th><th>担当</th><th>状態</th><th>操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* --- 操作 ------------------------------------------------------------ */
  function update(id, fn) {
    var list = load();
    list.forEach(function (o) { if (o.id === id) fn(o); });
    save(list);
    renderAll();
  }

  /* 空いている時刻を探して割り当てる（同じドライバーの予定と重ならないように） */
  function assign(id, driverId) {
    var list = load();
    var order = list.filter(function (o) { return o.id === id; })[0];
    if (!order) return;

    var busy = {};
    list.forEach(function (o) {
      if (o.date === order.date && o.driver === driverId && o.hour != null && o.id !== id) {
        occupy(busy, o.hour, AREA[o.area].span);
      }
    });

    var place = findSlot(busy, AREA[order.area].span);
    if (place === null) {
      var d = DRIVERS.filter(function (x) { return x.id === driverId; })[0];
      notice((d ? d.name : 'このドライバー') + 'さんは当日の予定が埋まっています。別のドライバーをお選びください。', 'warn');
      return;
    }

    order.driver = driverId;
    order.hour = place;
    order.status = 'assigned';
    save(list);
    picked = null;
    renderAll();
    var dv = DRIVERS.filter(function (x) { return x.id === driverId; })[0];
    notice(order.id + ' を ' + (dv ? dv.name : '') + 'さん（' + place + ':00〜）に割り当てました。', 'ok');
  }

  /* 画面内のお知らせ（alert を使わない） */
  var noticeTimer = null;
  function notice(msg, tone) {
    var el = document.getElementById('adm-notice');
    if (!el) return;
    el.textContent = msg;
    el.className = 'adm__notice is-' + (tone || 'ok');
    el.hidden = false;
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { el.hidden = true; }, 6000);
  }

  /* --- 描画まとめ ------------------------------------------------------ */
  function renderAll() {
    document.getElementById('adm-date').textContent =
      jpFull(ymd(view)) + (ymd(view) === ymd(today()) ? '・本日' : '');
    renderKpis();
    renderBoard();
    renderOrders();
  }

  /* --- 初期化 ---------------------------------------------------------- */
  function init() {
    if (!document.getElementById('adm-board')) return;
    seedIfNeeded();
    view = firstBusyDay();
    renderAll();

    document.getElementById('adm-prev').addEventListener('click', function () { view = addDays(view, -1); picked = null; renderAll(); });
    document.getElementById('adm-next').addEventListener('click', function () { view = addDays(view, 1); picked = null; renderAll(); });
    document.getElementById('adm-today').addEventListener('click', function () { view = today(); picked = null; renderAll(); });

    document.querySelector('.adm__filters').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-f]') : null;
      if (!b) return;
      filter = b.getAttribute('data-f');
      this.querySelectorAll('button').forEach(function (x) { x.classList.remove('is-on'); });
      b.classList.add('is-on');
      renderOrders();
    });

    document.getElementById('adm-orders').addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset.pick) {
        picked = (picked === t.dataset.pick) ? null : t.dataset.pick;
        renderBoard();
        renderOrders();
        if (picked) document.getElementById('board').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (t.dataset.done) update(t.dataset.done, function (o) { o.status = 'done'; });
      if (t.dataset.undo) update(t.dataset.undo, function (o) { o.status = 'assigned'; });
    });

    document.getElementById('adm-board').addEventListener('click', function (e) {
      var lane = e.target.closest ? e.target.closest('.bd__lane') : null;
      if (!lane || !picked) return;
      assign(picked, lane.getAttribute('data-driver'));
    });

    document.getElementById('adm-reset').addEventListener('click', function () {
      if (!confirm('デモデータを初期化します。この端末に保存した集荷依頼も消えます。よろしいですか？')) return;
      localStorage.removeItem(STORE);
      try { localStorage.removeItem(SEEDED); } catch (e) {}
      picked = null;
      seedIfNeeded();
      view = firstBusyDay();
      renderAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
