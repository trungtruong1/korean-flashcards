(function () {
  "use strict";

  var STORE_KEY = "gorae-words:v1";
  var LEVELS = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" };
  var DEFAULT_SETTINGS = { front: "ko", roman: true, autoplay: false, shuffle: false, viFirst: true, theme: "auto", rec: true, voice: "", rate: "0.85" };

  var app = document.getElementById("app");
  var toastEl = document.getElementById("toast");

  var meta = null;
  var grammar = null; // data/grammar.json, plus byId
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
    copy: svg('<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15h-.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    book: svg('<path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14"/><path d="M9 7h7M9 11h5"/>'),
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

  function copyText(text) {
    var done = function () { toast("Copied: " + (text.length > 36 ? text.slice(0, 36) + "…" : text)); };
    var fallback = function () {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { /* not supported */ }
      ta.remove();
      if (ok) done(); else toast("Couldn't copy on this browser");
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  // Pronunciation guide in Vietnamese letters (see js/pronounce.js).
  function guide(c) { return window.viPron(c.pr, c.w); }

  // Lowercase, drop Vietnamese tone marks and đ → d, for accent-free search.
  function fold(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d"); }

  // Wrap the word (or its verb stem) in the example sentence with <mark>.
  // Example sentences mark the studied word with [brackets].
  function markup(text) {
    return esc(text).replace(/\[([^\]]+)\]/g, "<mark>$1</mark>");
  }
  function plain(text) { return text.replace(/[[\]]/g, ""); }

  // Fallback for examples without [brackets]: guess the word in the sentence.
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
          updated: raw.updated || 0,
          syncUid: raw.syncUid || null,
        };
      }
    } catch (e) { /* fall through to a fresh store */ }
    return { progress: {}, settings: Object.assign({}, DEFAULT_SETTINGS), last: 1, updated: 0, syncUid: null };
  }
  var store = load();

  // progressChanged: the word statuses changed (so cloud sync should upload them).
  function save(progressChanged) {
    if (progressChanged) store.updated = Date.now();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {
      if (!saveWarned) { saveWarned = true; toast("This browser won't let me save progress (private mode?)"); }
    }
    if (progressChanged && window.goraeSync) window.goraeSync.push();
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
    if (meta && grammar) return Promise.resolve(meta);
    // The grammar list is small; load it with the word list so breakdowns can name their steps.
    var g = grammar ? Promise.resolve(grammar) : getJSON("data/grammar.json").then(function (d) {
      d.byId = {};
      d.points.forEach(function (p) { d.byId[p.id] = p; });
      return d;
    }).catch(function (e) { console.error(e); return null; });
    return Promise.all([meta ? meta : getJSON("data/meta.json"), g]).then(function (r) {
      meta = r[0];
      grammar = r[1];
      return meta;
    });
  }
  function getSet(n) {
    if (!setCache[n]) {
      setCache[n] = getJSON("data/sets/" + pad3(n) + ".json").catch(function (e) { delete setCache[n]; throw e; });
    }
    return setCache[n];
  }

  // ---------- Speech ----------
  var koVoice = null, voicesLoaded = false, voiceWarned = false;
  function koreanVoices() {
    if (!("speechSynthesis" in window)) return [];
    return window.speechSynthesis.getVoices().filter(function (v) { return /^ko/i.test(v.lang); });
  }
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    if (!window.speechSynthesis.getVoices().length) return;
    voicesLoaded = true;
    var ko = koreanVoices();
    var chosen = ko.filter(function (v) { return v.name === store.settings.voice; })[0];
    koVoice = chosen || ko.filter(function (v) { return /natural|online|google|premium|enhanced/i.test(v.name); })[0] || ko[0] || null;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }
  function say(text) {
    stopAudio();
    if (!("speechSynthesis" in window)) { toast("Audio isn't supported in this browser"); return; }
    pickVoice();
    var synth = window.speechSynthesis;
    synth.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    if (koVoice) u.voice = koVoice;
    u.rate = parseFloat(store.settings.rate) || 0.85;
    synth.speak(u);
    if (voicesLoaded && !koVoice && !voiceWarned) {
      voiceWarned = true;
      toast("No Korean voice on this device — add one in your system's speech settings");
    }
  }

  // Recordings by native speakers from the Korean Learners' Dictionary (NIKL),
  // streamed from its media server. Falls back to the device voice.
  var REC_BASE = "https://dicmedia.korean.go.kr/multimedia/";
  var player = null;
  function stopAudio() { if (player) { player.pause(); player = null; } }
  function playRecording(path, text) {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    stopAudio();
    var a = player = new Audio(REC_BASE + path);
    var fell = false;
    var fallback = function () { if (!fell && player === a) { fell = true; player = null; say(text); } };
    a.addEventListener("error", fallback);
    var p = a.play();
    if (p && p.catch) p.catch(function (e) { if (e && e.name !== "AbortError") fallback(); });
  }
  // Say a card's word: the recording when there is one (and it's turned on).
  function sayWord(c) {
    if (c.au && store.settings.rec) playRecording(c.au, c.w);
    else say(c.w);
  }
  function wordSpeakBtn(c, cls) {
    var rec = c.au && store.settings.rec;
    return '<button class="speak' + (cls || "") + '" data-say="' + esc(c.w) + '"' + (c.au ? ' data-au="' + esc(c.au) + '"' : "") +
      ' aria-label="' + (rec ? "Play recording by a native speaker" : "Play pronunciation") + '" title="' + (rec ? "Native speaker recording" : "Device voice") + '">' + icon.sound + "</button>";
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
      if (parts[0] === "grammar") return renderGrammar(decodeURIComponent(parts[1] || ""));
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
      '<div class="top-btns"><a class="icon-btn" href="#/grammar" aria-label="Grammar" title="Grammar · Ngữ pháp">' + icon.book + "</a>" + accountButton() +
      '<button class="icon-btn" data-act="settings" aria-label="Settings">' + icon.gear + "</button></div></header>" +
      '<div class="search"><span class="s-icon">' + icon.search + "</span>" +
      '<input id="q" type="search" placeholder="Search 한국어, Tiếng Việt or English" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Search words" value="' + esc(searchQuery) + '">' +
      '<button class="s-clear" data-act="clear-search" aria-label="Clear search"' + (searchQuery ? "" : " hidden") + ">" + icon.x + "</button></div>" +
      '<div id="results"></div><div id="home-body"' + (searchQuery ? " hidden" : "") + ">" +
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
      'Meanings from the National Institute of Korean Language dictionary; simple example sentences written by AI. <button data-act="about">About &amp; credits</button></footer></div>';
    app.innerHTML = html;
    if (searchQuery) runSearch();
  }

  // ---------- Search ----------
  var searchQuery = "";
  var searchIndex = null; // promise of [{w, vi, en, pos, ...folded fields}]

  function getSearchIndex() {
    if (!searchIndex) {
      searchIndex = getJSON("data/search.json").then(function (rows) {
        // Row: [word, vi, en, other meanings vi, other meanings en]; position = index + 1.
        return rows.map(function (r, i) {
          var split = function (s) { return s ? s.split(/\s*[,;|]\s*/).filter(Boolean) : []; };
          return {
            w: r[0], vi: r[1], en: r[2], pos: i + 1,
            kw: r[0].normalize("NFD"),
            items: [split(r[1].toLowerCase()), split(r[2].toLowerCase()), split((r[3] || "").toLowerCase()), split((r[4] || "").toLowerCase())],
            folded: [split(fold(r[1])), split(fold(r[2])), split(fold(r[3] || "")), split(fold(r[4] || ""))],
          };
        });
      }).catch(function (e) { searchIndex = null; throw e; });
    }
    return searchIndex;
  }

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // Lower score = better match: 0 exact, 1 starts the gloss, 2 whole word inside it, 4 anywhere.
  function itemScore(items, q, wordRe) {
    var best = 9;
    for (var k = 0; k < items.length && best > 0; k++) {
      var t = items[k];
      if (t === q) best = 0;
      else if (t.indexOf(q) === 0 && wordRe.test(t)) best = Math.min(best, 1);
      else if (wordRe.test(t)) best = Math.min(best, 2);
      else if (q.length >= 3 && t.indexOf(q) >= 0) best = Math.min(best, 4);
    }
    return best;
  }

  function searchWords(rows, query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    var out = [];
    if (/[ᄀ-ᇿ㄰-㆏가-힣]/.test(q)) {
      var kq = q.replace(/\s+/g, "").normalize("NFD");
      rows.forEach(function (r) {
        var i = r.kw.indexOf(kq);
        if (i < 0) return;
        out.push({ r: r, s: r.kw === kq ? 0 : i === 0 ? 1 : 3 });
      });
    } else {
      var fq = fold(q), accented = fq !== q;
      var re = new RegExp("(^|[^\\p{L}\\p{N}])" + escRe(q) + "($|[^\\p{L}\\p{N}])", "u");
      var fre = new RegExp("(^|[^\\p{L}\\p{N}])" + escRe(fq) + "($|[^\\p{L}\\p{N}])", "u");
      rows.forEach(function (r) {
        var best = 9;
        for (var f = 0; f < 4; f++) {
          var extra = f >= 2 ? 1.5 : 0;
          // Typing with Vietnamese accents prefers exact-accent matches; without them, any accent matches.
          var s = accented ? Math.min(itemScore(r.items[f], q, re), itemScore(r.folded[f], fq, fre) + 1.5) : itemScore(r.folded[f], fq, fre);
          if (s < 9) best = Math.min(best, s + extra);
        }
        if (best < 9) out.push({ r: r, s: best });
      });
    }
    out.sort(function (a, b) { return a.s - b.s || a.r.pos - b.r.pos; });
    return out;
  }

  function statusOf(pos, w) {
    var n = Math.ceil(pos / meta.setSize);
    var s = (store.progress[n] || {})[w];
    return s === 1 ? "known" : s === 0 ? "learning" : "new";
  }

  function runSearch() {
    var box = document.getElementById("results"), body = document.getElementById("home-body");
    var clear = app.querySelector(".s-clear");
    if (!box) return;
    var query = searchQuery;
    if (clear) clear.hidden = !query;
    if (!query.trim()) { box.innerHTML = ""; if (body) body.hidden = false; return; }
    if (body) body.hidden = true;
    if (!searchIndex) box.innerHTML = '<p class="hint">Loading words…</p>';
    getSearchIndex().then(function (rows) {
      if (query !== searchQuery || !document.getElementById("results")) return;
      var found = searchWords(rows, query), LIMIT = 60;
      var labels = { known: "Got it", learning: "Not yet", new: "New" };
      box.innerHTML = found.length
        ? '<p class="res-count">' + fmt(found.length) + " word" + (found.length > 1 ? "s" : "") + (found.length > LIMIT ? " · showing the " + LIMIT + " best" : "") + "</p>" +
          '<ul class="word-list">' + found.slice(0, LIMIT).map(function (x) {
            var r = x.r, st = statusOf(r.pos, r.w);
            return '<li><button class="word-row result" data-open="' + r.pos + '"><span class="n">#' + fmt(r.pos) + "</span>" +
              '<span class="res-main"><span class="w" lang="ko">' + esc(r.w) + '</span><span class="m"><b lang="vi">' + esc(r.vi) + "</b> · " + esc(r.en) + "</span></span>" +
              '<span class="res-side"><span class="status-btn ' + st + '">' + labels[st] + '</span><span class="res-set">Set ' + Math.ceil(r.pos / meta.setSize) + "</span></span></button></li>";
          }).join("") + "</ul>"
        : '<div class="no-results">' + whale() + "<p>No words match “" + esc(query) + "”.</p></div>";
    }).catch(function () {
      if (query === searchQuery) box.innerHTML = '<p class="hint">Couldn\'t load the search list. Check your connection and try again.</p>';
    });
  }

  // Card details in a popup (from search results).
  function openCard(pos) {
    var n = Math.ceil(pos / meta.setSize), i = (pos - 1) % meta.setSize;
    getSet(n).then(function (cards) {
      var c = cards[i];
      if (!c) return;
      openModal(
        '<h2><span class="cm-title">#' + fmt(pos) + " · Set " + n + '</span><button class="icon-btn" data-act="close" aria-label="Close">' + icon.x + "</button></h2>" +
        '<div class="card-detail">' + backHtml(c) + "</div>" +
        '<div class="cm-status"><span>Status</span>' + statusSeg(n, c.w) + "</div>" +
        '<div class="row-btns cm-go"><a class="btn mint small" href="#/set/' + n + '">Study Set ' + n + "</a>" +
        '<a class="btn small" href="#/set/' + n + '/list">Word list</a></div>'
      );
    }).catch(function () { toast("Couldn't load that word"); });
  }

  function statusSeg(n, w) {
    var s = (store.progress[n] || {})[w];
    var cur = s === 1 ? "1" : s === 0 ? "0" : "new";
    return '<div class="seg" role="group" aria-label="Status">' + [["new", "New"], ["1", "Got it"], ["0", "Not yet"]].map(function (o) {
      return '<button data-mark="' + o[0] + '" data-set="' + n + '" data-word="' + esc(w) + '" aria-pressed="' + (cur === o[0]) + '">' + o[1] + "</button>";
    }).join("") + "</div>";
  }

  function markWord(btn) {
    var n = parseInt(btn.dataset.set, 10), w = btn.dataset.word, v = btn.dataset.mark;
    var prog = setProgress(n);
    if (v === "new") delete prog[w]; else prog[w] = Number(v);
    save(true);
    btn.parentNode.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
    if (document.getElementById("results")) runSearch();
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
    if (store.settings.autoplay) sayWord(cur.c);
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
        (st.roman ? '<div class="guide" lang="vi" title="Pronunciation in Vietnamese letters">' + esc(guide(c)) + "</div>" : "") +
        '<div class="front-btns">' + wordSpeakBtn(c) +
        '<button class="speak copy" data-copy="' + esc(c.w) + '" aria-label="Copy word">' + icon.copy + "</button></div>";
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
      c.g && gPoint(c.g) ? '<a class="chip gram" href="#/grammar/' + esc(c.g) + '" data-g="' + esc(c.g) + '">' + icon.book + "Grammar: " + esc(gPoint(c.g).ko) + "</a>" : "",
    ].join("");
    var defs = m0.dv || m0.d
      ? '<details class="defs"><summary>+ Definition</summary>' +
        (m0.dv ? '<p lang="vi"><b>VI</b> ' + esc(m0.dv) + "</p>" : "") +
        (m0.d ? '<p lang="en"><b>EN</b> ' + esc(m0.d) + "</p>" : "") + "</details>"
      : "";
    var ex = "";
    if (m0.x) {
      var trVi = m0.xv ? '<p class="tr" lang="vi"><span class="flag">VI</span><span>' + markup(m0.xv) + "</span></p>" : "";
      var trEn = m0.xe ? '<p class="tr" lang="en"><span class="flag en">EN</span><span>' + markup(m0.xe) + "</span></p>" : "";
      ex = '<div class="example"><div class="ex-body"><span class="lbl">EXAMPLE</span>' +
        '<p class="ko" lang="ko">' + (m0.x.indexOf("[") >= 0 ? markup(m0.x) : highlight(m0.x, c.w)) + "</p>" +
        (st.viFirst ? trVi + trEn : trEn + trVi) + "</div>" +
        '<div class="ex-btns"><button class="speak sm" data-say="' + esc(plain(m0.x)) + '" aria-label="Play example sentence">' + icon.sound + "</button>" +
        '<button class="speak sm copy" data-copy="' + esc(plain(m0.x)) + '" aria-label="Copy example sentence">' + icon.copy + "</button></div></div>";
    }
    var alts = c.m.slice(1).map(function (m) {
      return '<div class="alt"><span class="pos">' + esc(m.p || "") + (m.h ? " " + esc(m.h) : "") + "</span> " +
        '<span class="vi" lang="vi">' + esc(m.vi) + '</span> · <span class="en">' + esc(m.en) + "</span></div>";
    }).join("");
    var sub = (st.roman ? '<span class="r" lang="vi" title="Pronunciation in Vietnamese letters">' + esc(guide(c)) + "</span>" : "") +
      (c.pr ? '<span class="pr" lang="ko" title="Pronounced">[' + esc(c.pr) + "]</span>" : "");
    return '<div class="back-head"><div class="bh-text"><span class="w" lang="ko">' + esc(c.w) + "</span>" +
      (sub ? '<div class="bh-sub">' + sub + "</div>" : "") + "</div>" +
      '<button class="speak sm copy" data-copy="' + esc(c.w) + '" aria-label="Copy word">' + icon.copy + "</button>" +
      wordSpeakBtn(c) + "</div>" +
      (chips ? '<div class="chips">' + chips + "</div>" : "") +
      '<div class="mean">' + langLines(m0) + "</div>" + defs + ex + bdHtml(c, m0) +
      (alts ? '<div class="also"><span class="lbl">ALSO MEANS</span>' + alts + "</div>" : "") +
      (c.ai ? '<div class="ai-note">✦ Meaning written by AI, not from the dictionary.</div>' : "");
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
    save(true);
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
    save(true);
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
    save(true);
    var key = prog[w] === 1 ? "known" : prog[w] === 0 ? "learning" : "new";
    btn.className = "status-btn " + key;
    btn.textContent = STATUS[prog[w]] ? STATUS[prog[w]][1] : "New";
  }

  // ---------- Grammar ----------
  // data/grammar.json: points with id, level, category, Korean title, names,
  // explanation and examples. Card breakdowns (m.bd) link to them by id.
  var CAT_ORDER = ["basics", "endings", "particles", "connectors", "patterns", "sound", "suffixes"];
  var grammarLevel = 1;

  function gPoint(id) { return grammar && grammar.byId[id]; }
  function gName(p) { return store.settings.viFirst ? p.vi : p.en; }
  function gShort(p) { return store.settings.viFirst ? p.s[1] : p.s[0]; }

  function gLink(id, text, note) {
    var p = gPoint(id);
    if (!p) return '<span class="g-tag' + (note ? " note" : "") + '">' + esc(text) + "</span>";
    return '<a class="g-tag' + (note ? " note" : "") + '" href="#/grammar/' + esc(id) + '" data-g="' + esc(id) + '" title="' + esc(p.ko + " · " + gName(p)) + '">' + esc(text) + "</a>";
  }

  // How the card's word is built in the example: 보다 → 보 → + 았 → 봤 → + 어요 → 봤어요.
  function bdHtml(c, m0) {
    var bd = m0.bd;
    if (!bd || !grammar) return "";
    var rows = bd[1].map(function (st, k) {
      var piece = st[0], res = st[1], gid = st[2];
      var left = gid === "stem" ? piece : (k === 0 ? c.w + " + " + piece : "+ " + piece);
      var p = gPoint(gid);
      var tags = (p ? gLink(gid, gShort(p)) : "") +
        st.slice(3).map(function (n) { return gLink(n[0], n[1], true); }).join("");
      return '<li><span class="bd-step" lang="ko"><b>' + esc(left) + '</b><i aria-hidden="true">→</i>' + esc(res) + "</span>" +
        (tags ? '<span class="bd-why">' + tags + "</span>" : "") + "</li>";
    }).join("");
    return '<details class="bd"' + (store.settings.bdOpen === false ? "" : " open") + ">" +
      '<summary><span class="lbl">HOW IT\'S BUILT</span> <span class="bd-word" lang="ko">' + esc(bd[0]) + "</span></summary>" +
      '<ol class="bd-steps">' + rows + "</ol></details>";
  }

  function gExamples(p) {
    return '<div class="gp-ex">' + p.ex.map(function (e) {
      var vi = '<p class="tr" lang="vi"><span class="flag">VI</span><span>' + markup(e[1]) + "</span></p>";
      var en = '<p class="tr" lang="en"><span class="flag en">EN</span><span>' + markup(e[2]) + "</span></p>";
      return '<div class="example"><div class="ex-body"><p class="ko" lang="ko">' + markup(e[0]) + "</p>" +
        (store.settings.viFirst ? vi + en : en + vi) + "</div>" +
        '<div class="ex-btns"><button class="speak sm" data-say="' + esc(plain(e[0])) + '" aria-label="Play example">' + icon.sound + "</button></div></div>";
    }).join("") + "</div>";
  }

  function gBody(p) {
    var first = store.settings.viFirst ? [p.dvi, "vi"] : [p.den, "en"];
    var second = store.settings.viFirst ? [p.den, "en"] : [p.dvi, "vi"];
    return '<p class="gp-form"><span class="lbl">HOW TO FORM</span><span lang="ko">' + esc(p.form) + "</span></p>" +
      '<p class="gp-d" lang="' + first[1] + '">' + esc(first[0]) + "</p>" +
      '<p class="gp-d second" lang="' + second[1] + '">' + esc(second[0]) + "</p>" + gExamples(p);
  }

  function gHead(p) {
    var names = store.settings.viFirst ? [p.vi, p.en] : [p.en, p.vi];
    return '<span class="gp-ko" lang="ko">' + esc(p.ko) + "</span>" +
      '<span class="gp-names"><b>' + esc(names[0]) + "</b> · " + esc(names[1]) + "</span>";
  }

  // Quick look from a card, without leaving the study session.
  function openGrammar(id) {
    var p = gPoint(id);
    if (!p) return;
    openModal(
      '<div class="g-modal"><h2><span class="chip lv' + p.lv + '">' + LEVELS[p.lv] + "</span>" +
      '<button class="icon-btn" data-act="close" aria-label="Close">' + icon.x + "</button></h2>" +
      '<div class="gp-title">' + gHead(p) + "</div>" + gBody(p) +
      '<div class="row-btns"><a class="btn small mint" href="#/grammar/' + esc(id) + '">' + icon.book + "Open grammar page</a></div></div>"
    );
  }

  function renderGrammar(id) {
    var target = id && gPoint(id);
    if (target) grammarLevel = target.lv;
    document.title = "Grammar · Gorae Words";
    var pts = grammar ? grammar.points.filter(function (p) { return p.lv === grammarLevel; }) : [];
    var groups = CAT_ORDER.map(function (cat) {
      var list = pts.filter(function (p) { return p.cat === cat; });
      if (!list.length) return "";
      var names = grammar.cats[cat] || [cat, cat];
      return '<h3 class="g-cat">' + esc(store.settings.viFirst ? names[1] + " · " + names[0] : names[0] + " · " + names[1]) + "</h3>" +
        list.map(function (p) {
          return '<details class="g-point" id="g-' + esc(p.id) + '"' + (target === p ? " open" : "") + ">" +
            "<summary>" + gHead(p) + '</summary><div class="gp-body">' + gBody(p) + "</div></details>";
        }).join("");
    }).join("");
    var counts = [1, 2, 3].map(function (lv) { return grammar ? grammar.points.filter(function (p) { return p.lv === lv; }).length : 0; });
    app.innerHTML =
      '<header class="study-top"><a class="icon-btn" href="#/" aria-label="Back to all sets">' + icon.back + "</a>" +
      '<div class="title"><b>Grammar · 문법</b><small>Ngữ pháp · ' + (grammar ? grammar.points.length : 0) + " points</small></div>" +
      '<button class="icon-btn" data-act="settings" aria-label="Settings">' + icon.gear + "</button></header>" +
      '<p class="g-intro">The grammar used in the example sentences, from beginner to advanced. On a card, tap a step under <b>How it\'s built</b> to see its explanation.</p>' +
      '<div class="list-head"><div class="seg" role="group" aria-label="Level">' +
      [1, 2, 3].map(function (lv) {
        return '<button data-glevel="' + lv + '" aria-pressed="' + (grammarLevel === lv) + '">' + LEVELS[lv] + " <small>" + counts[lv - 1] + "</small></button>";
      }).join("") + "</div></div>" +
      '<div class="g-list">' + (groups || '<p class="hint">Couldn\'t load the grammar list.</p>') + "</div>";
    if (target) {
      var el = document.getElementById("g-" + id);
      if (el) {
        el.classList.add("flash");
        setTimeout(function () { el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 50);
      }
    } else {
      window.scrollTo(0, 0);
    }
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
      '<div class="opt"><div>Pronunciation guide<small>In Vietnamese letters with Seoul pitch: 보다 → ' + esc(window.viPron(null, "보다")) + ' · <button class="link-btn" data-act="guide-help">How to read it</button></small></div>' + sw("roman") + "</div>" +
      '<div class="opt"><div>Shuffle cards<small>Applies when you open a set</small></div>' + sw("shuffle") + "</div>" +
      "<h3>Audio</h3>" +
      '<div class="opt"><div>Word audio<small>Real voice: native speakers recorded by the Korean dictionary (' + fmt(meta && meta.audio || 6000) + " words)</small></div>" +
      seg("rec", [["true", "Real voice"], ["false", "Device"]]) + "</div>" +
      '<div class="opt"><div>Auto-play audio<small>Say each word when it appears</small></div>' + sw("autoplay") + "</div>" +
      voiceOption() +
      '<div class="opt"><div>Voice speed<small>Device voice</small></div>' + seg("rate", [["0.7", "Slow"], ["0.85", "Normal"], ["1", "Fast"]]) + "</div>" +
      "<h3>Look</h3>" +
      '<div class="opt"><div>Theme</div>' + seg("theme", [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]]) + "</div>" +
      "<h3>Progress</h3>" +
      progressNote() +
      '<div class="row-btns"><button class="btn small" data-act="export">Export backup</button>' +
      '<button class="btn small" data-act="import">Import backup</button>' +
      '<button class="btn small ghost" data-act="reset">Reset all</button></div>' +
      '<input type="file" accept="application/json,.json" id="importFile" hidden>' +
      '<h3>About</h3><p><button class="btn small ghost" data-act="about">About &amp; credits</button></p>'
    );
  }

  function voiceOption() {
    var ko = koreanVoices();
    var cur = koVoice ? koVoice.name : "";
    var opts = ko.length
      ? '<option value="">Best available' + (cur && !store.settings.voice ? " (" + esc(cur) + ")" : "") + "</option>" +
        ko.map(function (v) { return '<option value="' + esc(v.name) + '"' + (v.name === store.settings.voice ? " selected" : "") + ">" + esc(v.name) + "</option>"; }).join("")
      : '<option value="">No Korean voice found</option>';
    return '<div class="opt opt-col"><div>Device voice<small>Reads example sentences. Most natural: “SunHi/InJoon Online (Natural)” in Edge, “Google 한국의” in Chrome, “Yuna (Enhanced)” on iPhone (Settings → Accessibility → Spoken Content → Voices).</small></div>' +
      '<div class="voice-row"><select id="voiceSel" aria-label="Device voice">' + opts + "</select>" +
      '<button class="btn small" data-act="test-voice">' + icon.sound + "Test</button></div></div>";
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
      '<p><b>Meanings:</b> <a href="https://krdict.korean.go.kr" target="_blank" rel="noopener">한국어기초사전 (Korean Learners\' Dictionary)</a> by the National Institute of Korean Language, licensed ' +
      '<a href="https://creativecommons.org/licenses/by-sa/2.0/kr/" target="_blank" rel="noopener">CC BY-SA 2.0 KR</a>. The word data on this site is shared under the same license. ' +
      "Homonyms are ordered using NIKL's 한국어 학습용 어휘 목록.</p>" +
      "<p><b>Example sentences</b> and their Vietnamese and English translations were written by AI (Claude) to keep them short and beginner-friendly. They may contain small mistakes.</p>" +
      "<p><b>How it's built</b> breakdowns are made automatically with the <a href=\"https://github.com/bab2min/kiwipiepy\" target=\"_blank\" rel=\"noopener\">Kiwi</a> Korean analyzer; the grammar page was written by AI (Claude).</p>" +
      "<p><b>AI-written cards:</b> a few hundred common words (new loanwords and slang like 맛집, 알바, 헐) aren't in the dictionary. Their meanings were written by AI and are marked <span class=\"chip ai\">AI</span>.</p>" +
      "<p><b>Pronunciation guide:</b> generated from the dictionary's pronunciations. <button class=\"link-btn\" data-act=\"guide-help\">How to read it</button></p>" +
      "<p><b>Audio:</b> words play recordings by native speakers from the same dictionary, streamed from its server (dicmedia.korean.go.kr). Example sentences, and words without a recording, use your device's Korean voice.</p>"
    );
  }

  function jamoChart(pairs) {
    return '<div class="jamo-chart">' + pairs.map(function (p) {
      return '<div><span class="j" lang="ko">' + p[0] + '</span><span class="v" lang="vi">' + esc(p[1]) + "</span></div>";
    }).join("") + "</div>";
  }

  function openGuideHelp() {
    var ex = function (w, pr) { return '<tr><td lang="ko">' + w + '</td><td lang="vi"><b>' + esc(window.viPron(pr, w)) + "</b></td></tr>"; };
    openModal(
      '<h2>Pronunciation guide <button class="icon-btn" data-act="close" aria-label="Close">' + icon.x + "</button></h2>" +
      "<p>Each word is written with Vietnamese letters the way Seoul speakers actually say it, including sound changes (있다 sounds like 읻따, 한국어 like 한구거).</p>" +
      "<h3>Pitch (the tone marks)</h3>" +
      "<p>Korean has no word tones, but Seoul speech has a melody. Words starting with <b>ㅋ ㅌ ㅍ ㅊ, ㄲ ㄸ ㅃ ㅆ ㅉ, ㅅ or ㅎ</b> start high; all other words start low and then rise.</p>" +
      "<p><b>Dấu huyền / dấu nặng</b> (pồ, ịt) = say it lower. <b>No mark / dấu sắc</b> (ta, hák) = higher, level. In longer words the second-to-last syllable dips again.</p>" +
      '<table class="guide-table">' + ex("보다") + ex("사다") + ex("있다", "읻따") + ex("감사합니다", "감사함니다") + ex("고마워요") + "</table>" +
      "<h3>Vowels · Nguyên âm</h3>" + jamoChart(window.viPron.chart.vowels) +
      "<p><b>o</b> = ㅓ (open, like Vietnamese o), <b>ô</b> = ㅗ (rounded). ㅐ <b>e</b> and ㅔ <b>ê</b> sound almost the same in Seoul.</p>" +
      "<h3>Consonants · Phụ âm</h3>" + jamoChart(window.viPron.chart.consonants) +
      "<p>Each consonant has three versions: plain <b>k t p j s</b> (soft, a little air), " +
      "aspirated <b>kh th ph ch</b> (ㅋ ㅌ ㅍ ㅊ, a strong puff of air) and tense <b>kk tt pp jj ss</b> (ㄲ ㄸ ㅃ ㅉ ㅆ, tighten your throat, no air). " +
      "ㄹ is <b>r</b> between vowels (a light tap) and <b>l</b> at the end of a syllable. Final consonants are written <b>k t p n l m ng</b>.</p>" +
      "<p>It's a guide, not a replacement for listening: tap the speaker to hear a recording of a native speaker.</p>"
    );
  }

  // ---------- Account (optional cloud sync, see js/sync.js) ----------
  function syncOn() { return !!(window.GORAE_FIREBASE && window.GORAE_FIREBASE.apiKey); }
  function syncUser() { return window.goraeSync ? window.goraeSync.user() : null; }

  function accountButton() {
    if (!syncOn()) return "";
    var u = syncUser();
    var label = u ? "Account: " + (u.email || "signed in") : "Sign in to save progress";
    var face = u ? esc((u.displayName || u.email || "?").trim().charAt(0).toUpperCase()) : icon.user;
    return '<button class="icon-btn acct' + (u ? " in" : "") + '" data-act="account" aria-label="' + esc(label) + '" title="' + esc(label) + '">' + face + "</button>";
  }

  function progressNote() {
    if (!syncOn()) return "<p>Your progress is saved in this browser. Export a backup to move it to another phone or computer.</p>";
    var u = syncUser();
    return u
      ? '<p>Signed in as <b>' + esc(u.email || u.displayName || "you") + "</b>: your progress syncs between your devices. " +
        '<button class="link-btn" data-act="account">Account</button></p>'
      : '<p>Your progress is saved in this browser. <button class="link-btn" data-act="account">Sign in</button> to keep it in your account and use it on any device.</p>';
  }

  var GOOGLE_G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  function openAccount() {
    var sync = window.goraeSync, u = syncUser(), body;
    if (!sync) {
      body = "<p>Loading sign-in…</p>";
    } else if (u) {
      body = "<p>Signed in as <b>" + esc(u.email || u.displayName || "you") + "</b>.</p>" +
        "<p>Your progress is saved to your account and syncs between your devices automatically.</p>" +
        '<p class="sync-state">' + esc(sync.status()) + "</p>" +
        '<div class="row-btns"><button class="btn small ghost" data-act="logout">Sign out</button></div>';
    } else {
      body = "<p>Sign in to save your progress to your account and continue on any phone or computer. What you've already studied here is kept and added to your account.</p>" +
        '<button class="btn block google" data-act="login-google">' + GOOGLE_G + "Continue with Google</button>" +
        '<div class="or"><span>or with email</span></div>' +
        '<form class="login-form" id="loginForm" novalidate>' +
        '<input type="email" id="lgEmail" placeholder="Email" autocomplete="email" required>' +
        '<input type="password" id="lgPass" placeholder="Password (at least 6 characters)" autocomplete="current-password" minlength="6" required>' +
        '<div class="row-btns"><button class="btn mint small" type="submit" data-mode="in">Sign in</button>' +
        '<button class="btn small" type="submit" data-mode="up">Create account</button>' +
        '<button class="link-btn" type="button" data-act="reset-pw">Forgot password?</button></div></form>';
    }
    openModal('<div class="acct-modal"><h2>Account <button class="icon-btn" data-act="close" aria-label="Close">' + icon.x + "</button></h2>" + body + "</div>");
  }

  function emailLogin(mode) {
    var sync = window.goraeSync;
    var email = (document.getElementById("lgEmail") || {}).value || "";
    var pass = (document.getElementById("lgPass") || {}).value || "";
    if (!sync) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { toast("Type your email address"); return; }
    if (pass.length < 6) { toast("Passwords need at least 6 characters"); return; }
    (mode === "up" ? sync.signUpEmail : sync.signInEmail)(email.trim(), pass).catch(function (err) { toast(sync.errorText(err)); });
  }

  // Re-draw the home page or word list after synced progress arrives, without
  // touching a study session in progress.
  function refreshView() {
    if (S || !meta) return;
    var parts = location.hash.replace(/^#\/?/, "").split("/");
    var n = parseInt(parts[1], 10);
    if (parts[0] === "set" && parts[2] === "list" && n >= 1 && n <= meta.sets) { renderList(n); return; }
    if (parts[0] === "set") return;
    var q = document.getElementById("q"), typing = q && document.activeElement === q;
    renderHome();
    if (typing) { q = document.getElementById("q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }

  // Used by js/sync.js.
  window.gorae = {
    getProgress: function () { return { progress: store.progress, updated: store.updated || 0, syncUid: store.syncUid }; },
    applyRemote: function (progress, updated, uid) {
      store.progress = progress && typeof progress === "object" ? progress : {};
      store.updated = updated || Date.now();
      store.syncUid = uid;
      save();
      refreshView();
    },
    setSyncUid: function (uid) { store.syncUid = uid; save(); },
    authChanged: function () {
      var b = app.querySelector('[data-act="account"]');
      if (b) b.outerHTML = accountButton();
      if (document.querySelector(".modal .acct-modal")) openAccount();
    },
    toast: toast,
  };

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
        save(true);
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
    if (S && document.getElementById("deck") && ["front", "roman", "viFirst", "rec"].indexOf(key) >= 0) renderDeck(true);
    if (key === "voice") pickVoice();
  }

  // ---------- Events ----------
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act],[data-say],[data-copy],[data-open],[data-mark],[data-g],[data-glevel],[data-go],[data-toggle],[data-filter],[data-setting]");
    if (!t) {
      if (e.target.classList && e.target.classList.contains("modal-bg")) closeModal();
      return;
    }
    if (t.dataset.say) {
      if (t.dataset.au && store.settings.rec) playRecording(t.dataset.au, t.dataset.say);
      else say(t.dataset.say);
      return;
    }
    if (t.dataset.copy) { copyText(t.dataset.copy); return; }
    if (t.dataset.open) { openCard(parseInt(t.dataset.open, 10)); return; }
    if (t.dataset.mark) { markWord(t); return; }
    if (t.dataset.g) {
      // Ctrl/Cmd-click opens the grammar page in a new tab; a plain click shows a popup.
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      if (document.querySelector(".g-list")) go("#/grammar/" + t.dataset.g);
      else openGrammar(t.dataset.g);
      return;
    }
    if (t.dataset.glevel) { grammarLevel = Number(t.dataset.glevel); renderGrammar(); return; }
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
      case "guide-help": openGuideHelp(); break;
      case "test-voice": say("안녕하세요. 만나서 반가워요."); break;
      case "account": openAccount(); break;
      case "login-google":
        if (window.goraeSync) window.goraeSync.signInGoogle().catch(function (err) { var m = window.goraeSync.errorText(err); if (m) toast(m); });
        break;
      case "logout":
        if (window.goraeSync) window.goraeSync.signOut().then(function () { toast("Signed out. Your progress stays on this device."); });
        break;
      case "reset-pw":
        var em = ((document.getElementById("lgEmail") || {}).value || "").trim();
        if (!em) { toast("Type your email first, then tap “Forgot password?”"); break; }
        window.goraeSync.resetPassword(em).then(function () { toast("Password reset email sent to " + em); }, function (err) { toast(window.goraeSync.errorText(err)); });
        break;
      case "clear-search":
        searchQuery = "";
        var qi = document.getElementById("q");
        if (qi) { qi.value = ""; qi.focus(); }
        runSearch();
        break;
      case "reset":
        if (window.confirm("Reset ALL your progress? This can't be undone.")) {
          store.progress = {};
          save(true);
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
    if (t.id === "voiceSel") { changeSetting("voice", t.value); say("안녕하세요. 만나서 반가워요."); }
  });

  // Remember whether the "How it's built" box is open.
  document.addEventListener("toggle", function (e) {
    if (e.target.classList && e.target.classList.contains("bd") && e.target.closest(".card.current")) {
      if (store.settings.bdOpen !== e.target.open) { store.settings.bdOpen = e.target.open; save(); }
    }
  }, true);

  document.addEventListener("input", function (e) {
    if (e.target.id === "q") { searchQuery = e.target.value; runSearch(); }
  });

  document.addEventListener("submit", function (e) {
    if (e.target.id !== "loginForm") return;
    e.preventDefault();
    emailLogin(e.submitter && e.submitter.dataset.mode === "up" ? "up" : "in");
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeModal(); return; }
    if (e.target.id === "q" && e.key === "Enter") { e.target.blur(); return; }
    if (e.key === "/" && !S && document.getElementById("q") && !document.querySelector(".modal-bg") &&
        !(e.target.closest && e.target.closest("input, textarea"))) {
      e.preventDefault();
      document.getElementById("q").focus();
      return;
    }
    if (!S || !document.getElementById("stage") || document.querySelector(".modal-bg")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var onControl = e.target.closest && e.target.closest("button, a, input, summary");
    var k = e.key;
    if (k === "ArrowRight") { e.preventDefault(); decide(1); }
    else if (k === "ArrowLeft") { e.preventDefault(); decide(-1); }
    else if ((k === " " || k === "Enter") && !onControl) { e.preventDefault(); flip(); }
    else if (k === "ArrowUp" || k === "ArrowDown") { e.preventDefault(); flip(); }
    else if (k === "z" || k === "Z" || k === "Backspace") { e.preventDefault(); undo(); }
    else if (k === "s" || k === "S") { if (S.deck[S.i]) sayWord(S.deck[S.i].c); }
  });

  route();
})();
