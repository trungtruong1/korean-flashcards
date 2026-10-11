"""Parse krdict LMF XML files into a compact JSON list of entries."""
import sys, json, glob, os, io, re
import xml.etree.ElementTree as ET

src_dir, out_path = sys.argv[1], sys.argv[2]
LANGS = {"영어": "en", "베트남어": "vi"}

FEAT = re.compile(r'^(\s*<feat att="[^"]*" val=")(.*)(" />)\s*$')
ENT = re.compile(r'&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)')


def clean(path):
    """Escape stray <, >, & and quotes inside val="..." attributes."""
    out = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            m = FEAT.match(line)
            if m:
                v = ENT.sub("&amp;", m.group(2))
                v = v.replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
                line = m.group(1) + v + m.group(3) + "\n"
            out.append(line)
    return io.BytesIO("".join(out).encode("utf-8"))


def feats(el):
    d = {}
    for f in el.findall("feat"):
        d.setdefault(f.get("att"), []).append(f.get("val"))
    return d


def first(d, k, default=""):
    v = d.get(k)
    return v[0] if v and v[0] is not None else default


entries = []
for path in sorted(glob.glob(os.path.join(src_dir, "*.xml"))):
    for ev, el in ET.iterparse(clean(path), events=("end",)):
        if el.tag != "LexicalEntry":
            continue
        f = feats(el)
        lemma = el.find("Lemma")
        lf = feats(lemma) if lemma is not None else {}
        pron = sound = None
        for wf in el.findall("WordForm"):
            w = feats(wf)
            if first(w, "type") == "발음" and w.get("pronunciation"):
                pron = first(w, "pronunciation")
                sound = first(w, "sound") or None  # recording by a native speaker
                break
        senses = []
        for s in el.findall("Sense"):
            sf = feats(s)
            exs = []
            for ex in s.findall("SenseExample"):
                ef = feats(ex)
                exs.append([first(ef, "type"), ef.get("example", [])])
            eq = {}
            for e in s.findall("Equivalent"):
                q = feats(e)
                lang = LANGS.get(first(q, "language"))
                if lang:
                    eq[lang] = [first(q, "lemma"), first(q, "definition")]
            senses.append({"def": first(sf, "definition"), "ex": exs, "eq": eq})
        entries.append({
            "id": el.get("val"),
            "w": first(lf, "writtenForm"),
            "hn": int(first(f, "homonym_number", "0") or 0),
            "unit": first(f, "lexicalUnit"),
            "pos": first(f, "partOfSpeech"),
            "origin": first(f, "origin"),
            "lvl": first(f, "vocabularyLevel"),
            "pron": pron,
            "sound": sound,
            "senses": senses,
        })
        el.clear()
    print(os.path.basename(path), len(entries), flush=True)

with open(out_path, "w", encoding="utf-8") as fh:
    json.dump(entries, fh, ensure_ascii=False)
print("done", len(entries))
