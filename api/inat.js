// Cache-Proxy zu iNaturalist: holt Daten serverseitig und lässt sie vom Vercel-Edge cachen.
// Aufruf: /api/inat?u=<vollständige, URL-kodierte iNat-API-URL>
// Nur api.inaturalist.org ist erlaubt (kein offener Proxy).
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const target = req.query.u;
  if (!target) { res.status(400).json({ error: 'missing u' }); return; }

  let url;
  try { url = new URL(target); } catch { res.status(400).json({ error: 'bad url' }); return; }
  if (url.hostname !== 'api.inaturalist.org') { res.status(403).json({ error: 'host not allowed' }); return; }

  try {
    const r = await fetch(url.toString(), { headers: { 'User-Agent': 'naturbeobachtungen-proxy (vercel)' } });
    const body = await r.text();
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json; charset=utf-8');
    // 5 Min frisch am Edge, danach bis zu 1 Tag "stale-while-revalidate" (schnelle Antworten, wenig iNat-Last)
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.status(r.status).send(body);
  } catch (e) {
    res.status(502).json({ error: 'upstream', detail: String(e) });
  }
}
