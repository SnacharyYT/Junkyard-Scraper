import os
import requests
from bs4 import BeautifulSoup

YARD_URL = "https://rgpick-a-part.com"

def build_static_dashboard():
    print("Fetching yard records...")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    try:
        res = requests.get(YARD_URL, headers=headers, timeout=15)
        if res.status_code != 200:
            print(f"Error fetching data: HTTP {res.status_code}")
            return
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    soup = BeautifulSoup(res.text, 'html.parser')
    rows = soup.find_all('tr')
    
    table_rows_html = ""
    for row in rows:
        cols = [ele.text.strip() for ele in row.find_all('td')]
        if len(cols) >= 5:
            # Safely catch values out of the table cols list
            year = cols[0]
            make = cols[1]
            model = cols[2]
            stock = cols[3]
            row_loc = cols[4]
            
            table_rows_html += f"""
            <tr class="border-b border-gray-700 hover:bg-gray-750 transition inventory-row" 
                data-make="{make.lower()}" data-model="{model.lower()}" data-year="{year}">
                <td class="p-4 font-semibold text-gray-300">{year}</td>
                <td class="p-4 font-bold text-white">{make}</td>
                <td class="p-4 text-blue-300">{model}</td>
                <td class="p-4"><span class="bg-gray-900 px-2.5 py-1 rounded text-green-400 font-mono text-sm border border-green-900">Row {row_loc}</span></td>
                <td class="p-4 text-gray-400 font-mono text-xs">{stock}</td>
            </tr>
            """

    # Embed table rows inside interface boilerplate
    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JRScraper | Inventory Dashboard</title>
    <script src="https://jsdelivr.net"></script>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen font-sans">
    <div class="max-w-6xl mx-auto p-6">
        <header class="mb-8 border-b border-gray-800 pb-6">
            <h1 class="text-3xl font-extrabold text-blue-400">🚗 JYScraper Dash</h1>
            <p class="text-gray-400 mt-1">Live updates cached from RG Pick-A-Part</p>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-gray-800 p-5 rounded-xl border border-gray-700 col-span-2">
                <h2 class="text-lg font-bold mb-3">Live Search Filter</h2>
                <input type="text" id="searchInput" placeholder="Type Make, Model, or Year..." 
                       class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            
            <div class="bg-gray-800 p-5 rounded-xl border border-gray-700">
                <h2 class="text-lg font-bold mb-3">Your Watchlist</h2>
                <div class="flex gap-2">
                    <input type="text" id="watchInput" placeholder="e.g., Civic" 
                           class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none">
                    <button onclick="addToWatchlist()" class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold transition">Add</button>
                </div>
                <div id="watchlistTags" class="flex flex-wrap gap-2 mt-3"></div>
            </div>
        </div>

        <div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-xl">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-gray-700 text-gray-300 uppercase text-xs tracking-wider">
                        <th class="p-4">Year</th>
                        <th class="p-4">Make</th>
                        <th class="p-4">Model</th>
                        <th class="p-4">Row Location</th>
                        <th class="p-4">Stock ID</th>
                    </tr>
                </thead>
                <tbody id="inventoryBody">
                    {table_rows_html}
                </tbody>
            </table>
        </div>
    </div>

    <script>
        const searchInput = document.getElementById('searchInput');
        const rows = document.querySelectorAll('.inventory-row');

        searchInput.addEventListener('input', (e) => {{
            const query = e.target.value.toLowerCase();
            rows.forEach(row => {{
                const matchString = `${{row.dataset.year}} ${{row.dataset.make}} ${{row.dataset.model}}`;
                row.style.display = matchString.includes(query) ? '' : 'none';
            }});
        }});

        let watchlist = JSON.parse(localStorage.getItem('jr_watchlist')) || [];

        function renderWatchlist() {{
            const container = document.getElementById('watchlistTags');
            container.innerHTML = '';
            watchlist.forEach((item, index) => {{
                container.innerHTML += `
                    <span class="bg-blue-900/60 text-blue-300 border border-blue-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
                        \${{item}}
                        <button onclick="removeItem(\${{index}})" class="text-blue-500 hover:text-red-400 font-bold">×</button>
                    </span>`;
            }});
            highlightWatchedItems();
        }}

        function addToWatchlist() {{
            const input = document.getElementById('watchInput');
            const val = input.value.trim().toLowerCase();
            if (val && !watchlist.includes(val)) {{
                watchlist.push(val);
                localStorage.setItem('jr_watchlist', JSON.stringify(watchlist));
                input.value = '';
                renderWatchlist();
            }}
        }}

        function removeItem(index) {{
            watchlist.splice(index, 1);
            localStorage.setItem('jr_watchlist', JSON.stringify(watchlist));
            renderWatchlist();
        }}

        function highlightWatchedItems() {{
            rows.forEach(row => {{
                const make = row.dataset.make;
                const model = row.dataset.model;
                const matchesWatch = watchlist.some(keyword => make.includes(keyword) || model.includes(keyword));
                if (matchesWatch && watchlist.length > 0) {{
                    row.classList.add('bg-yellow-950/30', 'border-l-4', 'border-l-yellow-500');
                }} else {{
                    row.classList.remove('bg-yellow-950/30', 'border-l-4', 'border-l-yellow-500');
                }}
            }});
        }}
        renderWatchlist();
    </script>
</body>
</html>
"""
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(full_html)
    print("Dashboard file generated successfully.")

if __name__ == "__main__":
    build_static_dashboard()
