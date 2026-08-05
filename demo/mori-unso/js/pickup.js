/* 杜運送 — 集荷スケジュール＆集荷依頼（デモ／localStorage・バックエンド不要）
   参考にした実務: BtoB物流サイトは「スケジュール表」を持つ（新世紀海運の本船スケジュール） */
(function () {
  'use strict';

  var STORE = 'moriunso_orders_v1';
  var DAYS = 7;                       // 表に出す日数
  var DOW = ['日', '月', '火', '水', '木', '金', '土'];

  /* --- エリア別の受付ルール ------------------------------------------ */
  var AREAS = [
    { key: 'sendai', label: '仙台市内',   sub: '当日便あり',     cutoff: '15:00', cap: 8, off: [0] },
    { key: 'miyagi', label: '宮城県内',   sub: '翌日着',         cutoff: '14:00', cap: 6, off: [0] },
    { key: 'tohoku', label: '東北6県',    sub: '翌日〜翌々日着', cutoff: '12:00', cap: 5, off: [0] },
    { key: 'kanto',  label: '首都圏',     sub: '翌日着・定期便', cutoff: '11:00', cap: 4, off: [0, 6] }
  ];
  var AREA = {};
  AREAS.forEach(function (a) { AREA[a.key] = a; });

  var CARGO = ['パレット', 'カゴ車', 'バラ積み', 'その他'];

  /* --- 日付 ----------------------------------------------------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function jpDate(s) {
    var p = s.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return (d.getMonth() + 1) + '/' + d.getDate() + '（' + DOW[d.getDay()] + '）';
  }

  /* --- 保存領域 ------------------------------------------------------- */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(STORE, JSON.stringify(list)); } catch (e) {}
  }

  /* --- 既存の積載（デモ用に日付から決定論的に生成）-------------------- */
  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function seedUsed(date, areaKey, cap) {
    var r = (hash(date + '|' + areaKey) % 100) / 100;
    if (r < 0.12) return cap;                       // 満車
    if (r < 0.26) return Math.max(cap - 1, 1);      // 残りわずか
    return Math.round(cap * (0.15 + r * 0.55));
  }
  function used(date, areaKey) {
    var a = AREA[areaKey], n = seedUsed(date, areaKey, a.cap);
    load().forEach(function (o) {
      if (o.date === date && o.area === areaKey && o.status !== 'cancelled') n += 1;
    });
    return Math.min(n, a.cap);
  }
  function remain(date, areaKey) { return AREA[areaKey].cap - used(date, areaKey); }

  function isOff(date, areaKey) {
    var p = date.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return AREA[areaKey].off.indexOf(d.getDay()) !== -1;
  }
  /* 当日は締切時刻を過ぎていたら受け付けない */
  function pastCutoff(date, areaKey) {
    if (date !== ymd(today())) return false;
    var c = AREA[areaKey].cutoff.split(':');
    var now = new Date();
    return (now.getHours() * 60 + now.getMinutes()) >= (+c[0] * 60 + +c[1]);
  }

  function cellState(date, areaKey) {
    if (isOff(date, areaKey)) return 'off';
    if (pastCutoff(date, areaKey)) return 'late';
    var r = remain(date, areaKey);
    if (r <= 0) return 'full';
    if (r <= 1) return 'few';
    return 'open';
  }
  var STATE_TEXT = { open: '受付中', few: '残り1枠', full: '満車', off: '運休', late: '本日締切' };

  /* --- スケジュール表の描画 ------------------------------------------- */
  var dates = [];
  var sel = null;   // {date, area}

  function renderTable() {
    var wrap = document.getElementById('pk-table');
    if (!wrap) return;
    var t = today();
    dates = [];
    for (var i = 0; i < DAYS; i++) dates.push(ymd(addDays(t, i)));

    var head = '<tr><th scope="col" class="pk-th-area">エリア</th>' +
      dates.map(function (d, i) {
        var p = d.split('-'), dd = new Date(+p[0], +p[1] - 1, +p[2]);
        var cls = dd.getDay() === 0 ? ' is-sun' : (dd.getDay() === 6 ? ' is-sat' : '');
        return '<th scope="col" class="pk-th' + cls + '">' +
               '<span class="pk-th__d">' + (dd.getMonth() + 1) + '/' + dd.getDate() + '</span>' +
               '<span class="pk-th__w">' + DOW[dd.getDay()] + (i === 0 ? '・本日' : '') + '</span></th>';
      }).join('') + '</tr>';

    var body = AREAS.map(function (a) {
      return '<tr>' +
        '<th scope="row" class="pk-area">' +
          '<span class="pk-area__n">' + a.label + '</span>' +
          '<span class="pk-area__s">' + a.sub + '／締切 ' + a.cutoff + '</span>' +
        '</th>' +
        dates.map(function (d) {
          var st = cellState(d, a.key);
          var can = (st === 'open' || st === 'few');
          var r = remain(d, a.key);
          return '<td class="pk-cell">' +
            '<button type="button" class="pk-slot is-' + st + '"' + (can ? '' : ' disabled') +
              ' data-date="' + d + '" data-area="' + a.key + '"' +
              ' aria-label="' + jpDate(d) + ' ' + a.label + ' ' + STATE_TEXT[st] + '">' +
              '<span class="pk-slot__s">' + STATE_TEXT[st] + '</span>' +
              (can ? '<span class="pk-slot__r">空き ' + r + '/' + a.cap + '</span>' : '') +
            '</button></td>';
        }).join('') + '</tr>';
    }).join('');

    wrap.innerHTML = '<table class="pk-tbl"><caption class="sr-only">エリア別の集荷受付状況</caption>' +
                     '<thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  /* --- 依頼フォーム ---------------------------------------------------- */
  function renderForm() {
    var box = document.getElementById('pk-form');
    if (!box) return;

    if (!sel) {
      box.innerHTML = '<p class="pk-empty">表から、集荷を希望する<b>日付とエリア</b>のマスをお選びください。<br>' +
                      'そのままこの場でご依頼いただけます。</p>';
      return;
    }

    var a = AREA[sel.area];
    var opts = CARGO.map(function (c) { return '<option>' + c + '</option>'; }).join('');
    var qty = '';
    for (var i = 1; i <= 20; i++) qty += '<option value="' + i + '">' + i + '</option>';

    box.innerHTML =
      '<p class="pk-form__h">集荷のご依頼</p>' +
      '<dl class="pk-pick">' +
        '<dt>集荷日</dt><dd>' + jpDate(sel.date) + '</dd>' +
        '<dt>エリア</dt><dd>' + a.label + '<span class="note">（締切 ' + a.cutoff + '／残り ' + remain(sel.date, sel.area) + '枠）</span></dd>' +
      '</dl>' +
      '<div class="pk-fields">' +
        '<label>会社名<input type="text" name="company" autocomplete="organization" placeholder="株式会社〇〇"></label>' +
        '<label>ご担当者<input type="text" name="person" autocomplete="name"></label>' +
        '<label>電話番号<input type="tel" name="tel" autocomplete="tel" placeholder="022-000-0000"></label>' +
        '<label>集荷先<input type="text" name="from" placeholder="仙台市〇〇区〇〇"></label>' +
        '<div class="pk-fields__row">' +
          '<label>荷姿<select name="cargo">' + opts + '</select></label>' +
          '<label>数量<select name="qty">' + qty + '</select></label>' +
        '</div>' +
        '<label>ご要望<textarea name="note" rows="2" placeholder="例）午前中の集荷希望／ゲート車でお願いします"></textarea></label>' +
      '</div>' +
      '<p class="pk-error" id="pk-error" role="alert" hidden></p>' +
      '<button type="button" class="btn btn--solid pk-submit" id="pk-submit">この内容で集荷を依頼する</button>' +
      '<p class="note">※デモサイトのため実際の集荷は行われません。入力はこの端末にのみ保存され、' +
      '<a href="admin.html">配車管理画面</a>にそのまま反映されます。</p>';
  }

  function fail(msg) {
    var e = document.getElementById('pk-error');
    if (!e) return;
    e.textContent = msg;
    e.hidden = false;
  }

  function submit() {
    var box = document.getElementById('pk-form');
    var v = function (n) { var el = box.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };

    if (!v('company')) return fail('会社名をご入力ください。');
    if (!/[0-9]{9,}/.test(v('tel').replace(/[^0-9]/g, ''))) return fail('電話番号をご確認ください。');
    if (!v('from')) return fail('集荷先をご入力ください。');

    /* 受付の直前に、もう一度その枠の空きを数え直す（重複受付の防止） */
    if (remain(sel.date, sel.area) <= 0) {
      renderTable();
      renderForm();
      return fail('この枠は、ちょうど満車になりました。別の日付・エリアをお選びください。');
    }

    var list = load();
    var id = 'MU-' + sel.date.replace(/-/g, '').slice(2) + '-' +
             String((hash(sel.date + sel.area + v('company')) % 900) + 100);
    list.push({
      id: id, date: sel.date, area: sel.area,
      company: v('company'), person: v('person'), tel: v('tel'), from: v('from'),
      cargo: v('cargo'), qty: +v('qty'), note: v('note'),
      status: 'new', driver: null, hour: null, created: ymd(today())
    });
    save(list);
    renderTable();

    box.innerHTML =
      '<div class="pk-done">' +
        '<p class="pk-done__h">集荷のご依頼を受け付けました</p>' +
        '<p class="pk-done__id">受付番号 <strong>' + id + '</strong></p>' +
        '<dl class="pk-pick">' +
          '<dt>集荷日</dt><dd>' + jpDate(sel.date) + '</dd>' +
          '<dt>エリア</dt><dd>' + AREA[sel.area].label + '</dd>' +
          '<dt>荷姿</dt><dd>' + v('cargo') + ' ' + v('qty') + '</dd>' +
        '</dl>' +
        '<p class="note">配車センターが担当ドライバーを割り当てます。</p>' +
        '<div class="pk-done__cta">' +
          '<a class="btn btn--accent" href="admin.html">配車管理画面で確認する</a>' +
          '<button type="button" class="btn btn--line" id="pk-again">続けて依頼する</button>' +
        '</div>' +
      '</div>';
  }

  /* --- 初期化 ---------------------------------------------------------- */
  function init() {
    if (!document.getElementById('pk-table')) return;
    renderTable();
    renderForm();

    document.getElementById('pk-table').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.pk-slot') : null;
      if (!b || b.disabled) return;
      sel = { date: b.getAttribute('data-date'), area: b.getAttribute('data-area') };
      document.querySelectorAll('.pk-slot.is-sel').forEach(function (x) { x.classList.remove('is-sel'); });
      b.classList.add('is-sel');
      renderForm();
      document.getElementById('pk-form').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    document.getElementById('pk-form').addEventListener('click', function (e) {
      if (e.target.id === 'pk-submit') submit();
      if (e.target.id === 'pk-again') { sel = null; renderTable(); renderForm(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
