// Erreichbarkeits-Check: Die App fragt das beim Start einmal ab.
// Antwortet nur auf Vercel; auf GitHub Pages gibt es diese Route nicht (404) -> App bleibt im Direkt-Modus.
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({ ok: true, backend: 'vercel', features: ['proxy'], ts: Date.now() });
}
