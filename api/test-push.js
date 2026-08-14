// Test-Push an alle abonnierten Geräte (zum Verifizieren der Push-Kette).
import webpush from 'web-push';
import { getRedis } from './_redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (process.env.CRON_SECRET && req.query.key !== process.env.CRON_SECRET) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) { res.status(500).json({ error: 'vapid missing' }); return; }
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:m.foppe@more-fire.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const redis = getRedis();
    const map = (await redis.hgetall('subs')) || {};
    const payload = JSON.stringify({ title: '🔔 Test', body: 'Push funktioniert! 🌿', url: 'https://i-naturalist.vercel.app/' });
    let sent = 0, removed = 0;
    for (const [endpoint, sub] of Object.entries(map)) {
      try { await webpush.sendNotification(sub, payload); sent++; }
      catch (err) { if (err && (err.statusCode === 404 || err.statusCode === 410)) { await redis.hdel('subs', endpoint); removed++; } }
    }
    res.status(200).json({ subscribers: Object.keys(map).length, sent, removed });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
