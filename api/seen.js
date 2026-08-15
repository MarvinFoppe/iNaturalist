// Geräteübergreifender "gesehen"-Stand der Belohnungs-Karten.
// GET: Stand lesen (offen). POST: Stand ergänzen (nur mit Owner-Token; Vereinigung, wird nie kleiner).
import crypto from 'crypto';
import { getRedis, OWNER } from './_redis.js';

const OWNER_TOKEN_HASH = '2e19de2ea3bba6b438471ee1c9eef4a76537fe582a921713167afe569803b2f2';

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
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.key || '';
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      if (hash !== OWNER_TOKEN_HASH) { res.status(401).json({ error: 'unauthorized' }); return; }
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
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
