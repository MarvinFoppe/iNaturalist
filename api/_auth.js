// Owner-Authentifizierung + Body-Parsing – gemeinsam für die schreibenden Endpunkte
// (badgelevels, friends, seen). Früher war der Token-Hash in jeder Datei kopiert.
import crypto from 'crypto';

const OWNER_TOKEN_HASH = '2e19de2ea3bba6b438471ee1c9eef4a76537fe582a921713167afe569803b2f2';

// True, wenn der Request ein gültiges Owner-Token trägt (Bearer-Header oder ?key=).
export function isOwner(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.key || '';
  if (!token) return false;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return hash === OWNER_TOKEN_HASH;
}

// Request-Body robust als Objekt lesen (String oder bereits geparst; nie werfend).
export function readBody(req) {
  try { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch (e) { return {}; }
}
