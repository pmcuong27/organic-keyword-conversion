"""Quick offline DB stats for the BlendAttrib dashboard."""
from __future__ import annotations

import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parents[2] / "data" / "gsc_offline.db"


def main() -> None:
    conn = sqlite3.connect(DB)
    try:
        gsc_n = conn.execute(
            "SELECT COUNT(*) FROM gsc_hourly WHERE report_name='full'"
        ).fetchone()[0]
        ga4_n = conn.execute("SELECT COUNT(*) FROM ga4_hourly").fetchone()[0]
        gsc_rng = conn.execute(
            "SELECT MIN(hour_utc), MAX(hour_utc) FROM gsc_hourly WHERE report_name='full'"
        ).fetchone()
        ga4_rng = conn.execute(
            "SELECT MIN(hour_utc), MAX(hour_utc) FROM ga4_hourly"
        ).fetchone()
        print(f"db={DB}")
        print(f"gsc_rows={gsc_n} range={gsc_rng[0]} -> {gsc_rng[1]}")
        print(f"ga4_rows={ga4_n} range={ga4_rng[0]} -> {ga4_rng[1]}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
