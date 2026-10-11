(function () {
  "use strict";

  var STORE_KEY = "gorae-words:v1";
  var LEVELS = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" };
  var DEFAULT_SETTINGS = { front: "ko", roman: true, autoplay: false, shuffle: false, viFirst: true, theme: "auto" };

  var app = document.getElementById("app");
  var toastEl = document.getElementById("toast");

  var meta = null;
  var setCache = {};
  var S = null; // current study session
  var listFilter = "all";
  var saveWarned = false;

  // ---------- Icons ----------
  function svg(path, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || "") + ">" + path + "</svg>";
  }
  var icon = {
    gear: svg('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    back: svg('<path d="M15 18l-6-6 6-6"/>'),
    undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    list: svg('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>'),
    sound: svg('<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>'),
    flip: svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
    left: svg('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
    right: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    x: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  };

  var whaleId = 0;
  function whale(happy) {
    var id = "wg" + whaleId++;
    var mouth = happy
      ? '<path d="M41 64 q6 7 12 0" stroke="#1d4447" stroke-width="2.6" fill="#ff8fa6" stroke-linecap="round"/>'
      : '<path d="M43 65 q4 4 8 0" stroke="#1d4447" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    return '<svg class="whale" viewBox="0 0 124 104" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fd6f2"/><stop offset="1" stop-color="#3fbfae"/></linearGradient></defs>' +
      '<g stroke="#3fcfa9" stroke-width="3.4" stroke-linecap="round" fill="none"><path d="M56 30 V16"/><path d="M56 26 C52 17 45 15 40 17"/><path d="M56 26 C60 17 67 15 72 17"/></g>' +
      '<circle cx="38" cy="15" r="3" fill="#4db5f0"/><circle cx="74" cy="15" r="3" fill="#4db5f0"/>' +
      '<path d="M95 52 C104 44 110 38 116 26 C117 40 112 50 104 58 C112 61 118 68 120 82 C110 74 102 70 94 68 Z" fill="url(#' + id + ')"/>' +
      '<ellipse cx="56" cy="62" rx="44" ry="31" fill="url(#' + id + ')"/>' +
      '<path d="M18 70 Q56 100 94 70 Q56 86 18 70 Z" fill="#ffffff" opacity=".9"/>' +
      '<circle cx="40" cy="54" r="4.6" fill="#1d4447"/><circle cx="41.8" cy="52.3" r="1.6" fill="#fff"/>' +
      '<circle cx="60" cy="54" r="4.6" fill="#1d4447"/><circle cx="61.8" cy="52.3" r="1.6" fill="#fff"/>' +
      '<ellipse cx="32" cy="63" rx="5.5" ry="3.4" fill="#ffb9c7"/><ellipse cx="68" cy="63" rx="5.5" ry="3.4" fill="#ffb9c7"/>' +
      mouth + "</svg>";
  }

  // ---------- Helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return Number(n).toLocaleString("en-US"); }
  function pct(a, b) { return b ? Math.round((a / b) * 1000) / 10 : 0; }
  function pad3(n) { return ("00" + n).slice(-3); }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function setLen(n) { return Math.max(0, Math.min(meta.setSize, meta.total - (n - 1) * meta.setSize)); }
  function setRange(n) { var a = (n - 1) * meta.setSize + 1; return fmt(a) + "–" + fmt(a + setLen(n) - 1); }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }

  // Wrap the word (or its verb stem) in the example sentence with <mark>.
  function highlight(ex, w) {
    var stems = [];
    if (w.length >= 2 && w.slice(-1) === "다") {
      var s = w.slice(0, -1);
      stems.push(s);
      if (s.length >= 2) stems.push(s.slice(0, -1));
    } else {
      stems.push(w);
    }
    var parts = ex.split(/(\s+)/);
    for (var k = 0; k < stems.length; k++) {
      var st = stems[k];
      var idx = -1;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i].replace(/^['"‘“(]+/, "");
        if (p.indexOf(st) === 0 || (st.length >= 2 && p.indexOf(st) > 0)) { idx = i; break; }
      }
      if (idx >= 0) {
        return parts.map(function (p, i) {
          if (i !== idx) return esc(p);
          var m = p.match(/^(['"‘“(]*)(.*?)([.,!?…'"’”)\]~]*)$/);
          return esc(m[1]) + "<mark>" + esc(m[2]) + "</mark>" + esc(m[3]);
        }).join("");
      }
    }
    return esc(ex);
  }

  // ---------- Storage ----------
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (raw && typeof raw === "object") {
        return {
          progress: raw.progress && typeof raw.progress === "object" ? raw.progress : {},
          settings: Object.assign({}, DEFAULT_SETTINGS, raw.settings || {}),
          last: raw.last || 1,
        };
      }
    } catch (e) { /* fall through to a fresh store */ }
    return { progress: {}, settings: Object.assign({}, DEFAULT_SETTINGS), last: 1 };
  }
  var store = load();

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {
      if (!saveWarned) { saveWarned = true; toast("This browser won't let me save progress (private mode?)"); }
    }
  }
  function setProgress(n) { return store.progress[n] || (store.progress[n] = {}); }
  function setCounts(n) {
    var p = store.progress[n] || {};
    var k = 0, l = 0;
    for (var w in p) { if (p[w] === 1) k++; else if (p[w] === 0) l++; }
    return { known: k, learning: l };
  }

  function applyTheme() {
    var t = store.settings.theme;
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  applyTheme();

  // ---------- Data ----------
  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  }
  function getMeta() {
    if (meta) return Promise.resolve(meta);
    return getJSON("data/meta.json").then(function (m) { meta = m; return m; });
  }
  function getSet(n) {
    if (!setCache[n]) {
      setCache[n] = getJSON("data/sets/" + pad3(n) + ".json").catch(function (e) { delete setCache[n]; throw e; });
    }
    return setCache[n];
  }

  // ---------- Speech ----------
  var koVoice = null, voicesLoaded = false, voiceWarned = false;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    var vs = window.speechSynthesis.getVoices();
    if (!vs.length) return;
    voicesLoaded = true;
    var ko = vs.filter(function (v) { return /^ko/i.test(v.lang); });
    koVoice = ko.filter(function (v) { return /natural|online|google|premium|enhanced/i.test(v.name); })[0] || ko[0] || null;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }
  function say(text) {
    if (!("speechSynthesis" in window)) { toast("Audio isn't supported in this browser"); return; }
    pickVoice();
    var synth = window.speechSynthesis;
    synth.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    if (koVoice) u.voice = koVoice;
    u.rate = 0.85;
    synth.speak(u);
    if (voicesLoaded && !koVoice && !voiceWarned) {
      voiceWarned = true;
      toast("No Korean voice on this device — add one in your system's speech settings");
    }
  }

  // ---------- Router ----------
  function go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  // Each navigation gets an id; async work from an older navigation must not
  // draw over a newer page.
  var routeId = 0;
  function isStale(id) { return id !== routeId; }

  function route() {
    closeModal();
    var id = ++routeId;
    S = null;
    var parts = location.hash.replace(/^#\/?/, "").split("/");
    getMeta().then(function () {
      if (isStale(id)) return;
      var n = parseInt(parts[1], 10);
      if (parts[0] === "set" && n >= 1 && n <= meta.sets) {
        if (parts[2] === "list") return renderList(n, id);
        return startStudy(n, parts[2] || "auto", id);
      }
      renderHome();
    }).catch(function (e) {
      if (isStale(id)) return;
      console.error(e);
      S = null;
      app.innerHTML = '<div class="loading">' + whale() +
        "Couldn't load the word list." +
        '<p style="font-weight:600">If you opened <code>index.html</code> straight from your computer, start a local server instead (see README).</p>' +
        '<button class="btn mint" data-act="reload">Try again</button></div>';
    });
  }
  window.addEventListener("hashchange", route);

  // ---------- Home ----------
  function ring(k, l, size) {
    var C = 2 * Math.PI * 19;
    var kk = (C * k) / size, ll = (C * l) / size;
    return '<svg class="ring" viewBox="0 0 46 46" aria-hidden="true"><g transform="rotate(-90 23 23)">' +
      '<circle class="track" cx="23" cy="23" r="19"/>' +
      (l ? '<circle class="lrn" cx="23" cy="23" r="19" stroke-dasharray="' + ll + " " + C + '" stroke-dashoffset="' + -kk + '"/>' : "") +
      (k ? '<circle class="val" cx="23" cy="23" r="19" stroke-dasharray="' + kk + " " + C + '"/>' : "") +
      '</g><text x="23" y="27" text-anchor="middle">' + k + "</text></svg>";
  }

  function continueSet(counts) {
    var last = store.last;
    if (last >= 1 && last <= meta.sets && counts[last].known < setLen(last)) return last;
    for (var n = 1; n <= meta.sets; n++) if (counts[n].known < setLen(n)) return n;
    return 1;
  }

  function renderHome() {
    document.title = "Gorae Words · 7,000 Korean flashcards";
    var total = meta.total, perCh = 20;
    var counts = [], known = 0, learning = 0;
    for (var n = 1; n <= meta.sets; n++) {
      counts[n] = setCounts(n);
      known += counts[n].known;
      learning += counts[n].learning;
    }
    var cont = continueSet(counts);
    var html =
      '<header class="top"><div class="brand">' + whale() +
      '<div><h1>고래 단어장</h1><p>Gorae Words · ' + fmt(total) + ' most common Korean words</p></div></div>' +
      '<button class="icon-btn" data-act="settings" aria-label="Settings">' + icon.gear + "</button></header>" +
      '<section class="hero"><div><h2>Your progress</h2>' +
      '<div class="big">' + fmt(known) + " <small>/ " + fmt(total) + " words</small></div>" +
      '<div class="bar" role="img" aria-label="' + fmt(known) + " learned, " + fmt(learning) + ' still learning">' +
      '<i class="known" style="width:' + pct(known, total) + '%"></i><i class="learning" style="width:' + pct(learning, total) + '%"></i></div>' +
      '<div class="stats"><span><i class="dot known"></i>' + fmt(known) + " got it</span>" +
      '<span><i class="dot learning"></i>' + fmt(learning) + " not yet</span>" +
      '<span><i class="dot new"></i>' + fmt(total - known - learning) + " new</span></div></div>" +
      '<a class="btn mint" href="#/set/' + cont + '">' + (known + learning ? "Continue" : "Start") + " · Set " + cont + " " + icon.right + "</a></section>";

    for (var c = 0; c * perCh < meta.sets; c++) {
      var first = c * perCh + 1, last = Math.min(meta.sets, first + perCh - 1);
      var chKnown = 0, chSize = 0;
      for (var m = first; m <= last; m++) { chKnown += counts[m].known; chSize += setLen(m); }
      var a = (first - 1) * meta.setSize + 1;
      html += '<details class="chapter"' + (cont >= first && cont <= last ? " open" : "") + ">" +
        '<summary><span class="ch-title">Words ' + fmt(a) + "–" + fmt(a + chSize - 1) + "</span>" +
        '<span class="ch-meta"><span>' + fmt(chKnown) + " / " + fmt(chSize) + '</span><span class="mini-bar"><i style="width:' + pct(chKnown, chSize) + '%"></i></span><span class="caret">▶</span></span></summary>' +
        '<div class="sets">';
      for (var t = first; t <= last; t++) {
        var size = setLen(t), ct = counts[t];
        html += '<a class="set-tile' + (ct.known === size ? " done" : "") + (t === cont ? " current" : "") + '" href="#/set/' + t + '" aria-label="Set ' + t + ", " + ct.known + " of " + size + ' learned">' +
          ring(ct.known, ct.learning, size) +
          '<div><div class="s-name">Set ' + t + '</div><div class="s-range">' + setRange(t) + '</div><div class="s-first" lang="ko">' + esc(meta.firstWords[t - 1] || "") + " …</div></div></a>";
      }
      html += "</div></details>";
    }
    html += '<footer class="foot">Words ranked by how often they appear in Korean videos, shows and books.<br>' +
      'Meanings and examples from the National Institute of Korean Language dictionary. <button data-act="about">About &amp; credits</button></footer>';
    app.innerHTML = html;
  }

  // ---------- Study ----------
  function startStudy(n, mode, id) {
    app.innerHTML = '<div class="loading">' + whale() + "Loading Set " + n + "…</div>";
    return getSet(n).then(function (cards) {
      if (isStale(id)) return;
      if (n < meta.sets) getSet(n + 1).catch(function () {});
      store.last = n;
      save();
      var prog = setProgress(n);
      var all = cards.map(function (c, i) { return { c: c, pos: (n - 1) * meta.setSize + i + 1 }; });
      var deck = all;
      if (mode === "learning") {
        deck = all.filter(function (d) { return prog[d.c.w] === 0; });
      } else if (mode === "auto") {
        deck = all.filter(function (d) { return prog[d.c.w] !== 1; });
      }
      if (!deck.length) { deck = all; mode = "all"; }
      if (store.settings.shuffle) deck = shuffle(deck.slice());
      S = { n: n, mode: mode, deck: deck, i: 0, history: [], known: 0, learning: 0, busy: false };
      renderStudy();
    });
  }

  function modeLabel(mode) {
    return { auto: "words to learn", learning: "review: not yet", all: "all words" }[mode] || "";
  }

  function renderStudy() {
    document.title = "Set " + S.n + " · Gorae Words";
    app.innerHTML =
      '<section class="study"><header class="study-top">' +
      '<a class="icon-btn" href="#/" aria-label="Back to all sets">' + icon.back + "</a>" +
      '<div class="title"><b>Set ' + S.n + "</b><small>" + setRange(S.n) + " · " + modeLabel(S.mode) + "</small></div>" +
      '<button class="icon-btn" data-act="undo" aria-label="Undo last swipe">' + icon.undo + "</button>" +
      '<a class="icon-btn" href="#/set/' + S.n + '/list" aria-label="Word list">' + icon.list + "</a>" +
      '<button class="icon-btn" data-act="settings" aria-label="Settings">' + icon.gear + "</button></header>" +
      '<div id="stage">' +
      '<div class="round"><div class="bar"><i class="known" id="bk"></i><i class="learning" id="bl"></i></div>' +
      '<div class="counts"><span class="c-learn">↺ <span id="cl">0</span> not yet</span><span id="cpos"></span><span class="c-know"><span id="ck">0</span> got it ✓</span></div></div>' +
      '<div class="deck" id="deck"></div>' +
      '<div class="actions">' +
      '<button class="btn sky" data-act="learn">' + icon.left + " Not yet</button>" +
      '<button class="btn flip" data-act="flip" aria-label="Flip card">' + icon.flip + "</button>" +
      '<button class="btn mint" data-act="know">Got it ' + icon.right + "</button></div>" +
      '<p class="hint">Swipe right if you know it, left if not · tap the card to flip' +
      '<span class="kbd-hint"> · <span class="kbd">←</span> <span class="kbd">→</span> <span class="kbd">Space</span> flip <span class="kbd">Z</span> undo</span></p>' +
      "</div></section>";
    renderDeck(true);
  }

  function updateRound() {
    var n = S.deck.length;
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    var bk = document.getElementById("bk"), bl = document.getElementById("bl");
    if (bk) bk.style.width = pct(S.known, n) + "%";
    if (bl) bl.style.width = pct(S.learning, n) + "%";
    set("ck", S.known);
    set("cl", S.learning);
    set("cpos", Math.min(S.i + 1, n) + " / " + n);
    var u = app.querySelector('[data-act="undo"]');
    if (u) u.disabled = !S.history.length;
  }

  function renderDeck(first) {
    if (S.i >= S.deck.length) return renderDone();
    var deckEl = document.getElementById("deck");
    var cur = S.deck[S.i], nxt = S.deck[S.i + 1];
    deckEl.innerHTML = (nxt ? cardHtml(nxt, "next") : "") + cardHtml(cur, "current" + (first ? "" : " enter"));
    attachDrag(deckEl.querySelector(".card.current"));
    updateRound();
    if (store.settings.autoplay) say(cur.c.w);
  }

  function firstLang(m) { return store.settings.viFirst ? m.vi : m.en; }
  function secondLang(m) { return store.settings.viFirst ? m.en : m.vi; }

  function langLines(m) {
    var vi = '<div class="line vi"><span class="flag">VI</span><span class="t' + (m.vi.length > 48 ? " long" : "") + '" lang="vi">' + esc(m.vi) + "</span></div>";
    var en = '<div class="line en"><span class="flag en">EN</span><span class="t' + (m.en.length > 48 ? " long" : "") + '" lang="en">' + esc(m.en) + "</span></div>";
    return store.settings.viFirst ? vi + en : en + vi;
  }

  function cardHtml(d, cls) {
    var c = d.c, m0 = c.m[0], st = store.settings;
    var lv = c.lv ? '<span class="chip lv' + c.lv + '">' + LEVELS[c.lv] + "</span>" : "";
    var ai = c.ai ? '<span class="chip ai" title="Meaning written by AI, not from the dictionary">AI</span>' : "";
    var front;
    if (st.front === "meaning") {
      front = '<div class="meaning-front">' + (m0.p ? '<div class="pos"><span class="chip">' + esc(m0.p) + "</span></div>" : "") +
        '<div class="vi">' + esc(firstLang(m0)) + '</div><div class="en">' + esc(secondLang(m0)) + "</div></div>";
    } else {
      front = '<div class="word' + (c.w.length > 4 ? " long" : "") + '" lang="ko">' + esc(c.w) + "</div>" +
        (st.roman ? '<div class="roman">' + esc(window.romanize(c.pr || c.w, c.w)) + "</div>" : "") +
        '<button class="speak" data-say="' + esc(c.w) + '" aria-label="Play pronunciation">' + icon.sound + "</button>";
    }
    return '<div class="card ' + cls + '">' +
      '<div class="stamp know">GOT IT</div><div class="stamp learn">NOT YET</div>' +
      '<div class="inner">' +
      '<div class="face front"><div class="meta-row"><span class="num">#' + fmt(d.pos) + '</span><span class="chips">' + lv + ai + "</span></div>" +
      front + '<div class="tap-hint">TAP TO FLIP</div></div>' +
      '<div class="face back">' + backHtml(c) + "</div>" +
      "</div></div>";
  }

  function backHtml(c) {
    var st = store.settings, m0 = c.m[0];
    var chips = [
      m0.p ? '<span class="chip">' + esc(m0.p) + "</span>" : "",
      m0.h ? '<span class="chip hanja" lang="zh-Hant" title="Hanja (Chinese characters)">' + esc(m0.h) + "</span>" : "",
      c.lv ? '<span class="chip lv' + c.lv + '">' + LEVELS[c.lv] + "</span>" : "",
    ].join("");
    var defs = m0.dv || m0.d
      ? '<details class="defs"><summary>+ Definition</summary>' +
        (m0.dv ? '<p lang="vi"><b>VI</b> ' + esc(m0.dv) + "</p>" : "") +
        (m0.d ? '<p lang="en"><b>EN</b> ' + esc(m0.d) + "</p>" : "") + "</details>"
      : "";
    var ex = m0.x
      ? '<div class="example"><p lang="ko"><span class="lbl">EXAMPLE</span>' + highlight(m0.x, c.w) + "</p>" +
        '<button class="speak sm" data-say="' + esc(m0.x) + '" aria-label="Play example sentence">' + icon.sound + "</button></div>"
      : "";
    var alts = c.m.slice(1).map(function (m) {
      return '<div class="alt"><span class="pos">' + esc(m.p || "") + (m.h ? " " + esc(m.h) : "") + "</span> " +
        '<span class="vi" lang="vi">' + esc(m.vi) + '</span> · <span class="en">' + esc(m.en) + "</span></div>";
    }).join("");
    var sub = (st.roman ? '<span class="r">' + esc(window.romanize(c.pr || c.w, c.w)) + "</span>" : "") +
      (c.pr ? '<span class="pr" lang="ko" title="Pronounced">[' + esc(c.pr) + "]</span>" : "");
    return '<div class="back-head"><div class="bh-text"><span class="w" lang="ko">' + esc(c.w) + "</span>" +
      (sub ? '<div class="bh-sub">' + sub + "</div>" : "") + "</div>" +
      '<button class="speak" data-say="' + esc(c.w) + '" aria-label="Play pronunciation">' + icon.sound + "</button></div>" +
      (chips ? '<div class="chips">' + chips + "</div>" : "") +
      '<div class="mean">' + langLines(m0) + "</div>" + defs + ex +
      (alts ? '<div class="also"><span class="lbl">ALSO MEANS</span>' + alts + "</div>" : "") +
      (c.ai ? '<div class="ai-note">✦ Meaning and example written by AI, not from the dictionary.</div>' : "");
  }

  function attachDrag(el) {
    var sx = 0, sy = 0, dx = 0, dy = 0, t0 = 0, pid = null, moved = false;
    var stK = el.querySelector(".stamp.know"), stL = el.querySelector(".stamp.learn");

    function springBack() {
      el.style.transition = "transform .3s cubic-bezier(.3,1.5,.5,1)";
      el.style.transform = "";
      stK.style.opacity = stL.style.opacity = 0;
    }
    el.addEventListener("pointerdown", function (e) {
      if (S.busy || (e.button !== undefined && e.button !== 0)) return;
      if (e.target.closest("button, a, summary, input")) return;
      pid = e.pointerId; sx = e.clientX; sy = e.clientY; dx = dy = 0; moved = false;
      t0 = performance.now();
      el.style.transition = "none";
      try { el.setPointerCapture(pid); } catch (err) { /* older browsers */ }
    });
    el.addEventListener("pointermove", function (e) {
      if (e.pointerId !== pid) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 7) moved = true;
      if (!moved) return;
      el.style.transform = "translate(" + dx + "px," + dy * 0.2 + "px) rotate(" + dx / 16 + "deg)";
      var a = Math.min(1, Math.abs(dx) / 90);
      stK.style.opacity = dx > 0 ? a : 0;
      stL.style.opacity = dx < 0 ? a : 0;
    });
    el.addEventListener("pointerup", function (e) {
      if (e.pointerId !== pid) return;
      pid = null;
      var dt = performance.now() - t0;
      if (!moved) { if (dt < 600) flip(); return; }
      var v = Math.abs(dx) / Math.max(dt, 1);
      if (Math.abs(dx) > 100 || (Math.abs(dx) > 40 && v > 0.5)) decide(dx > 0 ? 1 : -1, dy * 0.2);
      else springBack();
    });
    el.addEventListener("pointercancel", function (e) {
      if (e.pointerId !== pid) return;
      pid = null;
      springBack();
    });
  }

  function currentCardEl() { return document.querySelector("#deck .card.current"); }

  function flip() {
    var el = currentCardEl();
    if (el) el.classList.toggle("flipped");
  }

  function decide(dir, y) {
    if (!S || S.busy || S.i >= S.deck.length) return;
    S.busy = true;
    var el = currentCardEl();
    var d = S.deck[S.i];
    var prog = setProgress(S.n);
    S.history.push({ w: d.c.w, prev: prog[d.c.w], dir: dir });
    prog[d.c.w] = dir > 0 ? 1 : 0;
    if (dir > 0) S.known++; else S.learning++;
    save();
    if (el) {
      var stamp = el.querySelector(dir > 0 ? ".stamp.know" : ".stamp.learn");
      if (stamp) stamp.style.opacity = 1;
      el.style.transition = "transform .3s ease-in, opacity .3s ease-in";
      el.style.transform = "translate(" + dir * (window.innerWidth * 0.8 + 240) + "px," + (y || 0) + "px) rotate(" + dir * 24 + "deg)";
      el.style.opacity = "0";
    }
    setTimeout(function () {
      if (!S) return;
      S.i++;
      S.busy = false;
      renderDeck(false);
    }, el ? 220 : 0);
  }

  function undo() {
    if (!S || S.busy || !S.history.length) return;
    var h = S.history.pop();
    var prog = setProgress(S.n);
    if (h.prev === undefined) delete prog[h.w]; else prog[h.w] = h.prev;
    if (h.dir > 0) S.known--; else S.learning--;
    save();
    S.i--;
    if (document.getElementById("deck")) renderDeck(false);
    else renderStudy();
  }

  function renderDone() {
    var c = setCounts(S.n), size = setLen(S.n);
    var all = c.known === size;
    var stage = document.getElementById("stage");
    stage.innerHTML =
      '<section class="done">' + whale(true) +
      "<h2>" + (all ? "Set " + S.n + " complete!" : "Round finished!") + "</h2>" +
      "<p>" + (all ? "You know all " + size + " words in this set. 잘했어요!" : c.known + " of " + size + " words in Set " + S.n + " marked “got it”.") + "</p>" +
      '<div class="tally"><div class="k"><b>' + S.known + '</b>got it</div><div class="l"><b>' + S.learning + "</b>not yet</div></div>" +
      '<div class="btns">' +
      (c.learning ? '<button class="btn sky block" data-go="#/set/' + S.n + '/learning">Review ' + c.learning + " “not yet” word" + (c.learning > 1 ? "s" : "") + "</button>" : "") +
      (S.n < meta.sets ? '<a class="btn mint block" href="#/set/' + (S.n + 1) + '">Next: Set ' + (S.n + 1) + " " + icon.right + "</a>" : "") +
      '<button class="btn block" data-go="#/set/' + S.n + '/all">Study all ' + size + " again</button>" +
      '<a class="btn ghost block" href="#/">Back to all sets</a></div></section>';
    var u = app.querySelector('[data-act="undo"]');
    if (u) u.disabled = !S.history.length;
    if (all && S.known) confetti();
  }

  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var box = document.createElement("div");
    box.className = "confetti";
    var colors = ["#3fcfa9", "#4db5f0", "#29a7a8", "#ffb9c7", "#9be8d2", "#8fd3fa"];
    for (var i = 0; i < 64; i++) {
      var p = document.createElement("i");
      if (i % 5 === 0) { p.className = "h"; p.textContent = ["♥", "✿", "★"][i % 3]; p.style.color = colors[i % colors.length]; }
      else p.style.background = colors[i % colors.length];
      p.style.left = Math.random() * 100 + "vw";
      p.style.animationDelay = Math.random() * 0.7 + "s";
      p.style.animationDuration = 1.4 + Math.random() * 1.3 + "s";
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 3800);
  }

  // ---------- List ----------
  var STATUS = { 1: ["known", "Got it"], 0: ["learning", "Not yet"] };

  function renderList(n, id) {
    if (id === undefined) id = routeId;
    if (!setCache[n]) app.innerHTML = '<div class="loading">' + whale() + "Loading…</div>";
    return getSet(n).then(function (cards) {
      if (isStale(id)) return;
      var prog = setProgress(n);
      var filters = [["all", "All"], ["known", "Got it"], ["learning", "Not yet"], ["new", "New"]];
      var rows = cards.map(function (c, i) {
        var s = prog[c.w];
        var key = s === 1 ? "known" : s === 0 ? "learning" : "new";
        if (listFilter !== "all" && listFilter !== key) return "";
        var m = c.m[0];
        return '<li class="word-row"><span class="n">#' + fmt((n - 1) * meta.setSize + i + 1) + "</span>" +
          '<div><span class="w" lang="ko">' + esc(c.w) + '</span><span class="m"><b lang="vi">' + esc(m.vi) + "</b> · " + esc(m.en) + "</span></div>" +
          '<button class="status-btn ' + key + '" data-toggle="' + esc(c.w) + '" aria-label="Change status of ' + esc(c.w) + '">' +
          (STATUS[s] ? STATUS[s][1] : "New") + "</button></li>";
      }).join("");
      document.title = "Set " + n + " words · Gorae Words";
      app.innerHTML =
        '<header class="study-top"><a class="icon-btn" href="#/" aria-label="Back to all sets">' + icon.back + "</a>" +
        '<div class="title"><b>Set ' + n + "</b><small>" + setRange(n) + " · word list</small></div>" +
        '<a class="btn mint small" href="#/set/' + n + '">Study</a></header>' +
        '<div class="list-head"><div class="seg" role="group" aria-label="Filter">' +
        filters.map(function (f) { return '<button data-filter="' + f[0] + '" aria-pressed="' + (listFilter === f[0]) + '">' + f[1] + "</button>"; }).join("") +
        "</div></div>" +
        '<ul class="word-list" data-set="' + n + '">' + (rows || '<li class="loading" style="padding:30px 0">No words here yet.</li>') + "</ul>" +
        '<p class="hint">Tap a status to change it: New → Got it → Not yet.</p>';
    });
  }

  function toggleStatus(btn) {
    var n = parseInt(btn.closest(".word-list").dataset.set, 10);
    var w = btn.dataset.toggle;
    var prog = setProgress(n);
    var s = prog[w];
    if (s === undefined) prog[w] = 1;
    else if (s === 1) prog[w] = 0;
    else delete prog[w];
    save();
    var key = prog[w] === 1 ? "known" : prog[w] === 0 ? "learning" : "new";
    btn.className = "status-btn " + key;
    btn.textContent = STATUS[prog[w]] ? STATUS[prog[w]][1] : "New";
  }

  // ---------- Modals ----------
  function openModal(html) {
    closeModal();
    var bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + "</div>";
    document.body.appendChild(bg);
    var f = bg.querySelector("button, input");
    if (f) f.focus();
  }
  function closeModal() {
    var m = document.querySelector(".modal-bg");
    if (m) m.remove();
  }

  function seg(key, options) {
    var cur = String(store.settings[key]);
    return '<div class="seg" role="group">' + options.map(function (o) {
      return '<button data-setting="' + key + '" data-value="' + o[0] + '" aria-pressed="' + (cur === String(o[0])) + '">' + o[1] + "</button>";
    }).join("") + "</div>";
  }
  function sw(key) {
    return '<label class="switch"><input type="checkbox" data-switch="' + key + '"' + (store.settings[key] ? " checked" : "") + "><span></span></label>";
  }

  function openSettings() {
    openModal(
      '<h2>Settings <button class="icon-btn" data-act="close" aria-label="Close">' + icon.x + "</button></h2>" +
      "<h3>Cards</h3>" +
      '<div class="opt"><div>Card front<small>What you see before flipping</small></div>' + seg("front", [["ko", "한국어"], ["meaning", "Meaning"]]) + "</div>" +
      '<div class="opt"><div>Meaning order</div>' + seg("viFirst", [["true", "Tiếng Việt"], ["false", "English"]]) + "</div>" +
      '<div class="opt"><div>Romanization<small>e.g. 없다 → eopda</small></div>' + sw("roman") + "</div>" +
      '<div class="opt"><div>Auto-play audio<small>Say each word when it appears</small></div>' + sw("autoplay") + "</div>" +
      '<div class="opt"><div>Shuffle cards<small>Applies when you open a set</small></div>' + sw("shuffle") + "</div>" +
      "<h3>Look</h3>" +
      '<div class="opt"><div>Theme</div>' + seg("theme", [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]]) + "</div>" +
      "<h3>Progress</h3>" +
      "<p>Your progress is saved in this browser only. Export a backup to move it to another phone or computer.</p>" +
      '<div class="row-btns"><button class="btn small" data-act="export">Export backup</button>' +
      '<button class="btn small" data-act="import">Import backup</button>' +
      '<button class="btn small ghost" data-act="reset">Reset all</button></div>' +
      '<input type="file" accept="application/json,.json" id="importFile" hidden>' +
      '<h3>About</h3><p><button class="btn small ghost" data-act="about">About &amp; credits</button></p>'
    );
  }

  function openAbout() {
    openModal(
      '<h2>About <button class="icon-btn" data-act="close" aria-label="Close">' + icon.x + "</button></h2>" +
      "<p><b>Gorae Words (고래 단어장)</b> has " + fmt(meta ? meta.total : 7000) + " Korean words in sets of 50, ordered from most to least common.</p>" +
      "<h3>How to study</h3>" +
      "<p>Tap a card to flip it. Swipe <b>right</b> (or press →) if you know the word, <b>left</b> (←) if you don't yet. " +
      "Opening a set again shows only the words you haven't marked “got it”.</p>" +
      "<h3>Where the words come from</h3>" +
      '<p><b>Ranking:</b> word frequency list from <a href="https://kimchi-reader.app/explore/freq/words" target="_blank" rel="noopener">Kimchi Reader</a>, based on Korean YouTube videos, TV shows and books. Proper nouns, slang fragments and narrow jargon were left out.</p>' +
      '<p><b>Meanings &amp; examples:</b> <a href="https://krdict.korean.go.kr" target="_blank" rel="noopener">한국어기초사전 (Korean Learners\' Dictionary)</a> by the National Institute of Korean Language, licensed ' +
      '<a href="https://creativecommons.org/licenses/by-sa/2.0/kr/" target="_blank" rel="noopener">CC BY-SA 2.0 KR</a>. The word data on this site is shared under the same license. ' +
      "Homonyms are ordered using NIKL's 한국어 학습용 어휘 목록.</p>" +
      "<p><b>AI-written cards:</b> a few hundred common words (new loanwords and slang like 맛집, 알바, 헐) aren't in the dictionary. Their meanings and examples were written by AI and are marked <span class=\"chip ai\">AI</span>.</p>" +
      "<p><b>Audio</b> uses your device's built-in Korean voice.</p>"
    );
  }

  function exportBackup() {
    var data = JSON.stringify({ app: "gorae-words", version: 1, exported: new Date().toISOString(), progress: store.progress, settings: store.settings }, null, 1);
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = "gorae-words-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast("Backup downloaded");
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var d = JSON.parse(reader.result);
        if (!d || d.app !== "gorae-words" || typeof d.progress !== "object") throw new Error("bad file");
        if (!window.confirm("Replace your current progress with this backup?")) return;
        store.progress = d.progress;
        store.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
        save();
        applyTheme();
        toast("Backup restored");
        route();
      } catch (e) {
        toast("That file isn't a Gorae Words backup");
      }
    };
    reader.readAsText(file);
  }

  function changeSetting(key, value) {
    store.settings[key] = value;
    save();
    if (key === "theme") applyTheme();
    // Redraw the open card so front/romanization/order changes show up right away.
    if (S && document.getElementById("deck") && ["front", "roman", "viFirst"].indexOf(key) >= 0) renderDeck(true);
  }

  // ---------- Events ----------
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act],[data-say],[data-go],[data-toggle],[data-filter],[data-setting]");
    if (!t) {
      if (e.target.classList && e.target.classList.contains("modal-bg")) closeModal();
      return;
    }
    if (t.dataset.say) { say(t.dataset.say); return; }
    if (t.dataset.go) { go(t.dataset.go); return; }
    if (t.dataset.toggle) { toggleStatus(t); return; }
    if (t.dataset.filter) {
      listFilter = t.dataset.filter;
      var ul = document.querySelector(".word-list");
      if (ul) renderList(parseInt(ul.dataset.set, 10));
      return;
    }
    if (t.dataset.setting) {
      var v = t.dataset.value;
      changeSetting(t.dataset.setting, v === "true" ? true : v === "false" ? false : v);
      t.parentNode.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b === t)); });
      return;
    }
    switch (t.dataset.act) {
      case "settings": openSettings(); break;
      case "about": openAbout(); break;
      case "close": closeModal(); break;
      case "flip": flip(); break;
      case "know": decide(1); break;
      case "learn": decide(-1); break;
      case "undo": undo(); break;
      case "reload": location.reload(); break;
      case "export": exportBackup(); break;
      case "import": document.getElementById("importFile").click(); break;
      case "reset":
        if (window.confirm("Reset ALL your progress? This can't be undone.")) {
          store.progress = {};
          save();
          closeModal();
          toast("Progress reset");
          route();
        }
        break;
    }
  });

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.switch) changeSetting(t.dataset.switch, t.checked);
    if (t.id === "importFile" && t.files && t.files[0]) importBackup(t.files[0]);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeModal(); return; }
    if (!S || !document.getElementById("stage") || document.querySelector(".modal-bg")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var onControl = e.target.closest && e.target.closest("button, a, input, summary");
    var k = e.key;
    if (k === "ArrowRight") { e.preventDefault(); decide(1); }
    else if (k === "ArrowLeft") { e.preventDefault(); decide(-1); }
    else if ((k === " " || k === "Enter") && !onControl) { e.preventDefault(); flip(); }
    else if (k === "ArrowUp" || k === "ArrowDown") { e.preventDefault(); flip(); }
    else if (k === "z" || k === "Z" || k === "Backspace") { e.preventDefault(); undo(); }
    else if (k === "s" || k === "S") { if (S.deck[S.i]) say(S.deck[S.i].c.w); }
  });

  route();
})();
