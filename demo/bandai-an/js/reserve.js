/* ばんだい庵 — 予約カレンダー（デモ／バックエンド不要・localStorage）
   1マスに「お食事」と「蕎麦打ち体験」の空きを併記する。 */
(function () {
  'use strict';

  var STORE = 'bandaian_rsv_v1';
  var WINDOW_DAYS = 60;   // 何日先まで受け付けるか
  var DOW = ['日', '月', '火', '水', '木', '金', '土'];

  /* --- 業務ルール --------------------------------------------------- */
  var COURSES = {
    meal: {
      key: 'meal', label: 'お食事', short: '食',
      slots: ['11:00', '12:00', '13:00', '14:00'],
      cap: 12,                 // 1枠あたりの席数
      days: [0, 1, 2, 4, 5, 6],// 水曜(3)定休
      leadDays: 1,             // 前日まで
      maxParty: 8,
      note: '11:00–15:00／水曜定休。蕎麦切れ次第終了します。'
    },
    soba: {
      key: 'soba', label: '蕎麦打ち体験', short: '打',
      slots: ['10:00', '13:30'],
      cap: 6,                  // 1回あたりの定員
      days: [5, 6, 0],         // 金・土・日
      leadDays: 3,             // 仕込みの都合で3日前まで
      maxParty: 6,
      note: '所要約90分・お一人 ¥3,800（打った蕎麦をその場で召し上がれます）。'
    }
  };
  var ORDER = ['meal', 'soba'];

  /* --- 日付ユーティリティ ------------------------------------------- */
  function ymd(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parse(s) {
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function today() {
    var t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }
  function addDays(d, n) {
    var x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }
  function diffDays(a, b) { return Math.round((b - a) / 86400000); }
  function jpDate(s) {
    var d = parse(s);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + DOW[d.getDay()] + '）';
  }

  /* --- 保存領域 ------------------------------------------------------ */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)) || []; }
    catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(STORE, JSON.stringify(list)); } catch (e) {}
  }

  /* --- 既存予約のシード（デモに厚みを出すための擬似データ）-----------
     日付から決定論的に算出するので、同じ日は誰が見ても同じ空き状況になる。 */
  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function seedBooked(date, courseKey, time, cap) {
    var r = (hash(date + '|' + courseKey + '|' + time) % 100) / 100;
    if (r < 0.20) return cap;                            // 満席
    if (r < 0.40) return Math.max(cap - 1, 1);           // 残りわずか
    return Math.round(cap * (0.30 + r * 0.62));          // 3〜9割の入り
  }

  /* --- 空き計算 ------------------------------------------------------ */
  function bookedOf(date, courseKey, time) {
    var c = COURSES[courseKey];
    var n = seedBooked(date, courseKey, time, c.cap);
    load().forEach(function (r) {
      if (r.date === date && r.course === courseKey && r.time === time && !r.cancelled) {
        n += r.party;
      }
    });
    return Math.min(n, c.cap);
  }
  function remainOf(date, courseKey, time) {
    return COURSES[courseKey].cap - bookedOf(date, courseKey, time);
  }
  function isOpenDay(date, courseKey) {
    return COURSES[courseKey].days.indexOf(parse(date).getDay()) !== -1;
  }
  function acceptable(date, courseKey) {
    var d = diffDays(today(), parse(date));
    return d >= COURSES[courseKey].leadDays && d <= WINDOW_DAYS;
  }

  /* 1日の状態: 'closed'（休）/'past'（受付外）/'full'/'few'/'ok' */
  function dayState(date, courseKey) {
    if (!isOpenDay(date, courseKey)) return 'closed';
    if (!acceptable(date, courseKey)) return 'past';
    var c = COURSES[courseKey], total = 0, cap = c.cap * c.slots.length;
    c.slots.forEach(function (t) { total += remainOf(date, courseKey, t); });
    if (total <= 0) return 'full';
    if (total <= Math.max(2, Math.round(cap * 0.2))) return 'few';
    return 'ok';
  }
  var MARK = { ok: '○', few: '△', full: '×', closed: '−', past: '−' };
  var MARK_TEXT = { ok: '空きあり', few: '残りわずか', full: '満席', closed: 'お休み', past: '受付期間外' };

  /* まだ申し込める開始時間（蕎麦打ち体験は、この時間をそのまま枠に出す） */
  function openTimes(date, courseKey) {
    if (!isOpenDay(date, courseKey) || !acceptable(date, courseKey)) return [];
    return COURSES[courseKey].slots.filter(function (t) {
      return remainOf(date, courseKey, t) > 0;
    });
  }

  /* その月に「選べる日」がいくつあるか */
  function openDaysIn(month) {
    var last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(), n = 0;
    for (var i = 1; i <= last; i++) {
      var date = ymd(new Date(month.getFullYear(), month.getMonth(), i));
      var a = dayState(date, 'meal'), b = dayState(date, 'soba');
      if (a === 'ok' || a === 'few' || b === 'ok' || b === 'few') n++;
    }
    return n;
  }

  /* --- カレンダー描画 ------------------------------------------------ */
  var view = null;      // 表示中の月（1日）
  var selected = null;  // 選択中の日付文字列
  var course = 'meal';  // 選択中のコース

  function renderCalendar() {
    var grid = document.getElementById('cal-days');
    var title = document.getElementById('cal-title');
    if (!grid || !title) return;

    title.textContent = view.getFullYear() + '年 ' + (view.getMonth() + 1) + '月';

    var first = new Date(view.getFullYear(), view.getMonth(), 1);
    var last = new Date(view.getFullYear(), view.getMonth() + 1, 0);
    var html = '';
    for (var b = 0; b < first.getDay(); b++) html += '<span class="cal__blank" aria-hidden="true"></span>';

    for (var day = 1; day <= last.getDate(); day++) {
      var d = new Date(view.getFullYear(), view.getMonth(), day);
      var date = ymd(d);
      var sMeal = dayState(date, 'meal');
      var sSoba = dayState(date, 'soba');
      var selectable = (sMeal === 'ok' || sMeal === 'few' || sMeal === 'full' ||
                        sSoba === 'ok' || sSoba === 'few' || sSoba === 'full');
      var cls = 'cal__day';
      if (!selectable) cls += ' is-off';
      if (date === selected) cls += ' is-sel';
      if (d.getDay() === 0) cls += ' is-sun';
      if (d.getDay() === 6) cls += ' is-sat';

      var times = openTimes(date, 'soba');
      var label = (d.getMonth() + 1) + '月' + day + '日 ' + DOW[d.getDay()] + '曜日、' +
                  'お食事 ' + MARK_TEXT[sMeal] + '、' +
                  '蕎麦打ち体験 ' + (times.length ? times.join('と') + ' に空きあり' : '空きなし');

      html += '<button type="button" class="' + cls + '" data-date="' + date + '"' +
              (selectable ? '' : ' disabled') + ' aria-label="' + label + '">' +
              '<span class="cal__num" aria-hidden="true">' + day + '</span>' +
              mealRow(sMeal) + sobaRow(times) +
              '</button>';
    }
    grid.innerHTML = html;
  }
  /* 日付の枠の中に、業態ごとの小さな枠をひとつずつ置く */
  function slotBox(key, tone, value) {
    return '<span class="cal__box cal__box--' + key + ' is-' + tone + '" aria-hidden="true">' +
             '<i class="cal__tag">' + COURSES[key].short + '</i>' +
             '<em class="cal__val">' + value + '</em>' +
           '</span>';
  }
  var TONE = { ok: 'ok', few: 'few', full: 'full', closed: 'none', past: 'none' };
  function mealRow(state) {
    return slotBox('meal', TONE[state], MARK[state]);
  }
  /* 蕎麦打ち体験：枠があれば開始時間をそのまま出し、無ければ × */
  function sobaRow(times) {
    if (!times.length) return slotBox('soba', 'full', '×');
    return slotBox('soba', 'ok', times.map(function (t) {
      return '<b>' + t + '</b>';
    }).join(''));
  }

  /* --- 右パネル（枠の選択〜申込） ------------------------------------ */
  function renderPanel() {
    var p = document.getElementById('rsv-panel');
    if (!p) return;

    if (!selected) {
      p.innerHTML = '<p class="rsv-panel__empty">カレンダーから日付をお選びください。<br>' +
                    '「食」がお食事、「打」が蕎麦打ち体験の空き状況です。</p>';
      return;
    }

    var tabs = ORDER.map(function (k) {
      var st = dayState(selected, k);
      var on = k === course;
      return '<button type="button" class="rsv-tab' + (on ? ' is-on' : '') + '" data-course="' + k + '"' +
             ' aria-pressed="' + on + '">' +
             '<i class="rsv-badge rsv-badge--' + k + '" aria-hidden="true">' + COURSES[k].short + '</i>' +
             '<span>' + COURSES[k].label + '</span>' +
             '<em class="rsv-tab__mk cal__mk--' + st + '">' + MARK[st] + '</em></button>';
    }).join('');

    var c = COURSES[course];
    var st = dayState(selected, course);
    var body;

    if (st === 'closed') {
      body = '<p class="rsv-note rsv-note--stop">' + jpDate(selected) + 'は' + c.label + 'はお休みです。' +
             (course === 'soba' ? '体験は金・土・日のみの開催です。' : '水曜は定休日です。') + '</p>';
    } else if (st === 'past') {
      var lead = c.leadDays;
      body = '<p class="rsv-note rsv-note--stop">' + c.label + 'は' + lead + '日前までのお申し込みとなります。' +
             '（受付は' + WINDOW_DAYS + '日先まで）</p>';
    } else {
      var slots = c.slots.map(function (t) {
        var rem = remainOf(selected, course, t);
        var full = rem <= 0;
        var few = !full && rem <= Math.max(1, Math.round(c.cap * 0.25));
        return '<label class="rsv-slot' + (full ? ' is-full' : '') + '">' +
               '<input type="radio" name="slot" value="' + t + '"' + (full ? ' disabled' : '') + '>' +
               '<span class="rsv-slot__t">' + t + '</span>' +
               '<span class="rsv-slot__r">' + (full ? '満席' : ('残り ' + rem + '席')) + '</span>' +
               '<em class="cal__mk cal__mk--' + (full ? 'full' : (few ? 'few' : 'ok')) + '">' +
               (full ? '×' : (few ? '△' : '○')) + '</em></label>';
      }).join('');

      var opts = '';
      for (var n = 1; n <= c.maxParty; n++) opts += '<option value="' + n + '">' + n + '名</option>';

      body =
        '<p class="rsv-note">' + c.note + '</p>' +
        '<fieldset class="rsv-slots"><legend>時間をお選びください</legend>' + slots + '</fieldset>' +
        '<div class="rsv-fields">' +
          '<label>人数<select name="party">' + opts + '</select></label>' +
          '<label>お名前<input type="text" name="name" autocomplete="name" placeholder="磐梯 太郎"></label>' +
          '<label>電話番号<input type="tel" name="tel" autocomplete="tel" placeholder="090-0000-0000"></label>' +
        '</div>' +
        '<p class="rsv-error" id="rsv-error" role="alert" hidden></p>' +
        '<button type="button" class="btn btn--solid rsv-submit" id="rsv-submit">この内容で予約する</button>' +
        '<p class="note">※デモサイトのため、実際の予約は行われません。ご入力はこの端末にのみ保存されます。</p>';
    }

    p.innerHTML =
      '<p class="rsv-panel__date">' + jpDate(selected) + '</p>' +
      '<div class="rsv-tabs">' + tabs + '</div>' +
      '<div class="rsv-body">' + body + '</div>';
  }

  /* 再描画しても、入力済みのお名前・電話・人数は消さない */
  function restore(v) {
    var p = document.getElementById('rsv-panel');
    var n = p.querySelector('input[name="name"]');
    var t = p.querySelector('input[name="tel"]');
    var s = p.querySelector('select[name="party"]');
    var r = v.slot && p.querySelector('input[name="slot"][value="' + v.slot + '"]');
    if (n) n.value = v.name;
    if (t) t.value = v.tel;
    if (s && s.querySelector('option[value="' + v.party + '"]')) s.value = String(v.party);
    if (r && !r.disabled) r.checked = true;
  }

  /* --- 予約の確定 ---------------------------------------------------- */
  function submit() {
    var p = document.getElementById('rsv-panel');
    /* 再描画で要素が入れ替わるため、書き込む直前に取り直す */
    function fail(msg) {
      var err = document.getElementById('rsv-error');
      if (!err) return;
      err.textContent = msg;
      err.hidden = false;
      err.scrollIntoView({ block: 'nearest' });
    }
    var slot = p.querySelector('input[name="slot"]:checked');
    var name = p.querySelector('input[name="name"]');
    var tel = p.querySelector('input[name="tel"]');
    var party = +p.querySelector('select[name="party"]').value;

    if (!slot) return fail('時間をお選びください。');
    if (!name.value.trim()) return fail('お名前をご入力ください。');
    if (!/[0-9]{9,}/.test(tel.value.replace(/[^0-9]/g, ''))) return fail('電話番号をご確認ください。');

    /* 二重予約の防止：確定の直前にもう一度、残席を数え直す */
    var rem = remainOf(selected, course, slot.value);
    if (rem < party) {
      var keep = { name: name.value, tel: tel.value, party: party, slot: slot.value };
      renderCalendar();
      renderPanel();
      restore(keep);
      return fail(rem <= 0
        ? 'この枠は、ちょうど満席になりました。別の時間をお選びください。'
        : 'この枠の残りは ' + rem + '席です。人数をご調整ください。');
    }

    var id = 'BA-' + String(hash(selected + course + slot.value + name.value + load().length) % 1000000).padStart(6, '0');
    var list = load();
    list.push({
      id: id, date: selected, course: course, time: slot.value,
      party: party, name: name.value.trim(), tel: tel.value.trim(),
      created: ymd(today())
    });
    save(list);

    renderCalendar();
    document.getElementById('rsv-panel').innerHTML =
      '<div class="rsv-done">' +
        '<p class="rsv-done__h">ご予約を承りました</p>' +
        '<p class="rsv-done__id">予約番号 <strong>' + id + '</strong></p>' +
        '<dl class="rsv-done__dl">' +
          '<dt>日付</dt><dd>' + jpDate(selected) + '</dd>' +
          '<dt>内容</dt><dd>' + COURSES[course].label + '</dd>' +
          '<dt>時間</dt><dd>' + slot.value + '</dd>' +
          '<dt>人数</dt><dd>' + party + '名</dd>' +
        '</dl>' +
        '<p class="note">予約番号は、下の「予約の確認・取消」でお使いいただけます。</p>' +
        '<button type="button" class="btn btn--line" id="rsv-again">続けて予約する</button>' +
      '</div>';
  }

  /* --- 予約の確認・取消 ---------------------------------------------- */
  function lookup() {
    var input = document.getElementById('rsv-find');
    var out = document.getElementById('rsv-found');
    if (!input || !out) return;
    var id = input.value.trim().toUpperCase();
    var hit = load().filter(function (r) { return r.id === id && !r.cancelled; })[0];
    if (!hit) {
      out.innerHTML = '<p class="rsv-error">該当する予約が見つかりませんでした。予約番号をご確認ください。</p>';
      return;
    }
    out.innerHTML =
      '<dl class="rsv-done__dl">' +
        '<dt>日付</dt><dd>' + jpDate(hit.date) + '</dd>' +
        '<dt>内容</dt><dd>' + COURSES[hit.course].label + '</dd>' +
        '<dt>時間</dt><dd>' + hit.time + '</dd>' +
        '<dt>人数</dt><dd>' + hit.party + '名</dd>' +
        '<dt>お名前</dt><dd>' + hit.name + ' 様</dd>' +
      '</dl>' +
      '<button type="button" class="btn btn--line" id="rsv-cancel" data-id="' + hit.id + '">この予約を取り消す</button>';
  }
  function cancel(id) {
    var list = load();
    list.forEach(function (r) { if (r.id === id) r.cancelled = true; });
    save(list);
    var out = document.getElementById('rsv-found');
    if (out) out.innerHTML = '<p class="rsv-note">予約番号 ' + id + ' を取り消しました。空き状況に反映しています。</p>';
    renderCalendar();
    renderPanel();
  }

  /* --- 初期化 -------------------------------------------------------- */
  function init() {
    if (!document.getElementById('cal-days')) return;
    var t = today();
    view = new Date(t.getFullYear(), t.getMonth(), 1);
    /* 月末に近いと当月がほぼ受付外になるため、空きのある月から開く */
    if (openDaysIn(view) < 8) view = new Date(t.getFullYear(), t.getMonth() + 1, 1);
    renderCalendar();
    renderPanel();

    document.getElementById('cal-prev').addEventListener('click', function () {
      view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
      renderCalendar();
    });
    document.getElementById('cal-next').addEventListener('click', function () {
      view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
      renderCalendar();
    });

    document.getElementById('cal-days').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.cal__day') : null;
      if (!b || b.disabled) return;
      selected = b.getAttribute('data-date');
      /* 選んだ日にお食事が無ければ、体験の方を開く */
      if (dayState(selected, 'meal') === 'closed' && dayState(selected, 'soba') !== 'closed') course = 'soba';
      renderCalendar();
      renderPanel();
    });

    document.getElementById('rsv-panel').addEventListener('click', function (e) {
      var tab = e.target.closest ? e.target.closest('.rsv-tab') : null;
      if (tab) { course = tab.getAttribute('data-course'); renderPanel(); return; }
      if (e.target.id === 'rsv-submit') { submit(); return; }
      if (e.target.id === 'rsv-again') { renderPanel(); return; }
    });

    var findBtn = document.getElementById('rsv-find-btn');
    if (findBtn) findBtn.addEventListener('click', lookup);
    var found = document.getElementById('rsv-found');
    if (found) found.addEventListener('click', function (e) {
      if (e.target.id === 'rsv-cancel') cancel(e.target.getAttribute('data-id'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
