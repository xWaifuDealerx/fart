// ============================================================
// api/news.js — World Cup news feed (Google News RSS proxy)
// ============================================================
// Browsers can't read Google News RSS directly (CORS), so this runs
// server-side, fetches the feed, and returns the latest headlines as
// JSON for the Fart Cup sidebar.
//
//   GET /api/news  → { items: [ { title, link, pubDate, source } ] }
// ============================================================

const FEED_URL =
  "https://news.google.com/rss/search?q=" +
  encodeURIComponent("FIFA World Cup 2026") +
  "&hl=en-US&gl=US&ceid=US:en";

function decodeEntities(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function pick(block, tag) {
  const m = block.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">"));
  return m ? m[1] : "";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // cache at the edge for a few minutes
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    const r = await fetch(FEED_URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; FartCupBot/1.0)" } });
    if (!r.ok) { res.status(200).json({ items: [], note: "feed HTTP " + r.status }); return; }
    const xml = await r.text();

    const items = [];
    const blocks = xml.split("<item>").slice(1);
    for (const block of blocks.slice(0, 14)) {
      const title = decodeEntities(pick(block, "title"));
      const linkRaw = pick(block, "link");
      const link = decodeEntities(linkRaw) || linkRaw.trim();
      const pubDate = pick(block, "pubDate").trim();
      const source = decodeEntities(pick(block, "source"));
      if (title) items.push({ title, link, pubDate, source });
    }
    res.status(200).json({ items });
  } catch (e) {
    res.status(200).json({ items: [], note: String((e && e.message) || e) });
  }
}
