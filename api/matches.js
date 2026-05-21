// ============================================================
// api/matches.js — World Cup fixtures & live scores
// ============================================================
// Proxies football-data.org's World Cup competition feed server-side
// (their API needs an auth token + can't be called from the browser),
// normalises it, and returns it as JSON. The Fart Cup sidebar polls
// this every ~30s so scores update live.
//
//   GET /api/matches → { matches: [ { id, utcDate, status, matchday,
//                          homeName, awayName, homeCrest, awayCrest, hs, as } ], note? }
//
// SETUP: get a FREE token at https://www.football-data.org/client/register
// and add it to your Vercel project as the env var FOOTBALL_DATA_TOKEN.
// Without it, the endpoint returns an empty list + a note (the UI shows
// a friendly "no matches yet" message).
// ============================================================

const TOKEN = process.env.FOOTBALL_DATA_TOKEN;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  if (!TOKEN) {
    res.status(200).json({
      matches: [],
      note: "Live matches need a free football-data.org token (set FOOTBALL_DATA_TOKEN in your host's env vars).",
    });
    return;
  }

  try {
    const r = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
      headers: { "X-Auth-Token": TOKEN },
    });
    if (!r.ok) {
      res.status(200).json({ matches: [], note: "football-data HTTP " + r.status });
      return;
    }
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
    res.status(200).json({ matches });
  } catch (e) {
    res.status(200).json({ matches: [], note: String((e && e.message) || e) });
  }
}
