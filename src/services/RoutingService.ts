const OSRM_BASE = "http://localhost:5000";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const routeCache = new Map<string, { distance: number; duration: number; timestamp: number }>();

const pendingQueue: Array<() => void> = [];
let activeRequests = 0;
const MAX_CONCURRENT = 50;
const REQUEST_DELAY_MS = 0;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processQueue() {
  while (pendingQueue.length > 0 && activeRequests < MAX_CONCURRENT) {
    const next = pendingQueue.shift();
    if (next) next();
  }
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pendingQueue.push(async () => {
      activeRequests++;
      try {
        await delay(REQUEST_DELAY_MS);
        const result = await fn();
        resolve(result);
      } catch (e) {
        reject(e);
      } finally {
        activeRequests--;
        processQueue();
      }
    });
    processQueue();
  });
}

export interface RouteResult {
  distanciaKm: number;
  duracionMinutos: number;
}

export async function getDrivingDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): Promise<RouteResult> {
  const key = `${lat1.toFixed(5)},${lng1.toFixed(5)};${lat2.toFixed(5)},${lng2.toFixed(5)}`;

  const cached = routeCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { distanciaKm: cached.distance / 1000, duracionMinutos: cached.duration / 60 };
  }

  return enqueue(async () => {
    try {
      const url = `${OSRM_BASE}/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
      const data = await res.json() as any;
      if (data.code !== "Ok" || !data.routes?.[0]) throw new Error("OSRM no devolvió ruta");
      const route = data.routes[0];
      routeCache.set(key, { distance: route.distance, duration: route.duration, timestamp: Date.now() });
      return { distanciaKm: route.distance / 1000, duracionMinutos: route.duration / 60 };
    } catch (err) {
      const haversine = getHaversineDistance(lat1, lng1, lat2, lng2);
      return { distanciaKm: haversine, duracionMinutos: haversine / 50 * 60 };
    }
  });
}

export async function getDrivingDistanceBatch(
  origin: { lat: number; lng: number },
  destinations: Array<{ lat: number; lng: number }>
): Promise<Array<RouteResult | null>> {
  return Promise.all(
    destinations.map((dest) =>
      getDrivingDistance(origin.lat, origin.lng, dest.lat, dest.lng).catch(() => null)
    )
  );
}

export async function getDistanciaTiempo(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  maxDuracionMinutos: number = 10
): Promise<{ dentro: boolean; duracionMinutos: number; distanciaKm: number }> {
  const route = await getDrivingDistance(lat1, lng1, lat2, lng2);
  return {
    dentro: route.duracionMinutos <= maxDuracionMinutos,
    duracionMinutos: route.duracionMinutos,
    distanciaKm: route.distanciaKm,
  };
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function getHaversineDistance(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function clearRouteCache() {
  routeCache.clear();
}