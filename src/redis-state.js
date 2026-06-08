const BASE_URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 36 * 60 * 60; // 36h — covers full IST workday + buffer

async function call(path) {
  if (!BASE_URL || !TOKEN) return null;
  const res = await fetch(`${BASE_URL}/${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const json = await res.json();
  return json.result ?? null;
}

// Returns 'in', 'out', or null (null also means Redis not configured)
export async function getClockStatus(date) {
  return call(`get/keka:status:${date}`);
}

export async function setClockStatus(date, status) {
  await call(`set/keka:status:${date}/${status}/ex/${TTL}`);
}
