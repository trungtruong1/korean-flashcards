"""Convert NIKL's 한국어 학습용 어휘 목록 (.xls) to JSON for build_data.py.

Usage: python nikl_to_json.py 한국어_학습용_어휘_목록.xls nikl.json
Needs: pip install xlrd
"""
import json
import sys

import xlrd

sheet = xlrd.open_workbook(sys.argv[1]).sheet_by_index(0)
rows = [sheet.row_values(r) for r in range(1, sheet.nrows)]  # skip header: 순위, 단어, 품사, 풀이, 등급
out = [{
    "rank": int(r[0]) if r[0] != "" else 99999,
    "word": str(r[1]),
    "pos": r[2],
    "orig": r[3],
    "grade": r[4],
} for r in rows]
with open(sys.argv[2], "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False)
print(len(out), "rows")
