// ============================================================
// functions/api/matches.js — World Cup fixtures & live scores
// ============================================================
//   GET /api/matches → { matches: [...], note? }
// SETUP: set FOOTBALL_DATA_TOKEN env var in Cloudflare Pages settings.
// ============================================================

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...extra } });
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return json({ matches: [], note: "Use GET." }, 405);
  const cache = { "Cache-Control": "s-maxage=20, stale-while-revalidate=40" };

  const TOKEN = env.FOOTBALL_DATA_TOKEN;
  if (!TOKEN) {
    return json({
      matches: [],
      note: "Live matches need a free football-data.org token (set FOOTBALL_DATA_TOKEN in your host's env vars).",
    }, 200, cache);
  }

  try {
    const r = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
      headers: { "X-Auth-Token": TOKEN },
    });
    if (!r.ok) return json({ matches: [], note: "football-data HTTP " + r.status }, 200, cache);
    const j = await r.json();
    const matches = (j.matches || []).map((m) => ({
      id: m.id,
      utcDate: m.utcDate,
      status: m.status,
      matchday: m.matchday,
      stage: m.stage,
      homeName: (m.homeTeam && (m.homeTeam.shortName || m.homeTeam.name)) || "TBD",
      awayName: (m.awayTeam && (m.awayTeam.shortName || m.awayTeam.name)) || "TBD",
      homeCrest: (m.homeTeam && m.homeTeam.crest) || null,
      awayCrest: (m.awayTeam && m.awayTeam.crest) || null,
      hs: m.score && m.score.fullTime ? m.score.fullTime.home : null,
      as: m.score && m.score.fullTime ? m.score.fullTime.away : null,
    }));
    return json({ matches }, 200, cache);
  } catch (e) {
    return json({ matches: [], note: String((e && e.message) || e) });
  }
}
