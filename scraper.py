import html
import json
import os
import smtplib
import sys
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

import requests
from bs4 import BeautifulSoup

YARD_URL = "https://www.rgpick-a-part.com/inventory.php"
ROOT = Path(__file__).parent
WATCHLIST_FILE = ROOT / "watchlist.json"
NOTIFIED_FILE = ROOT / "notified.json"
DASHBOARD_FILE = ROOT / "index.html"


def fetch_inventory():
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    res = requests.get(YARD_URL, headers=headers, timeout=30)
    res.raise_for_status()

    soup = BeautifulSoup(res.text, "html.parser")
    table = soup.find("table", id="vehicles")
    if table is None:
        raise RuntimeError("Could not find the #vehicles table - the site layout may have changed.")

    vehicles = []
    for row in table.find_all("tr"):
        cols = [td.get_text(strip=True) for td in row.find_all("td")]
        if len(cols) < 5:
            continue
        year, make, model, stock, yard_row = cols[:5]
        if not stock:
            continue
        vehicles.append({
            "year": year,
            "make": make,
            "model": model,
            "stock": stock,
            "row": yard_row,
        })
    return vehicles


def load_json(path, default):
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, sort_keys=True)
        f.write("\n")


def watch_label(watch):
    label = f"{watch['make']} {watch.get('model', '')}".strip()
    year_min, year_max = watch.get("year_min"), watch.get("year_max")
    if year_min or year_max:
        label += f" ({year_min or '...'}-{year_max or '...'})"
    return label.upper()


def matches(vehicle, watch):
    if vehicle["make"].strip().lower() != watch["make"].strip().lower():
        return False
    wanted_model = watch.get("model", "").strip().lower()
    if wanted_model and wanted_model not in vehicle["model"].lower():
        return False
    try:
        year = int(vehicle["year"])
    except ValueError:
        year = None
    if year is not None:
        if watch.get("year_min") and year < int(watch["year_min"]):
            return False
        if watch.get("year_max") and year > int(watch["year_max"]):
            return False
    return True


def find_new_matches(vehicles, watchlist, notified):
    new_matches = []
    for vehicle in vehicles:
        for watch in watchlist:
            label = watch_label(watch)
            if matches(vehicle, watch) and label not in notified.get(vehicle["stock"], []):
                new_matches.append((label, vehicle))
    return new_matches


def send_email(new_matches):
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    to_addr = os.environ.get("EMAIL_TO") or user
    host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    port = int(os.environ.get("SMTP_PORT", "465"))

    if not (user and password and to_addr):
        print("SMTP_USER / SMTP_PASSWORD not set - skipping email.")
        return False

    lines = [
        f"{v['year']} {v['make']} {v['model']}  |  Stock {v['stock']}  |  Row {v['row'] or 'not yet assigned'}  (watch: {label})"
        for label, v in new_matches
    ]
    msg = EmailMessage()
    msg["Subject"] = f"Junkyard alert: {len(new_matches)} new match(es) at RG Pick-A-Part"
    msg["From"] = user
    msg["To"] = to_addr
    msg.set_content(
        "New vehicles matching your watchlist:\n\n" + "\n".join(lines) + f"\n\nFull inventory: {YARD_URL}\n"
    )

    with smtplib.SMTP_SSL(host, port, timeout=30) as smtp:
        smtp.login(user, password)
        smtp.send_message(msg)
    print(f"Emailed {len(new_matches)} match(es) to {to_addr}.")
    return True


def build_dashboard(vehicles, watchlist):
    watched_stocks = {v["stock"] for v in vehicles for w in watchlist if matches(v, w)}

    rows_html = []
    for v in vehicles:
        e = {k: html.escape(val) for k, val in v.items()}
        highlight = " watched" if v["stock"] in watched_stocks else ""
        rows_html.append(
            f'<tr class="inventory-row{highlight}" data-search="{html.escape((v["year"] + " " + v["make"] + " " + v["model"]).lower())}">'
            f'<td>{e["year"]}</td><td class="make">{e["make"]}</td><td>{e["model"]}</td>'
            f'<td><span class="row-tag">{e["row"] or "-"}</span></td><td class="mono">{e["stock"]}</td></tr>'
        )

    watch_tags = "".join(f'<span class="tag">{html.escape(watch_label(w))}</span>' for w in watchlist) or "<span>None yet</span>"
    updated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JYScraper | RG Pick-A-Part Inventory</title>
<style>
  :root {{ --bg:#14171a; --panel:#1e2327; --line:#2e353b; --text:#e8eaec; --muted:#9aa3ab; --accent:#f2b134; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif; }}
  main {{ max-width:1100px; margin:0 auto; padding:24px; display:flex; flex-direction:column; gap:20px; }}
  h1 {{ margin:0; font-size:28px; }}
  p {{ margin:4px 0 0; color:var(--muted); }}
  .panel {{ background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; }}
  .tags {{ display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }}
  .tag {{ border:1px solid var(--accent); color:var(--accent); border-radius:999px; padding:2px 10px; font-size:13px; }}
  input {{ width:100%; padding:10px 12px; background:var(--bg); border:1px solid var(--line); border-radius:8px; color:var(--text); font-size:15px; }}
  table {{ width:100%; border-collapse:collapse; }}
  th, td {{ text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); }}
  th {{ color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.05em; }}
  .make {{ font-weight:600; }}
  .mono {{ font-family:ui-monospace,monospace; color:var(--muted); font-size:13px; }}
  .row-tag {{ font-family:ui-monospace,monospace; }}
  tr.watched {{ background:rgba(242,177,52,.12); box-shadow:inset 4px 0 0 var(--accent); }}
  .table-wrap {{ overflow-x:auto; padding:0; }}
</style>
</head>
<body>
<main>
  <header>
    <h1>JYScraper</h1>
    <p>{len(vehicles)} vehicles at RG Pick-A-Part &middot; updated {updated}</p>
  </header>
  <section class="panel">
    <strong>Email watchlist</strong> <span style="color:var(--muted)">(edit watchlist.json in the repo)</span>
    <div class="tags">{watch_tags}</div>
  </section>
  <section class="panel">
    <label for="searchInput" class="sr-only" style="position:absolute;left:-9999px">Search</label>
    <input id="searchInput" type="search" placeholder="Filter by year, make, or model...">
  </section>
  <section class="panel table-wrap">
    <table>
      <thead><tr><th>Year</th><th>Make</th><th>Model</th><th>Row</th><th>Stock #</th></tr></thead>
      <tbody>{''.join(rows_html)}</tbody>
    </table>
  </section>
</main>
<script>
  const rows = document.querySelectorAll('.inventory-row');
  document.getElementById('searchInput').addEventListener('input', (e) => {{
    const q = e.target.value.toLowerCase().trim();
    rows.forEach((row) => {{ row.style.display = row.dataset.search.includes(q) ? '' : 'none'; }});
  }});
</script>
</body>
</html>
"""
    DASHBOARD_FILE.write_text(page, encoding="utf-8")


def main():
    print("Fetching yard inventory...")
    vehicles = fetch_inventory()
    print(f"Found {len(vehicles)} vehicles.")
    if not vehicles:
        print("No vehicles parsed - aborting so state isn't wiped.")
        sys.exit(1)

    watchlist = load_json(WATCHLIST_FILE, [])
    notified = load_json(NOTIFIED_FILE, {})

    new_matches = find_new_matches(vehicles, watchlist, notified)
    print(f"{len(new_matches)} new match(es).")
    for label, v in new_matches:
        print(f"  NEW: {v['year']} {v['make']} {v['model']} ({v['stock']}) for {label}")

    if new_matches and send_email(new_matches):
        for label, v in new_matches:
            notified.setdefault(v["stock"], []).append(label)

    current_stocks = {v["stock"] for v in vehicles}
    notified = {stock: labels for stock, labels in notified.items() if stock in current_stocks}
    save_json(NOTIFIED_FILE, notified)

    build_dashboard(vehicles, watchlist)
    print("Dashboard written.")


if __name__ == "__main__":
    main()
