// Liefert den öffentlichen VAPID-Schlüssel, damit der Browser ein Push-Abo anlegen kann.
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
}
