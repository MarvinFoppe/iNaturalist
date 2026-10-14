// Test-Push an alle abonnierten Geräte (zum Verifizieren der Push-Kette).
import webpush from 'web-push';
import { getRedis } from './_redis.js';
import { isOwner } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
  // Erlaubt: Cron-Secret (Bearer) ODER gültiges Owner-Token (für den Test-Knopf im Gerät).
  const auth = req.headers.authorization || '';
  const secretOk = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!secretOk && !isOwner(req)) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) { res.status(500).json({ error: 'vapid missing' }); return; }
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:m.foppe@more-fire.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const redis = getRedis();
    const map = (await redis.hgetall('subs')) || {};
    const payload = JSON.stringify({ title: '🔔 Test', body: 'Push funktioniert! 🌿', url: 'https://i-naturalist.vercel.app/' });
    let sent = 0, removed = 0;
    const errors = [];
    for (const [endpoint, sub] of Object.entries(map)) {
      try { await webpush.sendNotification(sub, payload); sent++; }
      catch (err) {
        const code = err && err.statusCode;
        if (code === 404 || code === 410) { await redis.hdel('subs', endpoint); removed++; }
        // FCM-Fehlercode + Kurzmeldung mitgeben (zur Diagnose im Gerät sichtbar)
        errors.push({ code: code || null, body: (err && (err.body || err.message) || '').toString().slice(0, 200), host: (() => { try { return new URL(endpoint).host; } catch (e) { return ''; } })() });
      }
    }
    res.status(200).json({ subscribers: Object.keys(map).length, sent, removed, errors });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
