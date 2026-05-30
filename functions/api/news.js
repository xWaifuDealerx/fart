// ============================================================
// functions/api/news.js — World Cup news feed (Google News RSS proxy)
// ============================================================
//   GET /api/news → { items: [ { title, link, pubDate, source } ] }
// ============================================================

const FEED_URL =
  "https://news.google.com/rss/search?q=" +
  encodeURIComponent("FIFA World Cup 2026") +
  "&hl=en-US&gl=US&ceid=US:en";

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...extra } });
}

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

export async function onRequest({ request }) {
  if (request.method !== "GET") return json({ items: [], note: "Use GET." }, 405);
  const cache = { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" };

  try {
    const r = await fetch(FEED_URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; FartCupBot/1.0)" } });
    if (!r.ok) return json({ items: [], note: "feed HTTP " + r.status }, 200, cache);
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
    return json({ items }, 200, cache);
  } catch (e) {
    return json({ items: [], note: String((e && e.message) || e) });
  }
}
