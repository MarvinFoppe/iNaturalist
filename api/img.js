// Bild-Proxy für iNaturalist-Fotos: holt das Bild serverseitig und liefert es
// mit CORS-Header aus, damit es im Browser auf ein <canvas> gezeichnet werden
// kann (für den PDF-Export des Reise-Sammelalbums). iNat-Fotos selbst senden
// kein Access-Control-Allow-Origin, deshalb dieser Umweg.
// Aufruf: /api/img?u=<vollständige, URL-kodierte Bild-URL>
// Nur iNaturalist-Foto-Hosts sind erlaubt (kein offener Proxy).
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const target = req.query.u;
  if (!target) { res.status(400).json({ error: 'missing u' }); return; }

  let url;
  try { url = new URL(target); } catch { res.status(400).json({ error: 'bad url' }); return; }

  const host = url.hostname.toLowerCase();
  const ok = /(^|\.)inaturalist\.org$/.test(host)
    || host.includes('inaturalist-open-data')
    || (host.endsWith('.amazonaws.com') && host.includes('inaturalist'));
  if (!ok) { res.status(403).json({ error: 'host not allowed' }); return; }

  try {
    const r = await fetch(url.toString(), { headers: { 'User-Agent': 'naturbeobachtungen-proxy (vercel)' } });
    if (!r.ok) { res.status(r.status).json({ error: 'upstream', status: r.status }); return; }
    const ct = r.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) { res.status(415).json({ error: 'not an image' }); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', ct);
    // Bilder ändern sich nicht – lange am Edge cachen
    res.setHeader('Cache-Control', 'public, s-maxage=604800, max-age=86400, stale-while-revalidate=604800');
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).json({ error: 'upstream', detail: String(e) });
  }
}
