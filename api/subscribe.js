// Push-Abo speichern (pro Endpoint, dedupliziert). Offener Schreibzugriff ist ok:
// gespeichert wird nur ein Push-Endpoint; tote Abos werden beim Senden automatisch entfernt.
import { getRedis } from './_redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
  try {
    const sub = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!sub || !sub.endpoint) { res.status(400).json({ error: 'no subscription' }); return; }
    const redis = getRedis();
    await redis.hset('subs', { [sub.endpoint]: sub });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
