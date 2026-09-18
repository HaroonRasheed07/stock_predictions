import os, sqlite3, json
db = os.path.join('stock_market', 'news_cache.db')
conn = sqlite3.connect(db)
rows = conn.execute("SELECT ticker, snapshot_json FROM sentiment_snapshots").fetchall()
for r in rows:
    d = json.loads(r[1])
    print(f"{r[0]:6s}: articles={d.get('relevant_article_count', '?')}, v{d.get('methodology_version', '?')}, status={d.get('status', '?')}")
conn.close()
