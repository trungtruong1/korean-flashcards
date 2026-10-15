"""Count the words used in each episode of a drama or movie.

Reads the Korean subtitle files in a private folder (never committed; see
.gitignore) and writes only word counts per episode, for example
scripts/movies/movie-1.json. build_data.py turns those counts into the Movie
decks, with meanings and example sentences from our own data, so no dialogue
from the show is published.

    python scripts/make_movie.py private/subtitles/movie-1 scripts/movies/movie-1.json --title "Movie 1"

Subtitle formats: .srt, .vtt, .smi, .ass/.ssa, .txt. The episode number is the
first number in each file name (E01, ep_1, 01.srt...).
"""
import argparse, collections, glob, html, json, os, re
from kiwipiepy import Kiwi

SUB_EXT = (".srt", ".vtt", ".smi", ".sami", ".ass", ".ssa", ".txt")


def read_text(path):
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "utf-16", "cp949", "euc-kr"):
        try:
            text = raw.decode(enc)
            if enc == "utf-16" and not raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
                continue
            return text
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def subtitle_lines(path):
    """The spoken text of each subtitle cue, one string per cue."""
    text = read_text(path)
    ext = os.path.splitext(path)[1].lower()
    if ext in (".smi", ".sami"):
        cues = re.split(r"(?i)<sync[^>]*>", text)[1:]
        out = []
        for c in cues:
            c = re.sub(r"(?i)<br\s*/?>", " ", c)
            c = re.sub(r"<[^>]+>", " ", c)
            out.append(html.unescape(c).replace("\xa0", " "))
        return out
    if ext in (".ass", ".ssa"):
        out = []
        for line in text.splitlines():
            if line.startswith("Dialogue:"):
                body = line.split(",", 9)[-1]
                body = re.sub(r"\{[^}]*\}", "", body).replace("\\N", " ").replace("\\n", " ")
                out.append(body)
        return out
    if ext in (".srt", ".vtt"):
        out = []
        for block in re.split(r"\n\s*\n", text.replace("\r\n", "\n")):
            lines = [l for l in block.split("\n") if l.strip()]
            lines = [l for l in lines if "-->" not in l and not re.fullmatch(r"\d+", l.strip())
                     and not l.startswith(("WEBVTT", "NOTE", "STYLE", "Kind:", "Language:"))]
            if lines:
                out.append(" ".join(re.sub(r"<[^>]+>", "", l) for l in lines))
        return out
    return [l for l in text.splitlines() if l.strip()]


def clean(line):
    """Drop speaker names, sound descriptions and music lines; keep the words."""
    if "♪" in line or "♬" in line:
        return ""
    line = re.sub(r"\([^)]*\)|\[[^\]]*\]|（[^）]*）", " ", line)
    line = re.sub(r"^\s*[-–]\s*", "", line)
    line = re.sub(r"\s+-\s+", " ", line)
    return re.sub(r"\s+", " ", line).strip()


# Main verbs and adjectives. Helping verbs (VX: the 주 in 해 주세요, the 말 in
# 하지 마세요) are grammar, covered by the grammar page, so they aren't counted.
PRED = re.compile(r"^(VV|VA)")


def lemmas(tokens):
    """Dictionary forms of the content words in one line of analyzed text."""
    out = []
    for i, t in enumerate(tokens):
        tag = t.tag.split("-")[0]
        prev = tokens[i - 1] if i else None
        joined = prev is not None and prev.start + prev.len == t.start
        if tag in ("XSV", "XSA") and joined and prev.tag.split("-")[0] in ("NNG", "XR"):
            # 공부 + 하 → 공부하다; 깨끗 + 하 → 깨끗하다 (replaces the bare noun/root)
            if out and out[-1] == prev.form:
                out.pop()
            out.append(prev.form + t.form + "다")
        elif PRED.match(tag):
            out.append(t.form + "다")
        elif tag == "VCN":
            out.append("아니다")
        elif tag in ("NNG", "NNB", "NP", "NR", "MAG", "MM", "IC", "XR"):
            out.append(t.form)
    return out


def episode_number(path, fallback):
    m = re.search(r"(?i)(?:e|ep|episode|화)?\s*0*(\d{1,3})", os.path.basename(path))
    return int(m.group(1)) if m else fallback


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("out")
    ap.add_argument("--title", required=True)
    a = ap.parse_args()
    kiwi = Kiwi()
    files = [p for p in glob.glob(os.path.join(a.folder, "*")) if p.lower().endswith(SUB_EXT)]
    if not files:
        raise SystemExit(f"No subtitle files in {a.folder}")
    episodes = []
    for i, path in enumerate(sorted(files)):
        lines = [l for l in (clean(x) for x in subtitle_lines(path)) if re.search(r"[가-힣]", l)]
        counts = collections.Counter()
        for toks in kiwi.tokenize(lines):
            counts.update(lemmas(toks))
        episodes.append({"ep": episode_number(path, i + 1), "lines": len(lines), "words": dict(counts.most_common())})
        print(f"{os.path.basename(path)}: episode {episodes[-1]['ep']}, {len(lines)} lines, {len(counts)} distinct words")
    episodes.sort(key=lambda e: e["ep"])
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump({"title": a.title, "episodes": episodes}, fh, ensure_ascii=False, separators=(",", ":"))
    print("wrote", a.out)


if __name__ == "__main__":
    main()
