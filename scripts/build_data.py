"""Build flashcard data: frequency-ranked words + krdict meanings/examples.

Inputs (see README):
  --krdict   krdict.json   parsed 한국어기초사전 entries (scripts/parse_krdict.py)
  --nikl     nikl.json     NIKL 한국어 학습용 어휘 목록 (used to order homonyms)
  --freq     dir with api_*.json pages from the Kimchi Reader frequency list
  --extras   scripts/extras.json   hand-written entries for words krdict lacks
  --out      data/          output directory
"""
import argparse, collections, glob, json, os, re

TOTAL = 7000
SET_SIZE = 50

POS_EN = {
    "명사": "noun", "동사": "verb", "형용사": "adjective", "부사": "adverb",
    "대명사": "pronoun", "관형사": "determiner", "수사": "numeral",
    "감탄사": "interjection", "의존 명사": "bound noun", "보조 동사": "auxiliary verb",
    "보조 형용사": "auxiliary adjective", "조사": "particle", "어미": "ending",
    "접사": "affix", "품사 없음": "",
}
POS_NIKL = {
    "명사": "명", "동사": "동", "형용사": "형", "부사": "부", "대명사": "대",
    "관형사": "관", "수사": "수", "감탄사": "감", "의존 명사": "의",
    "보조 동사": "보", "보조 형용사": "보",
}
LEVEL = {"초급": 1, "중급": 2, "고급": 3}
GRAMMATICAL = {"조사", "어미", "접사"}

# Revised Romanization (letter-by-letter), only used to spot placeholder
# English "translations" in krdict such as "su" for 수 or "hada" for 하다.
INI = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"]
MED = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"]
FIN = ["", "k", "k", "k", "n", "n", "n", "t", "l", "l", "l", "l", "l", "l", "l", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"]


def romanize(s):
    out = []
    for ch in s:
        c = ord(ch) - 0xAC00
        if 0 <= c < 11172:
            out.append(INI[c // 588] + MED[(c % 588) // 28] + FIN[c % 28])
    return "".join(out)


def norm(s):
    return re.sub(r"[-^\s]", "", s)


def split_items(s):
    return [x.strip() for x in re.split(r"[;,]", s or "") if x.strip()]


def uniq(items, limit):
    seen, out = set(), []
    for x in items:
        k = x.lower().rstrip(".")
        if k not in seen:
            seen.add(k)
            out.append(x)
        if len(out) == limit:
            break
    return out


def clean_text(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


def is_placeholder(en_lemma, e):
    k = re.sub(r"[^a-z]", "", en_lemma.lower())
    forms = {romanize(norm(e["w"])), romanize((e.get("pron") or "").split("/")[0])}
    return k in forms or k in {f.replace("eo", "o") for f in forms}


def entry_meaning(e, word, with_extra):
    """Turn a krdict entry into {p, h, en, vi[, d, dv, x]}."""
    en_items, vi_items, en_def, vi_def = [], [], "", ""
    for s in e["senses"][:3]:
        en = s["eq"].get("en", ["", ""])
        vi = s["eq"].get("vi", ["", ""])
        if en[0] and not is_placeholder(en[0], e):
            en_items += split_items(en[0])
        if vi[0]:
            vi_items += split_items(vi[0])
        en_def = en_def or clean_text(en[1])
        vi_def = vi_def or clean_text(vi[1])
    fallback = not en_items
    if not en_items and en_def:
        en_items = [en_def.rstrip(".")]
    if not vi_items and vi_def:
        vi_items = [vi_def.rstrip(".")]
    m = {
        "p": POS_EN.get(e["pos"], e["pos"]),
        "en": "; ".join(uniq(en_items, 3)),
        "vi": ", ".join(uniq(vi_items, 3)),
    }
    if fallback:
        m["_fb"] = 1
    if e["origin"] and re.search(r"[㐀-鿿]", e["origin"]):
        m["h"] = e["origin"]
    if with_extra:
        m["d"] = en_def
        m["dv"] = vi_def
        m["x"] = pick_example(e)
    return m


def pick_example(e):
    """Shortest full sentence from the first sense that has one."""
    for s in e["senses"]:
        sents = [clean_text(x[1][0]) for x in s["ex"] if x[0] == "문장" and x[1]]
        sents = [x for x in sents if len(x) >= 6]
        if sents:
            return min(sents, key=len)
    for s in e["senses"]:
        for typ, lines in s["ex"]:
            if lines:
                return clean_text(lines[0])
    return ""


def nikl_index(rows):
    idx = collections.defaultdict(list)
    for r in rows:
        m = re.match(r"^(.*?)(\d*)$", r["word"])
        idx[(m.group(1), r["pos"])].append((r["rank"], int(m.group(2) or 0), r["orig"]))
    return idx


HANJA = re.compile(r"[㐀-鿿]")
AUX = {"보조 동사", "보조 형용사"}


def nikl_ranks(idx, entries):
    """Assign each NIKL row (word, POS, rank) to at most one krdict homonym.

    Rows with hanja go to the entry with that hanja; native rows go, most
    frequent first, to the most basic remaining native entry (homonym numbers
    differ between NIKL and krdict, so they are not compared).
    """
    ranks = {}
    groups = collections.defaultdict(list)
    for e in entries:
        if POS_NIKL.get(e["pos"]):
            groups[(e["w"], POS_NIKL[e["pos"]])].append(e)
    for key, ents in groups.items():
        rows = sorted(idx.get(key, []))
        free = list(ents)
        pending = []
        for rank, num, orig in rows:
            hit = None
            if HANJA.search(orig or ""):
                hit = next((e for e in free if orig in e["origin"].split("/")), None) \
                    or next((e for e in free if orig[0] in e["origin"]), None)
            if hit:
                ranks[hit["id"]] = rank
                free.remove(hit)
            else:
                pending.append((rank, orig))
        for rank, orig in pending:
            if HANJA.search(orig or ""):
                continue
            pool = [e for e in free if not HANJA.search(e["origin"] or "")] or free
            if not pool:
                continue
            # NIKL's 풀이 column often holds a usage hint like '옷을 입은 ~로';
            # find the homonym whose definition/examples contain it.
            scores = [(hint_score(orig, key[0], e), e) for e in pool]
            best = max(scores, key=lambda x: x[0])
            if best[0] > 0:
                hit = best[1]
            else:
                hit = min(pool, key=lambda e: (LEVEL.get(e["lvl"], 9), -len(e["senses"]), e["hn"]))
            ranks[hit["id"]] = rank
            free.remove(hit)
    return ranks


def hint_score(hint, word, e):
    if not hint:
        return 0
    text = " ".join([s["def"] for s in e["senses"]] +
                    [line for s in e["senses"] for _, lines in s["ex"] for line in lines])
    stem = word[:-1] if word.endswith("다") else word
    score = 0
    phrase = hint.replace("~", stem).strip()
    if "~" in hint and phrase in text:
        score += 10
    for tok in re.findall(r"[가-힣]{2,}", hint):
        if tok in text:
            score += 1
    return score


def choose_entries(cands, idx, prefer=None):
    chosen = _choose_entries(cands, idx)
    if prefer is not None:
        match = [e for e in cands if (e["hn"] == prefer if isinstance(prefer, int) else prefer in e["origin"].split("/"))]
        if match:
            chosen = [(match[0], None, None)] + [x for x in chosen if x[0] is not match[0]]
    return chosen


def _choose_entries(cands, idx):
    if not cands:
        return []
    # Names of Hangul letters (e.g. 으 = "the vowel ㅡ") are never what a
    # frequent token means.
    cands = [e for e in cands if not any("한글 자모" in s["def"] for s in e["senses"][:1])]
    if not cands:
        return []
    lexical = [e for e in cands if e["pos"] not in GRAMMATICAL] or cands
    ranks = nikl_ranks(idx, lexical)
    scored = []
    for e in lexical:
        has_tr = any(s["eq"].get("vi") or s["eq"].get("en") for s in e["senses"])
        if has_tr:
            scored.append((e, ranks.get(e["id"]), LEVEL.get(e["lvl"])))
    chosen = [x for x in scored if x[1] is not None or x[2] is not None]
    if not chosen:
        best = max(scored, key=lambda x: (len(x[0]["senses"]), -x[0]["hn"]), default=None)
        chosen = [best] if best else []
    # Auxiliary (grammar) uses go after the word's own meanings.
    chosen.sort(key=lambda x: (x[0]["pos"] in AUX, x[1] if x[1] is not None else 10**6,
                               x[2] or 9, -len(x[0]["senses"]), x[0]["hn"]))
    return chosen


def load_examples(folder):
    out = {}
    for path in sorted(glob.glob(os.path.join(folder, "*.txt"))):
        with open(path, encoding="utf-8") as fh:
            for n, line in enumerate(fh, 1):
                line = line.rstrip("\n")
                if not line.strip() or line.startswith("#"):
                    continue
                parts = line.split("|")
                if len(parts) != 4:
                    raise SystemExit(f"{os.path.basename(path)}:{n}: expected 'word | Korean | Vietnamese | English', got {len(parts)} fields")
                word, ko, vi, en = (p.strip() for p in parts)
                out[norm(word)] = [ko, vi, en]
    return out


def check_example(word, ex):
    """Every line needs one [highlight]; the Korean one should start like the word."""
    for label, text in zip(("ko", "vi", "en"), ex):
        if "→" in text or "->" in text:
            return f"{label} looks like a leftover draft: {text}"
        if text.count("[") != 1 or text.count("]") != 1 or text.index("[") > text.index("]"):
            return f"{label} needs exactly one [highlight]: {text}"
    hl = ex[0][ex[0].index("[") + 1:ex[0].index("]")]
    first = next((ch for ch in hl if 0xAC00 <= ord(ch) <= 0xD7A3), "")
    w0 = word[0]
    if first and 0xAC00 <= ord(w0) <= 0xD7A3 and (ord(first) - 0xAC00) // 588 != (ord(w0) - 0xAC00) // 588:
        return f"highlight '{hl}' doesn't look like {word}"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--krdict", required=True)
    ap.add_argument("--nikl", required=True)
    ap.add_argument("--freq", required=True)
    ap.add_argument("--extras", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--examples", default=os.path.join(os.path.dirname(__file__), "examples"),
                    help="dir of .txt files with lines 'word | Korean | Vietnamese | English' (highlight in [brackets])")
    ap.add_argument("--report", default=None)
    a = ap.parse_args()
    simple_examples = load_examples(a.examples)

    kd = json.load(open(a.krdict, encoding="utf-8"))
    idx = nikl_index(json.load(open(a.nikl, encoding="utf-8")))
    extras = json.load(open(a.extras, encoding="utf-8"))
    skip = set(extras.pop("_skip", []))
    prefer = extras.pop("_prefer", {})
    en_override = extras.pop("_en", {})
    vi_override = extras.pop("_vi", {})
    examples = extras.pop("_examples", {})
    extras.pop("_comment", None)
    words = []
    for p in sorted(glob.glob(os.path.join(a.freq, "api_*.json")), key=lambda x: int(re.findall(r"\d+", os.path.basename(x))[0])):
        words += json.load(open(p, encoding="utf-8"))["items"]
    words.sort(key=lambda w: w["rank"])

    by = collections.defaultdict(list)
    for e in kd:
        if e["unit"] in ("단어", "") and not e["w"].startswith("-") and not e["w"].endswith("-"):
            by[norm(e["w"])].append(e)

    cards, skipped, unknown, seen = [], [], [], set()
    for w in words:
        if len(cards) == TOTAL:
            break
        word = w["word"]
        key = norm(word)
        if key in seen:
            continue
        if word in skip:
            skipped.append(w)
            continue
        chosen =choose_entries(by.get(key, []), idx, prefer.get(key)) if word not in extras else []
        if chosen:
            first = chosen[0][0]
            meanings, seen_en = [], set()
            for i, (e, nr, lv) in enumerate(chosen):
                m = entry_meaning(e, word, with_extra=(i == 0))
                k = (m["en"].lower(), m["p"])
                if not m["en"] and not m["vi"] or k in seen_en:
                    continue
                # Secondary meanings with no short English gloss are usually
                # grammar uses explained in a long sentence; leave them out.
                if meanings and m.get("_fb") and len(m["en"]) > 45:
                    continue
                seen_en.add(k)
                meanings.append(m)
                if len(meanings) == 3:
                    break
            if key in en_override:
                meanings[0]["en"] = en_override[key]
                meanings[0].pop("_fb", None)
            if key in vi_override:
                meanings[0]["vi"] = vi_override[key]
            if key in examples:
                meanings[0]["x"] = examples[key]
            card = {"r": w["rank"], "w": key, "m": meanings}
            pron = (first.get("pron") or "").split("/")[0].replace("ː", "").strip()
            if pron and pron != key:
                card["pr"] = pron
            if LEVEL.get(first["lvl"]):
                card["lv"] = LEVEL[first["lvl"]]
        elif word in extras:
            p, en, vi, x = extras[word]
            card = {"r": w["rank"], "w": key, "ai": 1, "m": [{"p": p, "en": en, "vi": vi, "x": x}]}
        else:
            (skipped if word in skip else unknown).append(w)
            continue
        seen.add(key)
        cards.append(card)

    # Simple, translated example sentences replace the dictionary examples.
    missing_ex, bad_ex = [], []
    for c in cards:
        ex = simple_examples.get(c["w"])
        if not ex:
            missing_ex.append(c["w"])
            continue
        problem = check_example(c["w"], ex)
        if problem:
            bad_ex.append(f"{c['w']}: {problem}")
        m0 = c["m"][0]
        m0["x"], m0["xv"], m0["xe"] = ex
    if missing_ex:
        print(f"WARNING: {len(missing_ex)} cards have no simple example, e.g. {missing_ex[:10]}")
    for b in bad_ex:
        print("CHECK:", b)

    fallback_en = [c for c in cards if c["m"][0].get("_fb")]
    for c in cards:
        for m in c["m"]:
            m.pop("_fb", None)

    os.makedirs(os.path.join(a.out, "sets"), exist_ok=True)
    for old in glob.glob(os.path.join(a.out, "sets", "*.json")):
        os.remove(old)
    nsets = (len(cards) + SET_SIZE - 1) // SET_SIZE
    for i in range(nsets):
        chunk = cards[i * SET_SIZE:(i + 1) * SET_SIZE]
        with open(os.path.join(a.out, "sets", f"{i + 1:03d}.json"), "w", encoding="utf-8") as fh:
            json.dump(chunk, fh, ensure_ascii=False, separators=(",", ":"))
    meta = {
        "total": len(cards), "setSize": SET_SIZE, "sets": nsets,
        "firstWords": [cards[i * SET_SIZE]["w"] for i in range(nsets)],
        "maxRank": cards[-1]["r"] if cards else 0,
    }
    with open(os.path.join(a.out, "meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, separators=(",", ":"))
    # Search index, one row per card in order: [word, vi, en, other vi, other en].
    search = []
    for c in cards:
        m0, rest = c["m"][0], c["m"][1:]
        row = [c["w"], m0["vi"], m0["en"], "; ".join(m["vi"] for m in rest), "; ".join(m["en"] for m in rest)]
        while row[-1] == "":
            row.pop()
        search.append(row)
    with open(os.path.join(a.out, "search.json"), "w", encoding="utf-8") as fh:
        json.dump(search, fh, ensure_ascii=False, separators=(",", ":"))

    stats = collections.Counter()
    for c in cards:
        stats["ai" if c.get("ai") else "krdict"] += 1
        stats["no_vi"] += not c["m"][0]["vi"]
        stats["no_en"] += not c["m"][0]["en"]
        stats["no_ex"] += not c["m"][0].get("x")
        stats["multi"] += len(c["m"]) > 1
    print(f"cards={len(cards)} sets={nsets} lastRank={meta['maxRank']} skipped={len(skipped)} unknown={len(unknown)}")
    print(dict(stats))
    if a.report:
        with open(a.report, "w", encoding="utf-8") as fh:
            json.dump({"unknown": unknown, "skipped": skipped, "fallback_en": fallback_en,
                       "no_vi": [c for c in cards if not c["m"][0]["vi"]],
                       "no_en": [c for c in cards if not c["m"][0]["en"]],
                       "no_ex": [c for c in cards if not c["m"][0].get("x")]},
                      fh, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
