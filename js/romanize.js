// Revised Romanization of Korean.
// Works from the pronounced form (krdict pronunciations already include sound
// changes like 좋다 → 조타), but, as the official rules require, ignores
// tensing: 있다 [읻따] → "itda", not "ittta".
(function () {
  var INI = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
  var MED = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
  var FIN = ["", "k", "k", "k", "n", "n", "n", "t", "l", "l", "l", "l", "l", "l", "l", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];
  var RIEUL = 8;
  var TENSE_TO_LAX = { 1: 0, 4: 3, 8: 7, 10: 9, 13: 12 }; // ㄲㄸㅃㅆㅉ → ㄱㄷㅂㅅㅈ

  function syllables(text) {
    var out = [];
    for (var k = 0; k < text.length; k++) {
      var code = text.charCodeAt(k) - 0xac00;
      if (code >= 0 && code < 11172) out.push({ i: Math.floor(code / 588), m: Math.floor((code % 588) / 28), f: code % 28 });
      else if (/\s/.test(text[k])) out.push(null);
    }
    return out;
  }

  function romanize(pron, spelled) {
    var p = syllables(pron);
    var s = spelled ? syllables(spelled) : null;
    if (s && s.length !== p.length) s = null;
    var out = "";
    var prevFinal = -1;
    for (var k = 0; k < p.length; k++) {
      var syl = p[k];
      if (!syl) { out += " "; prevFinal = -1; continue; }
      var i = syl.i;
      if (s && s[k] && TENSE_TO_LAX[i] === s[k].i) i = s[k].i;
      var ini = INI[i];
      if (i === 5 && prevFinal === RIEUL) ini = "l"; // ㄹㄹ → ll
      out += ini + MED[syl.m] + FIN[syl.f];
      prevFinal = syl.f;
    }
    return out;
  }

  window.romanize = romanize;
})();
