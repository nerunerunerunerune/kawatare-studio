/* 磐梯サーモン — ご注文シミュレーター（デモ／計算のみ・送信なし）
   選ぶだけで「1回あたり」と「年間」の金額が出る。定期便のおトク額まで見せるのが狙い。 */
(function () {
  'use strict';

  /* --- 商品と料金 -----------------------------------------------------
     金額・運賃はすべて「想定値」です。実在する運送会社の運賃表ではありません。
     実案件では、お客様の契約運賃をそのままここに差し替えて使います。

     slot … 商品が箱の中で占める枠の数。これで箱のサイズが決まる。
            生鮮の通販では、送料は「重さ」より「箱の大きさ」で決まることが多い。 */
  var ITEMS = [
    { key: 'trial', name: 'お試し 柵200g',    price: 1800, note: '1〜2人分', max: 10, slot: 1 },
    { key: 'fillet', name: '半身フィレ 約1kg', price: 5800, note: '人気No.1', max: 6,  slot: 2 },
    { key: 'gift',   name: 'ギフトセット',     price: 6800, note: 'のし対応', max: 6,  slot: 2 }
  ];

  /* 箱のサイズ（枠がいくつまで入るか）と、クール便の加算 */
  var BOXES = [
    { size: 60,  slots: 2, cool: 220 },
    { size: 80,  slots: 4, cool: 330 },
    { size: 100, slots: 8, cool: 550 }
  ];
  var MAX_BOX = BOXES[BOXES.length - 1];

  /* 発送元は福島県磐梯町を想定。地域とサイズで運賃が変わる */
  var AREAS = [
    { key: 'tohoku',   label: '東北',       fee: { 60: 1060, 80: 1310, 100: 1570 } },
    { key: 'kanto',    label: '関東・信越', fee: { 60: 1170, 80: 1420, 100: 1680 } },
    { key: 'chubu',    label: '中部・北陸', fee: { 60: 1280, 80: 1530, 100: 1790 } },
    { key: 'kansai',   label: '関西',       fee: { 60: 1390, 80: 1640, 100: 1900 } },
    { key: 'chugoku',  label: '中国・四国', fee: { 60: 1500, 80: 1750, 100: 2010 } },
    { key: 'kyushu',   label: '九州',       fee: { 60: 1610, 80: 1860, 100: 2120 } },
    { key: 'hokkaido', label: '北海道',     fee: { 60: 1610, 80: 1860, 100: 2120 } },
    { key: 'okinawa',  label: '沖縄',       fee: { 60: 2000, 80: 2600, 100: 3300 } }
  ];

  /* shipRate … 送料の負担率。0=無料、0.5=半額、1=通常 */
  var PLANS = [
    { key: 'once', label: '今回だけ',   times: 1,  off: 0,    shipRate: 1,   perk: '' },
    { key: 'm1',   label: '毎月お届け', times: 12, off: 0.12, shipRate: 0,   perk: '12%オフ・送料無料' },
    { key: 'm2',   label: '隔月お届け', times: 6,  off: 0.10, shipRate: 0.5, perk: '10%オフ・送料半額' },
    { key: 'm3',   label: '3か月ごと',  times: 4,  off: 0.08, shipRate: 1,   perk: '8%オフ' }
  ];

  var FREE_SHIP_OVER = 12000;   // 割引後の商品小計がこの額以上なら送料無料

  /* --- 状態 ------------------------------------------------------------ */
  var qty = { trial: 0, fillet: 1, gift: 0 };   // 初期は人気No.1を1つ
  var area = 'tohoku';
  var plan = 'once';

  function yen(n) { return '¥' + n.toLocaleString('ja-JP'); }
  function planOf(k) { return PLANS.filter(function (p) { return p.key === k; })[0]; }
  function areaOf(k) { return AREAS.filter(function (a) { return a.key === k; })[0]; }

  /* 枠の合計から、箱のサイズと口数を決める */
  function boxOf(slots) {
    if (slots <= 0) return null;
    for (var i = 0; i < BOXES.length; i++) {
      if (slots <= BOXES[i].slots) return { box: BOXES[i], parcels: 1 };
    }
    /* 最大サイズに収まらないぶんは口数を増やす */
    return { box: MAX_BOX, parcels: Math.ceil(slots / MAX_BOX.slots) };
  }

  /* --- 計算 ------------------------------------------------------------ */
  function calc() {
    var p = planOf(plan), a = areaOf(area);
    var sub = 0, count = 0, slots = 0;
    ITEMS.forEach(function (it) {
      sub += it.price * qty[it.key];
      count += qty[it.key];
      slots += it.slot * qty[it.key];
    });

    var discount = Math.round(sub * p.off);
    var afterDiscount = sub - discount;

    var b = boxOf(slots);
    /* 箱代（地域別）＋クール便の加算。口数が増えればそのぶん倍になる */
    var shipBase = b ? (a.fee[b.box.size] + b.box.cool) * b.parcels : 0;

    var freeByAmount = afterDiscount >= FREE_SHIP_OVER;
    var ship = 0;
    var shipReason = '';
    if (count > 0) {
      if (freeByAmount) { ship = 0; shipReason = 'amount'; }
      else if (p.shipRate === 0) { ship = 0; shipReason = 'plan'; }
      else { ship = Math.round(shipBase * p.shipRate / 10) * 10; shipReason = p.shipRate < 1 ? 'half' : 'normal'; }
    }

    var once = afterDiscount + ship;

    /* 「今回だけ」で同じ回数買った場合と比べて、年間でいくら差が出るか */
    var onceShip = (sub >= FREE_SHIP_OVER) ? 0 : shipBase;
    var yearlyIfOnce = (sub + onceShip) * p.times;
    var yearly = once * p.times;

    return {
      count: count, slots: slots, sub: sub, discount: discount, off: p.off,
      box: b ? b.box.size : 0, parcels: b ? b.parcels : 0, cool: b ? b.box.cool * b.parcels : 0,
      shipBase: shipBase, ship: ship, shipReason: shipReason, once: once,
      times: p.times, yearly: yearly, save: Math.max(0, yearlyIfOnce - yearly)
    };
  }

  /* --- 描画 ------------------------------------------------------------ */
  function renderItems() {
    var el = document.getElementById('od-items');
    if (!el) return;
    el.innerHTML = ITEMS.map(function (it) {
      var n = qty[it.key];
      return '<div class="od-item' + (n > 0 ? ' is-on' : '') + '" data-item="' + it.key + '">' +
        '<div class="od-item__info">' +
          '<p class="od-item__n">' + it.name + '<span class="od-item__note">' + it.note + '</span></p>' +
          '<p class="od-item__p">' + yen(it.price) + '<small>税込</small></p>' +
        '</div>' +
        '<div class="od-step" role="group" aria-label="' + it.name + 'の数量">' +
          '<button type="button" class="od-step__b" data-dec="' + it.key + '" aria-label="減らす"' +
            (n <= 0 ? ' disabled' : '') + '>−</button>' +
          '<span class="od-step__n" aria-live="polite">' + n + '</span>' +
          '<button type="button" class="od-step__b" data-inc="' + it.key + '" aria-label="増やす"' +
            (n >= it.max ? ' disabled' : '') + '>＋</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderChoices() {
    var pe = document.getElementById('od-plans');
    if (pe) {
      pe.innerHTML = PLANS.map(function (p) {
        return '<button type="button" class="od-chip' + (p.key === plan ? ' is-on' : '') + '"' +
          ' data-plan="' + p.key + '" aria-pressed="' + (p.key === plan) + '">' + p.label +
          (p.perk ? '<em>' + p.perk + '</em>' : '') + '</button>';
      }).join('');
    }
    var ae = document.getElementById('od-areas');
    if (ae) {
      /* 送料は箱のサイズで変わるので、いま選ばれている数量に対応する額を出す */
      var r = calc();
      var sizeNow = r.box || 60;
      ae.innerHTML = AREAS.map(function (a) {
        return '<button type="button" class="od-chip od-chip--sm' + (a.key === area ? ' is-on' : '') + '"' +
          ' data-area="' + a.key + '" aria-pressed="' + (a.key === area) + '">' + a.label +
          '<em>' + yen(a.fee[sizeNow]) + '〜</em></button>';
      }).join('');
    }
  }

  function renderTotal() {
    var el = document.getElementById('od-total');
    if (!el) return;
    var r = calc();

    if (!r.count) {
      el.innerHTML = '<p class="od-empty">商品の数量を選んでください。<br>選ぶと、その場で合計金額が出ます。</p>';
      updateBar(null);
      return;
    }

    /* 送料が「なぜその額なのか」を見せる。ここが計算機の値打ちになる */
    /* 補足はインラインだと本文とくっついて読めないので、行を分ける */
    var SUB = '<small style="display:block;margin-top:2px">';

    var shipNote = '';
    if (r.shipReason === 'amount') shipNote = SUB + '通常 ' + yen(r.shipBase) + ' → ' + yen(FREE_SHIP_OVER) + '以上のお買い上げで無料</small>';
    else if (r.shipReason === 'plan') shipNote = SUB + '通常 ' + yen(r.shipBase) + ' → 毎月お届けの特典で無料</small>';
    else if (r.shipReason === 'half') shipNote = SUB + '通常 ' + yen(r.shipBase) + ' → 隔月お届けで半額</small>';

    var boxLine = r.box
      ? '<dt>箱のサイズ</dt><dd>' + r.box + 'サイズ' +
        (r.parcels > 1 ? ' × ' + r.parcels + '口' : '') +
        SUB + 'クール便の加算 +' + yen(r.cool) + '</small></dd>'
      : '';

    var rows =
      '<dl class="od-sum">' +
        '<dt>商品小計</dt><dd>' + yen(r.sub) + '</dd>' +
        (r.discount ? '<dt class="is-off">定期便割引（' + Math.round(r.off * 100) + '%）</dt><dd class="is-off">−' + yen(r.discount) + '</dd>' : '') +
        boxLine +
        '<dt>送料</dt><dd>' + (r.ship ? yen(r.ship) : '<span class="od-free">無料</span>') + shipNote + '</dd>' +
      '</dl>';

    var perTime = '<div class="od-big"><p class="od-big__l">' +
      (r.times > 1 ? '1回あたり（税込）' : 'お支払い合計（税込）') +
      '</p><p class="od-big__n">' + yen(r.once) + '</p></div>';

    var yearly = r.times > 1
      ? '<div class="od-year">' +
          '<p class="od-year__l">年間 ' + r.times + '回のお届けで</p>' +
          '<p class="od-year__n">' + yen(r.yearly) + '</p>' +
          (r.save ? '<p class="od-year__save">今回だけの購入より <b>' + yen(r.save) + '</b> おトク</p>' : '') +
        '</div>'
      : '';

    el.innerHTML = rows + perTime + yearly +
      '<button type="button" class="btn btn--buy btn--lg od-go" id="od-go">この内容で注文へ進む（デモ）</button>' +
      '<p class="note">※架空のデモLPです。実際の決済・発送は行いません。</p>';

    updateBar(r);
  }

  /* 追従バーにも合計を出す（スマホでは表が見えなくなるため） */
  function updateBar(r) {
    var bar = document.querySelector('.buybar');
    if (!bar) return;
    if (!r || !r.count) { bar.textContent = '商品を見る・購入する'; return; }
    bar.innerHTML = '<span class="buybar__l">' + (r.times > 1 ? '1回あたり' : '合計') + '</span>' +
                    '<span class="buybar__n">' + yen(r.once) + '</span>' +
                    '<span class="buybar__c">注文へ進む</span>';
    bar.setAttribute('href', '#order');
  }

  function renderAll() { renderItems(); renderChoices(); renderTotal(); }

  /* 描き直したあと、同じボタンにフォーカスを戻す（キーボード操作を切らさない） */
  function refocus(scope, sel) {
    var el = document.querySelector(scope + ' ' + sel);
    if (el && !el.disabled) el.focus();
  }

  /* --- 操作 ------------------------------------------------------------ */
  function init() {
    if (!document.getElementById('od-items')) return;
    renderAll();

    document.getElementById('od-items').addEventListener('click', function (e) {
      var inc = e.target.getAttribute && e.target.getAttribute('data-inc');
      var dec = e.target.getAttribute && e.target.getAttribute('data-dec');
      if (inc) {
        var it = ITEMS.filter(function (x) { return x.key === inc; })[0];
        qty[inc] = Math.min(it.max, qty[inc] + 1);
      } else if (dec) {
        qty[dec] = Math.max(0, qty[dec] - 1);
      } else { return; }
      renderItems();
      /* 数量が変わると箱のサイズが変わり、地域チップに出す送料も変わる */
      renderChoices();
      renderTotal();
      /* 描き直しでフォーカスが飛ぶと、キーボードで数量を続けて変えられない */
      refocus('#od-items', inc ? '[data-inc="' + inc + '"]' : '[data-dec="' + dec + '"]');
    });

    document.getElementById('od-plans').addEventListener('click', function (e) {
      var k = e.target.closest ? e.target.closest('[data-plan]') : null;
      if (!k) return;
      plan = k.getAttribute('data-plan');
      renderChoices();
      renderTotal();
      refocus('#od-plans', '[data-plan="' + plan + '"]');
    });

    document.getElementById('od-areas').addEventListener('click', function (e) {
      var k = e.target.closest ? e.target.closest('[data-area]') : null;
      if (!k) return;
      area = k.getAttribute('data-area');
      renderChoices();
      renderTotal();
      refocus('#od-areas', '[data-area="' + area + '"]');
    });

    document.getElementById('od-total').addEventListener('click', function (e) {
      if (e.target.id !== 'od-go') return;
      var r = calc();
      var lines = ITEMS.filter(function (it) { return qty[it.key] > 0; })
        .map(function (it) { return '<li>' + it.name + ' × ' + qty[it.key] + '</li>'; }).join('');
      this.innerHTML =
        '<div class="od-done">' +
          '<p class="od-done__h">ご注文内容（デモ）</p>' +
          '<ul class="od-done__list">' + lines + '</ul>' +
          '<dl class="od-sum">' +
            '<dt>お届け</dt><dd>' + planOf(plan).label + '</dd>' +
            '<dt>お届け先</dt><dd>' + areaOf(area).label + '</dd>' +
            '<dt>' + (r.times > 1 ? '1回あたり' : '合計') + '</dt><dd><b>' + yen(r.once) + '</b></dd>' +
          '</dl>' +
          '<p class="note">この先に決済画面が入ります。デモのため、ここで止まります。</p>' +
          '<button type="button" class="btn btn--line" id="od-back">内容を選び直す</button>' +
        '</div>';
    });

    document.getElementById('od-total').addEventListener('click', function (e) {
      if (e.target.id === 'od-back') renderTotal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
