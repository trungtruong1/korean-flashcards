// Pronunciation guide written with Vietnamese letters and tone marks.
//
// Sounds: works from the pronounced form (krdict pronunciations already include
// sound changes like 좋다 → 조타, 있다 → 읻따). Words without one go through a
// small sound-change engine (liaison, nasalization, tensing, aspiration...).
//
// Pitch: Seoul speech groups words into "accentual phrases" whose melody
// depends on the first consonant. Words starting with an aspirated (ㅋㅌㅍㅊ),
// tense (ㄲㄸㅃㅆㅉ) consonant, ㅅ or ㅎ start high; everything else starts low
// and rises: 보다 → low-high, 사다 → high-high. Low syllables get dấu huyền
// (or dấu nặng before p/t/c/k), high ones no mark (or dấu sắc before p/t/c/k).
(function () {
  // Initial consonant indexes: ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ
  var G = 0, GG = 1, N = 2, D = 3, DD = 4, R = 5, M = 6, B = 7, BB = 8, S = 9, SS = 10, NG = 11, J = 12, JJ = 13, CH = 14, K = 15, T = 16, P = 17, H = 18;
  var HIGH_START = [GG, DD, BB, S, SS, JJ, CH, K, T, P, H];

  // Final consonant indexes (0 = none) →
  // "", ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ
  var F_G = 1, F_N = 4, F_D = 7, F_L = 8, F_M = 16, F_B = 17, F_NG = 21, F_H = 27;
  // For each final: [consonant kept in place, consonant that moves to a following ㅇ (initial index or -1)]
  var SPLIT = {
    1: [0, G], 2: [0, GG], 3: [F_G, SS], 4: [0, N], 5: [F_N, J], 6: [F_N, -2], 7: [0, D], 8: [0, R],
    9: [F_L, G], 10: [F_L, M], 11: [F_L, B], 12: [F_L, SS], 13: [F_L, T], 14: [F_L, P], 15: [F_L, -2],
    16: [0, M], 17: [0, B], 18: [F_B, SS], 19: [0, S], 20: [0, SS], 21: [F_NG, -1], 22: [0, J], 23: [0, CH],
    24: [0, K], 25: [0, T], 26: [0, P], 27: [0, -2]
  };
  // What a final sounds like at the end of a syllable: one of 0, ㄱ, ㄴ, ㄷ, ㄹ, ㅁ, ㅂ, ㅇ (as final indexes)
  var NEUTRAL = [0, F_G, F_G, F_G, F_N, F_N, F_N, F_D, F_L, F_G, F_M, F_L, F_L, F_L, F_B, F_L,
                 F_M, F_B, F_B, F_D, F_D, F_NG, F_D, F_D, F_G, F_D, F_B, F_D];
  var TENSE = {}; TENSE[G] = GG; TENSE[D] = DD; TENSE[B] = BB; TENSE[S] = SS; TENSE[J] = JJ;
  var ASPIRATE = {}; ASPIRATE[G] = K; ASPIRATE[D] = T; ASPIRATE[B] = P; ASPIRATE[J] = CH;
  var FINAL_ASP = {}; FINAL_ASP[F_G] = K; FINAL_ASP[F_D] = T; FINAL_ASP[F_B] = P;
  var NASAL = {}; NASAL[F_G] = F_NG; NASAL[F_D] = F_N; NASAL[F_B] = F_M;
  var HAS_H = { 6: 1, 15: 1, 27: 1 }; // ㄶ ㅀ ㅎ

  function parse(text) {
    // Words are runs of Hangul syllables; anything else separates them.
    var words = [], cur = [];
    for (var k = 0; k < text.length; k++) {
      var code = text.charCodeAt(k) - 0xac00;
      if (code >= 0 && code < 11172) cur.push({ i: Math.floor(code / 588), m: Math.floor((code % 588) / 28), f: code % 28 });
      else if (cur.length) { words.push(cur); cur = []; }
    }
    if (cur.length) words.push(cur);
    return words;
  }

  // Apply the common sound changes to a spelled word (used when no dictionary
  // pronunciation is available).
  function soundChanges(w) {
    var s = w.map(function (x) { return { i: x.i, m: x.m, f: x.f }; });
    for (var k = 0; k < s.length; k++) {
      var a = s[k], b = s[k + 1];
      if (a.m === 19 && (k > 0 || a.i !== NG)) a.m = 20; // ㅢ after a consonant/inside a word → ㅣ
      if (!b) { a.f = NEUTRAL[a.f]; break; }
      var sp = SPLIT[a.f];
      if (!a.f) continue;
      if (b.i === NG) {
        // Liaison: the final moves to the empty initial (ㅎ just disappears).
        if (sp[1] >= 0) {
          var moved = sp[1];
          if (b.m === 20 && (moved === D || moved === T)) moved = moved === D ? J : CH; // 같이 → 가치
          a.f = sp[0]; b.i = moved;
        } else if (sp[1] === -2) {                                                          // 좋아 → 조아, 않아 → 아나
          a.f = 0;
          if (sp[0] === F_N) b.i = N;
          else if (sp[0] === F_L) b.i = R;
        }
        continue;
      }
      if (HAS_H[a.f]) {
        var kept = sp[0];
        if (ASPIRATE[b.i] !== undefined) { a.f = kept; b.i = ASPIRATE[b.i]; continue; }   // 좋다 → 조타
        if (b.i === S) { a.f = kept; b.i = SS; continue; }                                  // 좋소 → 조쏘
        if (b.i === N) { a.f = kept || F_N; if (kept === F_L) b.i = R; continue; }          // 좋네 → 존네, 싫네 → 실레
        a.f = kept; continue;
      }
      var f = NEUTRAL[a.f];
      if (b.i === H) {
        if (FINAL_ASP[f] !== undefined) { a.f = 0; b.i = FINAL_ASP[f]; continue; }        // 축하 → 추카
        if (f === F_N || f === F_M || f === F_L) {                                          // 전화 → 저놔
          b.i = f === F_N ? N : f === F_M ? M : R; a.f = 0; continue;
        }
        if (f === F_NG) { b.i = NG; a.f = f; continue; }                                    // 영화 → 영와
      }
      if ((f === F_G || f === F_D || f === F_B) && TENSE[b.i] !== undefined) { a.f = f; b.i = TENSE[b.i]; continue; } // 학교 → 학꾜
      if (NASAL[f] !== undefined && (b.i === N || b.i === M)) { a.f = NASAL[f]; continue; } // 국물 → 궁물
      if (NASAL[f] !== undefined && b.i === R) { a.f = NASAL[f]; b.i = N; continue; }       // 독립 → 동닙
      if ((f === F_M || f === F_NG) && b.i === R) { a.f = f; b.i = N; continue; }           // 심리 → 심니
      if (f === F_N && b.i === R) { a.f = F_L; continue; }                                  // 신라 → 실라
      if (f === F_L && b.i === N) { a.f = f; b.i = R; continue; }                           // 설날 → 설랄
      a.f = f;
    }
    return s;
  }

  var VOWEL = ["a", "e", "ya", "ye", "ơ", "ê", "yơ", "yê", "ô", "oa", "oe", "uê", "yô", "u", "uơ", "uê", "uy", "yu", "ư", "ưi", "i"];
  // Which letter of the vowel carries the tone mark.
  var MAIN = { "ưi": 0 };
  var FINAL = {}; FINAL[F_G] = "c"; FINAL[F_N] = "n"; FINAL[F_D] = "t"; FINAL[F_L] = "l"; FINAL[F_M] = "m"; FINAL[F_B] = "p"; FINAL[F_NG] = "ng";

  // ㄱ and ㄷ are voiced (g, đ) between voiced sounds, plain (c, t) elsewhere.
  function voiced(first, prevFinal) {
    return !first && (!prevFinal || prevFinal === F_N || prevFinal === F_L || prevFinal === F_M || prevFinal === F_NG);
  }

  function initial(i, first, prevFinal) {
    switch (i) {
      case G: return voiced(first, prevFinal) ? "g" : "c";
      case GG: return "kk";
      case N: return "n";
      case D: return voiced(first, prevFinal) ? "đ" : "t";
      case DD: return "tt";
      case R: return prevFinal === F_L ? "l" : "r";
      case M: return "m";
      case B: return "b";
      case BB: return "pp";
      case S: return "x";
      case SS: return "ss";
      case NG: return "";
      case J: return "ch";
      case JJ: return "jj";
      case CH: return "ch";
      case K: return "kh";
      case T: return "th";
      case P: return "p";
      case H: return "h";
    }
    return "";
  }

  function syllable(ini, vowel, fin, low) {
    // Vietnamese spelling: c → k before i/e/ê/y, g → gh before i/e/ê, c + w-vowel → qu.
    if (ini === "c" && /^[ieêy]/.test(vowel)) ini = "k";
    else if (ini === "g" && /^[ieê]/.test(vowel)) ini = "gh";
    else if (ini === "c" && /^(oa|oe|uơ|uê|uy)$/.test(vowel)) { ini = "q"; vowel = "u" + vowel.slice(1); }
    var end = FINAL[fin] || "";
    if (end === "c" && /[ieê]$/.test(vowel)) end = "k";
    var stop = /^[ptck]$/.test(end);
    var mark = low ? (stop ? "̣" : "̀") : (stop ? "́" : "");
    var at = MAIN[vowel] !== undefined ? MAIN[vowel] : vowel.length - 1;
    var v = vowel.slice(0, at + 1) + mark + vowel.slice(at + 1);
    return (ini + v + end).normalize("NFC");
  }

  // Pitch per syllable (true = low): T H, T H H, T H … L H
  function pitches(n, startHigh) {
    var out = [];
    for (var k = 0; k < n; k++) {
      if (k === 0) out.push(!startHigh);
      else if (n >= 4 && k === n - 2) out.push(true);
      else out.push(false);
    }
    return out;
  }

  function viPron(pron, spelled) {
    // Dictionary pronunciations already contain most changes; running the
    // engine over them as well only adds the casual ones (전화 → 저놔).
    return parse(pron || spelled || "").map(function (w) {
      var s = soundChanges(w);
      var low = pitches(s.length, HIGH_START.indexOf(s[0].i) >= 0);
      var prev = 0;
      return s.map(function (x, k) {
        var out = syllable(initial(x.i, k === 0, prev), VOWEL[x.m], x.f, low[k]);
        prev = x.f;
        return out;
      }).join(" ");
    }).join(" · ");
  }

  window.viPron = viPron;
  if (typeof module !== "undefined") module.exports = viPron;
})();
