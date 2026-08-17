// Freundesliste des Owners server-seitig spiegeln, damit der Cron (server-seitig)
// weiß, wessen Uploads er beobachten soll. Die Liste liegt sonst nur im localStorage.
// GET: Liste lesen (offen). POST: Liste setzen (nur mit Owner-Token).
import crypto from 'crypto';
import { getRedis, OWNER } from './_redis.js';

const OWNER_TOKEN_HASH = '2e19de2ea3bba6b438471ee1c9eef4a76537fe582a921713167afe569803b2f2';

// iNat-Logins normalisieren: klein, ohne @, nur erlaubte Zeichen, max. 60 Einträge.
function cleanLogins(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of arr) {
    const l = String(raw || '').trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_.-]{1,40}$/.test(l)) continue;
    if (seen.has(l)) continue;
    seen.add(l); out.push(l);
    if (out.length >= 60) break;
  }
  return out;
}

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
      const list = await redis.get('friends:' + user);
      res.status(200).json({ friends: Array.isArray(list) ? list : [] });
      return;
    }
    if (req.method === 'POST') {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.key || '';
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      if (hash !== OWNER_TOKEN_HASH) { res.status(401).json({ error: 'unauthorized' }); return; }
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const list = cleanLogins(body.friends);
      await redis.set('friends:' + user, list);
      res.status(200).json({ ok: true, count: list.length });
      return;
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
