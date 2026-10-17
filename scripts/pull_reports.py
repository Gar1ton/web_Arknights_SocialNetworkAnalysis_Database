#!/usr/bin/env python3
"""Export error reports from D1 (atlas-feedback) to work/reports/.

Uses only the maintainer's own `npx wrangler login` from feedback/; no other
credential exists. Writes:
  work/reports/<date>.jsonl  one report per line, without the username
  work/reports/credits.txt   usernames of contributors who agreed to be credited
Reports are leads for the next data clean-up; every one is checked by hand.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "work" / "reports"  # work/ is in .gitignore


def d1(sql: str, local: bool) -> list[dict]:
    where = "--local" if local else "--remote"
    out = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "atlas-feedback", where, "--json", "--command", sql],
        cwd=ROOT / "feedback", check=True, capture_output=True, text=True,
    ).stdout
    return json.loads(out)[0]["results"]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--status", default="new", help="new, accepted, rejected, duplicate or all")
    ap.add_argument("--local", action="store_true", help="read the local test database")
    args = ap.parse_args()
    if args.status not in ("new", "accepted", "rejected", "duplicate", "all"):
        ap.error("unknown status")
    where = "" if args.status == "all" else f"WHERE status = '{args.status}'"
    rows = d1(f"SELECT id, created_at, status, body FROM reports {where} ORDER BY created_at", args.local)
    manifest = json.loads((ROOT / "public" / "data" / "manifest.json").read_text(encoding="utf-8"))
    current = manifest["info"].get("sources", {}).get("fullgraph", {}).get("runId") or manifest["info"].get("version", "")

    OUT.mkdir(parents=True, exist_ok=True)
    kinds, old, credits = Counter(), 0, set()
    path = OUT / f"{date.today()}.jsonl"
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            report = json.loads(row["body"])
            name = report.pop("contributor", "")
            if report.pop("credit", False) and name:
                credits.add(name)
            kinds[report["type"]] += 1
            old += report.get("dataVersion") != current
            line = {"id": row["id"], "at": row["created_at"], "status": row["status"], **report}
            f.write(json.dumps(line, ensure_ascii=False) + "\n")
    credit_path = OUT / "credits.txt"
    known = set(credit_path.read_text(encoding="utf-8").split("\n")) if credit_path.exists() else set()
    credit_path.write_text("\n".join(sorted((known | credits) - {""})) + "\n", encoding="utf-8")

    source = "local" if args.local else "remote"
    print(f"D1 atlas-feedback ({source}) · {len(rows)} 条报告（status = {args.status}）")
    if kinds:
        print("  " + " · ".join(f"{k} {n}" for k, n in kinds.most_common()))
    print(f"  旧版本数据 {old} 条（当前版本 {current}）")
    print(f"✓ {path.relative_to(ROOT)}  {len(rows)} 条，不含用户名")
    print(f"✓ {credit_path.relative_to(ROOT)}  本次新增 {len(credits - known)} 个署名")


if __name__ == "__main__":
    main()
