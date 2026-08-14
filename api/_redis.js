// Gemeinsamer Upstash-Redis-Client (REST). Nutzt die von Vercel injizierten KV-Variablen.
import { Redis } from '@upstash/redis';

export function getRedis() {
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

export const OWNER = 'marvin12748';
