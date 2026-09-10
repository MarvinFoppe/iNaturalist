// Reisen (Trips) des Owners server-seitig speichern, damit sie teilbar + geräteübergreifend sind.
// GET  ?id=<id>&user=<u>  -> einzelne Reise (öffentlich, für geteilte Links)
// GET  ?user=<u>          -> alle Reisen des Nutzers (öffentlich lesbar)
// POST (Owner-Token)      -> Reise anlegen/aktualisieren { trip:{id,name,from,to} }
// DELETE ?id=<id> (Owner) -> Reise löschen
// Die Reise speichert nur Name + Zeitraum + Nutzer; die Beobachtungen holt der
// Browser des Betrachters live von iNaturalist (immer aktueller Stand).
import { getRedis, OWNER } from './_redis.js';
import { isOwner, readBody } from './_auth.js';

function cleanTrip(t, user) {
  if (!t || typeof t !== 'object') return null;
  const id = String(t.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const name = String(t.name || '').trim().slice(0, 80);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(t.from) ? t.from : '';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(t.to) ? t.to : '';   // leer = laufende Reise
  if (!id || !name || !from) return null;
  return { id, name, from, to, user };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const redis = getRedis();
  const user = (req.query.user || OWNER).toString().toLowerCase();
  const key = 'trips:' + user;

  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      const list = await redis.get(key);
      const trips = Array.isArray(list) ? list : [];
      const id = req.query.id ? String(req.query.id) : '';
      if (id) {
        const trip = trips.find(t => t.id === id) || null;
        res.status(trip ? 200 : 404).json({ trip });
        return;
      }
      res.status(200).json({ trips });
      return;
    }
    if (req.method === 'POST') {
      if (!isOwner(req)) { res.status(401).json({ error: 'unauthorized' }); return; }
      const trip = cleanTrip(readBody(req).trip, user);
      if (!trip) { res.status(400).json({ error: 'invalid trip' }); return; }
      const cur = await redis.get(key);
      const list = (Array.isArray(cur) ? cur : []).filter(t => t.id !== trip.id);
      list.push(trip);
      await redis.set(key, list);
      res.status(200).json({ ok: true, trip });
      return;
    }
    if (req.method === 'DELETE') {
      if (!isOwner(req)) { res.status(401).json({ error: 'unauthorized' }); return; }
      const id = String(req.query.id || '');
      const cur = await redis.get(key);
      await redis.set(key, (Array.isArray(cur) ? cur : []).filter(t => t.id !== id));
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
