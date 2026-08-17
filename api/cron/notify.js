// Täglicher Cron: (1) eigene neue RG-Arten erkennen und belohnen,
// (2) neue Uploads von Freunden erkennen – jeweils per Push melden.
import webpush from 'web-push';
import { getRedis, OWNER } from '../_redis.js';

const INAT = 'https://api.inaturalist.org/v1';
const APP_URL = 'https://i-naturalist.vercel.app/';

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

// Gesamt-Beobachtungszahl eines Nutzers (nur die Zahl, ohne Ergebnisse -> günstig).
async function obsCount(login) {
  const r = await fetch(`${INAT}/observations?user_id=${encodeURIComponent(login)}&per_page=0`);
  const j = await r.json();
  return j.total_results || 0;
}

// Payload an alle abonnierten Geräte senden; tote Abos (404/410) entfernen.
async function sendToAll(redis, payload) {
  const map = (await redis.hgetall('subs')) || {};
  let pushed = 0;
  for (const [endpoint, sub] of Object.entries(map)) {
    try { await webpush.sendNotification(sub, JSON.stringify(payload)); pushed++; }
    catch (err) { if (err && (err.statusCode === 404 || err.statusCode === 410)) await redis.hdel('subs', endpoint); }
  }
  return pushed;
}

export default async function handler(req, res) {
  // Optionaler Schutz: wenn CRON_SECRET gesetzt ist, muss Vercel es mitschicken.
  if (process.env.CRON_SECRET && req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    res.status(401).json({ error: 'unauthorized' }); return;
  }
  const pushReady = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (pushReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:m.foppe@more-fire.com',
      process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY
    );
  }

  try {
    const redis = getRedis();
    const out = { pushed: 0 };

    // ===== (1) Eigene neue Research-Grade-Arten =====
    const current = await currentSpeciesIds();
    if (current.length) {
      const known = await redis.get('known:' + OWNER);
      if (!Array.isArray(known)) {
        await redis.set('known:' + OWNER, current);
        out.ownBaseline = current.length;
      } else {
        const knownSet = new Set(known);
        const newIds = current.filter(id => !knownSet.has(id));
        out.ownNew = newIds.length;
        if (newIds.length && pushReady) {
          let title = '🎉 Neue Art freigeschaltet!', body = `${newIds.length} neue Art(en) in Forschungsqualität.`;
          try {
            const r = await fetch(`${INAT}/taxa/${newIds.slice(0, 3).join(',')}?locale=de`);
            const j = await r.json();
            const names = (j.results || []).map(t => t.preferred_common_name || t.name).filter(Boolean);
            if (newIds.length === 1) { body = names[0] || body; }
            else { title = `🎉 ${newIds.length} neue Arten!`; body = names.join(', ') + (newIds.length > 3 ? ' …' : ''); }
          } catch (e) {}
          out.pushed += await sendToAll(redis, { title, body, url: APP_URL });
        }
        await redis.set('known:' + OWNER, current);
      }
    } else {
      out.ownSkipped = 'no data';
    }

    // ===== (2) Neue Uploads von Freunden =====
    const friends = await redis.get('friends:' + OWNER);
    if (Array.isArray(friends) && friends.length) {
      const news = []; // { login, added }
      for (const login of friends) {
        try {
          const count = await obsCount(login);
          const prev = await redis.get('friend_count:' + login);
          if (typeof prev !== 'number') { await redis.set('friend_count:' + login, count); continue; } // Basislinie
          if (count > prev) news.push({ login, added: count - prev });
          if (count !== prev) await redis.set('friend_count:' + login, count);
        } catch (e) { /* einzelnen Freund überspringen */ }
      }
      out.friendNews = news.length;
      if (news.length && pushReady) {
        let title, body;
        if (news.length === 1) {
          title = `🔭 @${news[0].login} hat etwas hochgeladen`;
          body = `${news[0].added} neue Beobachtung${news[0].added === 1 ? '' : 'en'}.`;
        } else {
          title = `🔭 ${news.length} Freunde mit neuen Uploads`;
          body = news.slice(0, 4).map(x => `@${x.login} (+${x.added})`).join(', ') + (news.length > 4 ? ' …' : '');
        }
        out.pushed += await sendToAll(redis, { title, body, url: APP_URL });
      }
    }

    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
