# 고래 단어장 · Gorae Words

Flashcards for the **7,000 most common Korean words**, with **Vietnamese** and **English** meanings and a short example sentence for each word, translated into both languages. The words come in 140 sets of 50, from most to least common.

**Live site:** https://trungtruong1.github.io/korean-flashcards/

## How to study

- Open a set and **tap the card** to flip it.
- **Swipe right** (or press →) when you know the word, and **swipe left** (←) when you don't yet.
- Made a mistake? Press **undo** (↶ or `Z`).
- Opening a set again shows only the words you haven't marked "got it". The end screen lets you review the "not yet" words or redo the whole set.
- The 🔊 button on a word plays a **recording by a native speaker** from the Korean dictionary (6,181 of the 7,000 words). Example sentences and the remaining words use your device's Korean voice; pick the voice and speed in **Settings → Audio**. The copy buttons copy the word or the example sentence.
- Under each example, **How it's built** breaks the word down step by step, e.g. 봤어요: 보다 → stem 보 → + 았 (past tense; ㅗ → 아; 보았 → 봤) → + 어요 (polite ending). Tap a step to read about that grammar point.
- The **Grammar** page (📖 on the home page) explains the 117 grammar points used in the examples, from Beginner to Advanced, in Vietnamese and English with examples.
- **Search** (on the home page, or press `/`) finds words in Korean, Vietnamese (with or without accents) or English. Tap a result to see the full card and mark it.
- Under each word is a **pronunciation guide in Vietnamese letters** with Seoul pitch shown as tone marks, e.g. 보다 → *pồ ta*, 사다 → *sa ta*, 이거 → *ì ko* (ㅓ = o, ㅗ = ô; ㄱ k, ㅋ kh, ㄲ kk and so on). **Settings → How to read it** explains the marks.
- In **Settings** you can show the meaning on the front instead, put English first, hide the pronunciation guide, turn on auto-play or shuffle, and switch between light and dark themes.
- Progress is saved in your browser. Sign in (once accounts are turned on, see below) to keep it in your account across devices, or use **Settings → Export backup / Import backup**.
- On a phone, "Add to Home Screen" makes it work like an app.

## Turn on accounts (sign-in + sync)

Sign-in uses [Firebase](https://firebase.google.com) (free Spark plan). Until it's set up, the site works without accounts.

1. Go to https://console.firebase.google.com → **Add project** (Google Analytics not needed).
2. **Build → Authentication → Get started**, then enable **Google** and **Email/Password**.
3. **Authentication → Settings → Authorized domains → Add domain**: `trungtruong1.github.io`.
4. **Build → Firestore Database → Create database** (production mode, any location). In the **Rules** tab, paste the contents of [`firestore.rules`](firestore.rules) and **Publish**.
5. **Project settings (⚙) → Your apps → Web (`</>`)** → register an app → copy the `firebaseConfig` values into [`js/firebase-config.js`](js/firebase-config.js):

   ```js
   window.GORAE_FIREBASE = {
     apiKey: "…",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     appId: "…",
   };
   ```

6. Commit and push. A person icon appears next to Settings.

The config values aren't secret. The Firestore rules make sure each person can read and write only their own progress (`users/{uid}`). When you sign in on a device for the first time, what you studied there is merged into your account.

## Run it on your computer

The site is plain HTML/CSS/JS, so there's nothing to build. Browsers block loading the word files from `file://`, so start a small local server in this folder:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Where the data comes from

| What | Source | License |
|---|---|---|
| Word ranking | [Kimchi Reader frequency list](https://kimchi-reader.app/explore/freq/words), based on Korean YouTube videos, TV shows and books | used with credit |
| Meanings (EN + VI), hanja, pronunciation, level, word recordings (streamed from dicmedia.korean.go.kr) | [한국어기초사전 (Korean Learners' Dictionary)](https://krdict.korean.go.kr), National Institute of Korean Language, via the [krdict-converted](https://github.com/changwoo/krdict-converted) dump | [CC BY-SA 2.0 KR](https://creativecommons.org/licenses/by-sa/2.0/kr/) |
| Homonym ordering | NIKL 한국어 학습용 어휘 목록 (2003) | — |
| Example sentences and their Vietnamese + English translations | Written by AI (Claude) to be short and beginner-friendly | — |
| 381 words missing from the dictionary or its intended sense (new loanwords and slang like 맛집, 알바, 헐) | Written by AI (Claude), marked **AI** in the app | — |

Proper nouns (cities, people, brands), tokenizer fragments, swear words and narrow jargon (game, makeup and fantasy-novel terms) were skipped. That's why the 7,000 cards cover frequency ranks 1–7,178.

Because the dictionary data is CC BY-SA, the word files in `data/` are shared under **CC BY-SA 2.0 KR** too.

## Rebuilding the word data

`data/` is generated by `scripts/build_data.py`. To rebuild it (Python 3.10+, `pip install xlrd`):

```bash
mkdir -p sources && cd sources
git clone --depth 1 https://github.com/changwoo/krdict-converted.git
python ../scripts/parse_krdict.py krdict-converted/upstream krdict.json
curl -L -o nikl.xls "https://www.korean.go.kr/common/download.do?file_path=etcData&c_file_name=5a4a2f5c-66c9-425d-88fb-854289ea2521_0.xls&o_file_name=%ED%95%9C%EA%B5%AD%EC%96%B4%20%ED%95%99%EC%8A%B5%EC%9A%A9%20%EC%96%B4%ED%9C%98%20%EB%AA%A9%EB%A1%9D.xls"
python ../scripts/nikl_to_json.py nikl.xls nikl.json
python ../scripts/fetch_frequency.py freq
cd ..
python scripts/build_data.py --krdict sources/krdict.json --nikl sources/nikl.json \
  --freq sources/freq --extras scripts/extras.json --out data
```

The step-by-step breakdowns come from `scripts/make_breakdowns.py`, which analyzes each example with the [Kiwi](https://github.com/bab2min/kiwipiepy) Korean morphological analyzer (`pip install kiwipiepy`). Run it after editing examples, then rebuild:

```bash
python scripts/make_breakdowns.py scripts/examples scripts/breakdowns.json
```

It writes `scripts/breakdowns.json`; the build only uses a breakdown while its example sentence is unchanged. Each step links to a grammar point in `data/grammar.json` (hand-written, with levels, explanations and examples).

`scripts/examples/*.txt` hold the example sentences, one per line:

```
word | Korean with [word] | Vietnamese with [word] | English with [word]
```

The `[brackets]` mark the word to highlight. The build checks that every line has exactly one highlight per language and warns about cards without an example.

`scripts/extras.json` holds the other hand-made parts:

- the AI-written entries
- the skip list
- `_prefer`, which picks the right homonym, e.g. 예 = "yes", not "old times"
- `_en` / `_vi`, which hold shorter or corrected glosses

Progress is stored per set and word, so if a rebuild moves words to different sets, progress for those words resets.

## Files

```
index.html               page shell
css/style.css            mint & sky-blue theme (light + dark)
js/app.js                sets, swipe cards, breakdowns, grammar page, search, progress, settings
js/pronounce.js          pronunciation guide in Vietnamese letters with Seoul pitch
js/sync.js               optional sign-in and cloud sync (Firebase)
js/firebase-config.js    Firebase settings (empty = accounts off)
firestore.rules          Firestore security rules for synced progress
data/meta.json           set count and first word of each set
data/sets/NNN.json       50 words per set
data/search.json         search index
data/grammar.json        grammar page: 117 points, Beginner to Advanced
scripts/                 data pipeline, example sentences and breakdowns
```
