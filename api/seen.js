// Geräteübergreifender "gesehen"-Stand der Belohnungs-Karten.
// GET: Stand lesen (offen). POST: Stand ergänzen (nur mit Owner-Token; Vereinigung, wird nie kleiner).
import { getRedis, OWNER } from './_redis.js';
import { isOwner, readBody } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const redis = getRedis();
  const user = (req.query.user || OWNER).toString().toLowerCase();

  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      const seen = await redis.get('seen:' + user);
      res.status(200).json({ seen: Array.isArray(seen) ? seen : [] });
      return;
    }
    if (req.method === 'POST') {
      if (!isOwner(req)) { res.status(401).json({ error: 'unauthorized' }); return; }
      const body = readBody(req);
      const ids = Array.isArray(body.seen) ? body.seen.filter(x => Number.isFinite(x)) : [];
      const cur = await redis.get('seen:' + user);
      const merged = [...new Set([...(Array.isArray(cur) ? cur : []), ...ids])];
      await redis.set('seen:' + user, merged);
      res.status(200).json({ ok: true, count: merged.length });
      return;
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
