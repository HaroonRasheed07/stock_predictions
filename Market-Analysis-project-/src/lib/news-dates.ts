const BASIC_ISO_DATETIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.\d+)?Z?$/;

export function normalizeSentimentNewsDates(overview: { sentiment?: unknown }): void {
  const sentiment = overview.sentiment as { news?: unknown } | undefined;
  const news = sentiment?.news;
  if (!Array.isArray(news)) return;
  for (const item of news) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as { published_at?: unknown };
    const raw = rec.published_at;
    if (typeof raw !== 'string' || raw.length === 0 || !Number.isNaN(Date.parse(raw))) continue;
    const basic = BASIC_ISO_DATETIME.exec(raw.trim());
    if (basic) {
      rec.published_at = `${basic[1]}-${basic[2]}-${basic[3]}T${basic[4]}:${basic[5]}:${basic[6]}Z`;
    } else {
      delete rec.published_at;
    }
  }
}
