// Täglicher Cron: neue RG-Arten (Artebene) erkennen und Push senden; bekannten Stand aktualisieren.
import webpush from 'web-push';
import { getRedis, OWNER } from '../_redis.js';

const INAT = 'https://api.inaturalist.org/v1';

async function currentSpeciesIds() {
  const ids = new Set();
  let page = 1, total = Infinity;
  while (ids.size < total && page <= 6) {
    const r = await fetch(`${INAT}/observations/species_counts?user_id=${OWNER}&quality_grade=research&hrank=species&per_page=500&page=${page}`);
    const j = await r.json();
    total = j.total_results || 0;
    for (const x of (j.results || [])) if (x.taxon && x.taxon.id) ids.add(x.taxon.id);
    if (!j.results || !j.results.length) break;
    page++;
  }
  return [...ids];
}

export default async function handler(req, res) {
  // Optionaler Schutz: wenn CRON_SECRET gesetzt ist, muss Vercel es mitschicken.
  if (process.env.CRON_SECRET && req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    res.status(401).json({ error: 'unauthorized' }); return;
  }
  try {
    const redis = getRedis();
    const current = await currentSpeciesIds();
    if (!current.length) { res.status(200).json({ skipped: 'no data' }); return; }

    const known = await redis.get('known:' + OWNER);
    if (!Array.isArray(known)) {
      await redis.set('known:' + OWNER, current);
      res.status(200).json({ baseline: true, count: current.length }); return;
    }

    const knownSet = new Set(known);
    const newIds = current.filter(id => !knownSet.has(id));

    let pushed = 0;
    if (newIds.length && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      let title = '🎉 Neue Art freigeschaltet!', body = `${newIds.length} neue Art(en) in Forschungsqualität.`;
      try {
        const r = await fetch(`${INAT}/taxa/${newIds.slice(0, 3).join(',')}?locale=de`);
        const j = await r.json();
        const names = (j.results || []).map(t => t.preferred_common_name || t.name).filter(Boolean);
        if (newIds.length === 1) { body = names[0] || body; }
        else { title = `🎉 ${newIds.length} neue Arten!`; body = names.join(', ') + (newIds.length > 3 ? ' …' : ''); }
      } catch (e) {}

      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:m.foppe@more-fire.com',
        process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY
      );
      const payload = JSON.stringify({ title, body, url: 'https://i-naturalist.vercel.app/' });
      const map = (await redis.hgetall('subs')) || {};
      for (const [endpoint, sub] of Object.entries(map)) {
        try { await webpush.sendNotification(sub, payload); pushed++; }
        catch (err) { if (err && (err.statusCode === 404 || err.statusCode === 410)) await redis.hdel('subs', endpoint); }
      }
    }

    await redis.set('known:' + OWNER, current);
    res.status(200).json({ new: newIds.length, pushed, total: current.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
