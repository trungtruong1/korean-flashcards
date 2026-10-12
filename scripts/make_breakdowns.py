"""Break down how each card's word is used in its example sentence.

For "영화를 [봤어요]" (보다) this produces the steps
    보다 → 보            (stem)
    + 았 → 봤            (past tense; ㅗ → 아; 보았 → 봤)
    + 어요 → 봤어요       (polite ending)
with a grammar id per step that links to the grammar page (data/grammar.json).

Uses the Kiwi morphological analyzer (pip install kiwipiepy). Output is a JSON
map word → [example, surface, steps], merged into the cards by build_data.py
(only while the example is unchanged), so the site can be rebuilt without Kiwi.

    python scripts/make_breakdowns.py scripts/examples scripts/breakdowns.json
"""
import json, glob, os, re, sys, collections
from kiwipiepy import Kiwi

kiwi = Kiwi()

# ---------- Hangul helpers ----------
JONG_TO_COMPAT = {"ᆫ": "ㄴ", "ᆯ": "ㄹ", "ᆸ": "ㅂ", "ᆷ": "ㅁ", "ᆼ": "ㅇ", "ᆨ": "ㄱ", "ᆺ": "ㅅ"}
COMPAT_TO_FINAL = {"ㄱ": 1, "ㄴ": 4, "ㄹ": 8, "ㅁ": 16, "ㅂ": 17, "ㅅ": 19, "ㅇ": 21}
VOWELS = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
FINALS = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]


def is_syl(ch):
    return 0xAC00 <= ord(ch) <= 0xD7A3


def parts(ch):
    c = ord(ch) - 0xAC00
    return c // 588, (c % 588) // 28, c % 28


def compat(form):
    """Kiwi writes some endings with a bare final consonant (ᆯ게요); show ㄹ게요."""
    return "".join(JONG_TO_COMPAT.get(ch, ch) for ch in form)


def attach(prefix, suffix):
    """Glue an ending to a stem the naive way: 가 + ㄹ게요 → 갈게요, 보 + 았 → 보았."""
    if suffix and suffix[0] in COMPAT_TO_FINAL and prefix and is_syl(prefix[-1]):
        i, m, f = parts(prefix[-1])
        if f == 0:
            return prefix[:-1] + chr(0xAC00 + i * 588 + m * 28 + COMPAT_TO_FINAL[suffix[0]]) + suffix[1:]
    return prefix + suffix


def last_vowel(text):
    for ch in reversed(text):
        if is_syl(ch):
            return VOWELS[parts(ch)[1]]
    return ""


def last_final(text):
    for ch in reversed(text):
        if is_syl(ch):
            return FINALS[parts(ch)[2]]
    return ""


# ---------- Grammar ids ----------
# (form regex, tag regex) → grammar id. Forms are Kiwi's normalized forms
# (았/었 → 었, 아요/어요 → 어요).
SINGLE = [
    (r"어요", r"EF", "ayo"),
    (r"(으)?세요", r"EF", "seyo"),
    (r"[습ᆸ]니다|습니까|ᆸ니까", r"E[FC]", "seumnida"),
    (r"(을|ᆯ)게요?", r"EF", "lgeyo"),
    (r"(을|ᆯ)까요?", r"EF", "lkkayo"),
    (r"어|아", r"EF", "banmal"),
    (r"자", r"EF", "ja"),
    (r"(읍|ᆸ)시다", r"EF", "psida"),
    (r"네요?|는군요|군요|구나|는구나", r"EF", "neyo"),
    (r"나요|ᆫ가요|은가요|는가요", r"EF", "nayo"),
    (r"지요|죠", r"EF", "jiyo"),
    (r"다|ᆫ다|는다", r"EF", "plain"),
    (r"어라|아라|거라", r"EF", "ara"),
    (r"니|냐|느냐|으니", r"EF", "ni"),
    (r"요", r"E[FC]|JX", "yo"),
    (r"었", r"EP", "past"),
    (r"(으)?시", r"EP", "si"),
    (r"겠", r"EP", "get"),
    (r"고", r"EC", "go"),
    (r"어서", r"EC", "aseo"),
    (r"(으)?면", r"EC", "myeon"),
    (r"어도", r"EC", "ado"),
    (r"어야", r"EC", "aya"),
    (r"(으)?니까?", r"EC", "nikka"),
    (r"(으)?러", r"EC", "reo"),
    (r"(으)?려고", r"EC", "ryeogo"),
    (r"지만", r"EC", "jiman"),
    (r"(으)?며", r"EC", "myeo"),
    (r"(으)?면서", r"EC", "myeonseo"),
    (r"(는|은|ᆫ)데", r"EC", "neunde"),
    (r"게", r"EC", "ge"),
    (r"지", r"EC", "ji-anta"),
    (r"어", r"EC", "a-link"),
    (r"라|이라|라서", r"EC", "rado"),
    (r"라고|다고|ᆫ다고|는다고|자고|냐고", r"EC", "rago"),
    (r"다가", r"EC", "daga"),
    (r"거나", r"EC", "geona"),
    (r"도록", r"EC", "dorok"),
    (r"자마자", r"EC", "jamaja"),
    (r"ᆫ|은", r"ETM", "mod"),
    (r"는", r"ETM", "mod"),
    (r"ᆯ|을", r"ETM", "mod"),
    (r"기", r"ETN", "gi"),
    (r"음|ᆷ", r"ETN", "eum"),
    (r"이|가", r"JKS", "subj"),
    (r"께서", r"JKS", "subj"),
    (r"이|가", r"JKC", "jkc"),
    (r"을|를|ᆯ", r"JKO", "obj"),
    (r"은|는|ᆫ", r"JX", "topic"),
    (r"도", r"JX", "do"),
    (r"만", r"JX", "man"),
    (r"부터", r"JX", "buteo"),
    (r"까지", r"JX", "buteo"),
    (r"마다", r"JX", "mada"),
    (r"뿐", r"JX", "ppun"),
    (r"마저|조차", r"JX", "majeo"),
    (r"대로", r"JX", "daero"),
    (r"(이)?나", r"JX", "ina"),
    (r"밖에", r"JX", "bakke"),
    (r"에", r"JKB", "e"),
    (r"에서", r"JKB", "eseo"),
    (r"으로|로", r"JKB", "ro"),
    (r"에게|한테|께|에게서|한테서", r"JKB", "ege"),
    (r"와|과|하고|랑|이랑", r"JKB|JC", "wa"),
    (r"보다", r"JKB", "boda"),
    (r"처럼|같이", r"JKB", "cheoreom"),
    (r"만큼", r"JKB", "mankeum"),
    (r"의", r"JKG", "ui"),
    (r"아|야", r"JKV", "voc"),
    (r"하", r"XSV|XSA", "hada"),
    (r"되", r"XSV", "doeda-suffix"),
    (r"시키", r"XSV", "sikida"),
    (r"들", r"XSN", "deul"),
    (r"님", r"XSN", "nim"),
    (r"적", r"XSN", "jeok"),
    (r"씩", r"XSN", "ssik"),
    (r"째", r"XSN", "jjae"),
    (r"스럽|롭|답", r"XSA.*", "seureopda"),
    (r"아니", r"VCN", "anida"),
    (r"에요|예요", r"EF", "anida"),
]
SINGLE = [(re.compile(f"^(?:{f})$"), re.compile(f"^(?:{t})"), g) for f, t, g in SINGLE]

J = (None, r"J.*", True)  # optional particle
PATTERNS = [
    ("ji-mal", [("지", "EC"), ("말", "VX")]),
    ("ji-anta", [("지", "EC"), ("않", "VX")]),
    ("ji-motada", [("지", "EC"), ("못하", "VX")]),
    ("go-sipda", [("고", "EC"), ("싶", "VX")]),
    ("go-itda", [("고", "EC"), ("있|계시", "VX")]),
    ("go-malda", [("고", "EC"), ("말", "VX")]),
    ("go-nada", [("고", "EC"), ("나", "VX")]),
    ("a-juda", [("어", "EC"), ("주|드리", "VX")]),
    ("a-boda", [("어", "EC"), ("보", "VX")]),
    ("a-itda", [("어", "EC"), ("있|계시", "VX")]),
    ("a-jida", [("어", "EC"), ("지", "VX")]),
    ("a-beorida", [("어", "EC"), ("버리", "VX")]),
    ("a-nota", [("어", "EC"), ("놓|두", "VX")]),
    ("aya", [("어야", "EC"), ("하|되", "VX|VV")]),
    ("ado", [("어도", "EC"), ("되|괜찮", "VV|VA|VX")]),
    ("myeon-an", [("(으)?면", "EC"), ("안", "MAG"), ("되", "VV")]),
    ("ge-doeda", [("게", "EC"), ("되", "VV|VX")]),
    ("l-su", [("ᆯ|을", "ETM"), ("수", "NNB"), J, ("있|없", "VA|VV")]),
    ("l-geoyeyo", [("ᆯ|을", "ETM"), ("거|것", "NNB"), ("이", "VCP"), (None, "EF", True)]),
    ("geot-gatda", [("ᆫ|은|는|ᆯ|을", "ETM"), ("것|거", "NNB"), ("같", "VA")]),
    ("n-jeok", [("ᆫ|은", "ETM"), ("적", "NNB"), J, ("있|없", "VA|VV")]),
    ("l-jul", [("ᆯ|을", "ETM"), ("줄", "NNB"), J, ("알|모르", "VV")]),
    ("l-ttae", [("ᆯ|을", "ETM"), ("때", "NNG|NNB")]),
    ("gi-ttaemun", [("기", "ETN"), ("때문", "NNB")]),
    ("n-hu", [("ᆫ|은", "ETM"), ("후|다음|뒤", "NNG")]),
    ("gi-jeon", [("기", "ETN"), ("전", "NNG")]),
    ("neun-jung", [("는", "ETM"), ("중", "NNB")]),
    ("neun-dongan", [("는", "ETM"), ("동안", "NNG")]),
    ("cheok", [("ᆫ|은|는", "ETM"), ("척|체", "NNB"), ("하", "XSV|VV")]),
    ("l-ppeon", [("ᆯ|을", "ETM"), ("뻔", "NNB"), ("하", "XSV|VV|XSA")]),
    ("l-ri", [("ᆯ|을", "ETM"), ("리", "NNB"), J, ("없", "VA")]),
    ("n-ji", [("ᆫ|은", "ETM"), ("지", "NNB")]),
    ("giro", [("기", "ETN"), ("로", "JKB"), ("하", "VV")]),
    ("ryeogo", [("(으)?려고", "EC"), ("하", "VV|VX")]),
    ("gi-wihae", [("기", "ETN"), ("위하", "VV")]),
    ("rago", [("라고|다고|ᆫ다고|는다고|자고|냐고", "EC"), ("하", "VV")]),
]
PATTERNS = [(gid, [(re.compile(f"^(?:{f})$") if f else None, re.compile(f"^(?:{t})"), len(m) > 2 and m[2]) for m in seq for f, t in [m[:2]]])
            for gid, seq in PATTERNS]
# How a pattern step is written (the grammar page uses the same title).
PATTERN_TEXT = {
    "ji-mal": "-지 말다", "ji-anta": "-지 않다", "ji-motada": "-지 못하다", "go-sipda": "-고 싶다",
    "go-itda": "-고 있다", "go-malda": "-고 말다", "go-nada": "-고 나다", "a-juda": "-아/어 주다",
    "a-boda": "-아/어 보다", "a-itda": "-아/어 있다", "a-jida": "-아/어지다", "a-beorida": "-아/어 버리다",
    "a-nota": "-아/어 놓다", "aya": "-아/어야 하다", "ado": "-아/어도 되다", "myeon-an": "-(으)면 안 되다",
    "ge-doeda": "-게 되다", "l-su": "-(으)ㄹ 수 있다/없다", "l-geoyeyo": "-(으)ㄹ 거예요",
    "geot-gatda": "-는 것 같다", "n-jeok": "-(으)ㄴ 적이 있다", "l-jul": "-(으)ㄹ 줄 알다",
    "l-ttae": "-(으)ㄹ 때", "gi-ttaemun": "-기 때문", "n-hu": "-(으)ㄴ 후", "gi-jeon": "-기 전",
    "neun-jung": "-는 중", "neun-dongan": "-는 동안", "cheok": "-는 척하다", "l-ppeon": "-(으)ㄹ 뻔하다",
    "l-ri": "-(으)ㄹ 리가 없다", "n-ji": "-(으)ㄴ 지", "giro": "-기로 하다", "ryeogo": "-(으)려고 하다",
    "gi-wihae": "-기 위해", "rago": "-다고/라고 하다",
}
PRED = re.compile(r"^(VV|VA|VX|XSV|XSA|VCP)")


def single_gid(form, tag):
    for fre, tre, gid in SINGLE:
        if fre.match(form) and tre.match(tag):
            return gid
    return None


def match_pattern(toks, i):
    best = None
    for gid, seq in PATTERNS:
        j = i
        ok = True
        for fre, tre, optional in seq:
            if j < len(toks) and (fre is None or fre.match(toks[j].form)) and tre.match(toks[j].tag):
                j += 1
            elif optional:
                continue
            else:
                ok = False
                break
        if ok and j > i and (best is None or j > best[1]):
            best = (gid, j)
    return best


def deciding_vowel(form):
    """The vowel that picks 아 or 어. A final ㅡ doesn't count: 바쁘 → ㅏ, 모르 → ㅗ."""
    syls = [ch for ch in form if is_syl(ch)]
    if not syls:
        return ""
    i, m, f = parts(syls[-1])
    if VOWELS[m] == "ㅡ" and f == 0 and len(syls) >= 2:
        return VOWELS[parts(syls[-2])[1]]
    return VOWELS[m]


def harmony(prev_form, prev_tag):
    """아/어/여: ㅏ or ㅗ → 아, 하 → 여, everything else → 어."""
    if prev_form.endswith("하") and prev_tag.startswith(("VV", "VA", "XSV", "XSA", "VX")):
        return "여"
    if prev_tag.startswith("EP"):
        return "어"
    return "아" if deciding_vowel(prev_form) in ("ㅏ", "ㅗ", "ㅑ") else "어"


def aeo_kind(piece):
    """아, 어 or 여 if the ending starts with one of them (았, 어요, 여서...)."""
    if piece and is_syl(piece[0]):
        i, m, f = parts(piece[0])
        if i == 11 and m in (0, 4, 6):
            return {0: "아", 4: "어", 6: "여"}[m]
    return ""


def display(form, tag, prev):
    """The ending as the learner would write it after this stem: 었 → 았/었/였, 어요 → 아요/어요/여요."""
    form = compat(form)
    if tag.startswith("E") and aeo_kind(form) == "어" and prev is not None and not prev.tag.startswith("VCP"):
        i, m, f = parts(form[0])
        m = {"아": 0, "어": 4, "여": 6}[harmony(prev.form, prev.tag)]
        return chr(0xAC00 + i * 588 + m * 28 + f) + form[1:]
    return form


def aeo_note(prev, piece):
    """Why 아, 어 or 여 was chosen, e.g. ㅗ → 아, 하 → 여."""
    k = aeo_kind(piece)
    if not k or prev is None or not PRED.match(prev.tag) or prev.tag.startswith("VCP"):
        return None
    return ["aeo", ("하" if k == "여" else deciding_vowel(prev.form)) + " → " + k]


def join(toks):
    """Rebuild the surface form. Spaces only between the sentence's own words:
    Kiwi would write 짜증나요 as 짜증 나요."""
    groups, cur, cur_e = [], [], None
    for t in toks:
        e = getattr(t, "eoj", None)
        if cur and e != cur_e:
            groups.append(cur)
            cur = []
        cur.append(t)
        cur_e = e
    if cur:
        groups.append(cur)
    return " ".join(kiwi.join([(t.form, t.tag) for t in g]).replace(" ", "") for g in groups)


def change_note(prev_text, piece, result, stem_tok, first_tok):
    """Explain a sound change when stem + ending isn't plain gluing."""
    naive = attach(prev_text, piece)
    if naive == result or not result:
        return None
    stem = stem_tok.form if stem_tok is not None else prev_text
    tag = stem_tok.tag if stem_tok is not None else ""
    if stem.endswith("르") and result.startswith(stem):
        return None  # 러 irregular (이르다 → 이르러): too rare to explain here
    end = aeo_kind(piece) or piece[:1]
    fin = last_final(stem)
    if stem.endswith("하") and end in "아어여":
        gid = "contract"
    elif tag.endswith("-I") and fin == "ㅂ":
        gid = "irr-b"
    elif tag.endswith("-I") and fin == "ㄷ":
        gid = "irr-d"
    elif tag.endswith("-I") and fin == "ㅅ":
        gid = "irr-s"
    elif (tag.endswith("-I") or fin == "ㅎ") and fin == "ㅎ":
        gid = "irr-h"
    elif stem.endswith("르") and end in "아어" and len(stem) >= 2 and last_final(result[:len(stem) - 1]) == "ㄹ":
        gid = "irr-reu"  # 모르 + 아 → 몰라 (an extra ㄹ); 치르 + 어 → 치러 is just ㅡ dropping
    elif fin == "ㄹ" and (end in "ㄴㅂㅅㄹ" or end in "니네나세습" or piece.startswith(("는", "ㄴ", "ㅂ", "세", "시", "십"))):
        gid = "l-drop"
    elif last_vowel(stem) == "ㅡ" and fin == "" and end in "아어":  # 바쁘 → 바빠, 치르 → 치러
        gid = "eu-drop"
    elif end in "아어여":
        gid = "contract"
    else:
        return None
    return [gid, f"{naive} → {result}"]


def breakdown(word, example):
    plain = example.replace("[", "").replace("]", "")
    hs = example.index("[")
    he = example.index("]") - 1  # last highlighted char (in plain text) + 1
    toks = kiwi.tokenize(plain)
    eoj_of = lambda pos: plain.count(" ", 0, pos)
    toks = [t for t in toks if not t.tag.startswith(("SF", "SP", "SS", "SE", "SO", "SW"))]
    for t in toks:
        t.eoj = eoj_of(t.start)
    first_e, last_e = eoj_of(hs), eoj_of(max(hs, he - 1))
    stem_word = word[:-1] if word.endswith("다") and len(word) > 1 else word
    # Find the word itself: tokens j..k (inside the highlighted words) that join to it.
    base = None
    for j, t in enumerate(toks):
        e = eoj_of(t.start)
        if e < first_e or e > last_e:
            continue
        for k in range(j + 1, min(j + 6, len(toks)) + 1):
            joined = join(toks[j:k]).replace(" ", "")
            if joined in (stem_word.replace(" ", ""), word.replace(" ", "")):
                base = (j, k)
                break
            if len(joined) > len(word) + 2:
                break
        if base:
            break
    if not base:
        return None
    j, k = base
    is_pred = PRED.match(toks[k - 1].tag) is not None and word.endswith("다")
    steps = []
    if is_pred:
        steps.append([word, stem_word, "stem"])
    cur_e = eoj_of(toks[k - 1].start)
    i = k
    shown = join(toks[j:k])
    stem_tok = toks[k - 1]
    while i < len(toks):
        p = match_pattern(toks, i)
        if p and eoj_of(toks[i].start) == cur_e:
            gid, ni = p
            result = join(toks[j:ni])
            step = [PATTERN_TEXT[gid], result, gid]
            first = toks[i]
            first_piece = display(first.form, first.tag, toks[i - 1])
            an = aeo_note(toks[i - 1], first_piece)
            if an:
                step.append(an)
            note = change_note(shown, first_piece, join(toks[j:i + 1]), stem_tok, first)
            if note:
                step.append(note)
            steps.append(step)
            shown = result
            cur_e = eoj_of(toks[ni - 1].start)
            stem_tok = toks[ni - 1] if PRED.match(toks[ni - 1].tag) else stem_tok
            i = ni
            continue
        t = toks[i]
        if eoj_of(t.start) != cur_e:
            break
        if t.tag.startswith("VCP"):
            # Copula: 이 + ending as one piece (이에요/예요, 이야/야, 입니다, 이었/였).
            n = i + 1
            while n < len(toks) and eoj_of(toks[n].start) == cur_e and toks[n].tag.startswith("E") and not toks[n].tag.startswith("EP"):
                n += 1
            if n == i + 1 and n < len(toks) and toks[n].tag.startswith("EP"):
                n += 1
            surface = plain[t.start:toks[n - 1].start + toks[n - 1].len] if n > i + 1 else ""
            piece = surface or "이"
            result = join(toks[j:n])
            steps.append([piece, result, "copula"])
            shown = result
            stem_tok = None
            i = n
            continue
        gid = single_gid(t.form, t.tag)
        piece = display(t.form, t.tag, toks[i - 1])
        result = join(toks[j:i + 1])
        step = [piece, result, gid]
        an = aeo_note(toks[i - 1], piece) if t.tag.startswith("E") and i > 0 else None
        if an:
            step.append(an)
        note = change_note(shown, piece, result, stem_tok if PRED.match(toks[i - 1].tag) else None, t)
        if note and t.tag.startswith(("E", "XS")):
            step.append(note)
        steps.append(step)
        shown = result
        if PRED.match(t.tag):
            stem_tok = t
        i += 1
    real = [s for s in steps if s[2] != "stem"]
    if not real:
        return None
    # The last result is the real text from the sentence (Kiwi's join can differ, e.g. 친구예요).
    words = plain.split(" ")
    start_e = eoj_of(toks[j].start)
    surface = " ".join(words[start_e:cur_e + 1]).rstrip(".,!?~…")
    steps[-1][1] = surface
    return [surface, steps]


def main():
    examples_dir, out = sys.argv[1], sys.argv[2]
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from build_data import load_examples
    examples = load_examples(examples_dir)
    result, missing, gids, unknown = {}, [], collections.Counter(), collections.Counter()
    for word, (ko, _vi, _en) in examples.items():
        if "[" not in ko:
            continue
        try:
            bd = breakdown(word, ko)
        except Exception as e:  # keep going; report at the end
            print("ERROR", word, ko, e)
            bd = None
        if bd is None:
            missing.append(word)
            continue
        result[word] = [ko] + bd
        for s in bd[1]:
            gids[s[2]] += 1
            if s[2] is None:
                unknown[s[0]] += 1
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"breakdowns: {len(result)} / {len(examples)}; none: {len(missing)}")
    print("grammar ids:", dict(gids.most_common()))
    print("unlinked pieces:", dict(unknown.most_common(40)))


if __name__ == "__main__":
    main()
