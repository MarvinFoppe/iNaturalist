// Geräteübergreifender Rang-Stand der Badges (Kategorie → erreichte Stufe).
// GET: Stand lesen (offen). POST: Stand ergänzen (nur mit Owner-Token; Max-Merge, sinkt nie).
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
  const key = 'badgelevels:' + user;

  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      const levels = await redis.get(key);
      res.status(200).json({ levels: (levels && typeof levels === 'object' && !Array.isArray(levels)) ? levels : {} });
      return;
    }
    if (req.method === 'POST') {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.key || '';
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      if (hash !== OWNER_TOKEN_HASH) { res.status(401).json({ error: 'unauthorized' }); return; }
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const incoming = (body.levels && typeof body.levels === 'object' && !Array.isArray(body.levels)) ? body.levels : {};
      const cur = await redis.get(key);
      const merged = (cur && typeof cur === 'object' && !Array.isArray(cur)) ? { ...cur } : {};
      for (const [k, v] of Object.entries(incoming)) {
        const n = Number(v);
        if (Number.isFinite(n)) merged[k] = Math.max(Number(merged[k]) || 0, n);   // Stufe sinkt nie
      }
      await redis.set(key, merged);
      res.status(200).json({ ok: true, count: Object.keys(merged).length });
      return;
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
