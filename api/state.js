// Liefert den serverseitig bekannten RG-Artenstand (für geräteübergreifende Entdopplung
// des Belohnungs-Popups). Wird vom Cron gepflegt; die App liest nur.
import { getRedis, OWNER } from './_redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
  try {
    const user = (req.query.user || OWNER).toString().toLowerCase();
    const redis = getRedis();
    const known = await redis.get('known:' + user);
    const arr = Array.isArray(known) ? known : [];
    res.status(200).json({ user, known: arr, count: arr.length });
  } catch (e) {
    res.status(500).json({ error: String(e), known: [] });
  }
}
