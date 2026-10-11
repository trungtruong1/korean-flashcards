"""Download the top 10,000 words of Kimchi Reader's Korean frequency list.

Usage: python fetch_frequency.py OUT_DIR
Writes OUT_DIR/api_1.json ... api_10.json (1,000 words each).
"""
import os
import sys
import time
import urllib.request

URL = "https://api.kimchi-reader.app/v2/media/freq/words/all?page={}&limit=1000"

out_dir = sys.argv[1]
os.makedirs(out_dir, exist_ok=True)
for page in range(1, 11):
    req = urllib.request.Request(URL.format(page), headers={"User-Agent": "gorae-words-builder"})
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
    with open(os.path.join(out_dir, f"api_{page}.json"), "wb") as fh:
        fh.write(data)
    print("page", page, len(data), "bytes")
    time.sleep(1)  # be polite
