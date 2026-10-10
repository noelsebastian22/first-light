/**
 * Recomputes pipeline/weather-normals.json from the Open-Meteo Historical Weather API:
 * mean daily max and min temperature per calendar month, 1991-2020.
 *
 * Run by hand (not in CI), from a machine that can reach archive-api.open-meteo.com:
 *   npx tsx pipeline/scripts/compute-normals.ts
 */
import { writeFileSync } from 'node:fs';
import { z } from 'zod';

const PLACES = {
  katoomba: { latitude: -33.71, longitude: 150.31 },
  sydney: { latitude: -33.87, longitude: 151.21 },
} as const;

const Archive = z.object({
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number().nullable()),
    temperature_2m_min: z.array(z.number().nullable()),
  }),
});

const round1 = (n: number) => Math.round(n * 10) / 10;

function monthlyMeans(times: string[], values: (number | null)[]): number[] {
  const sums = Array.from({ length: 12 }, () => ({ total: 0, count: 0 }));
  times.forEach((day, i) => {
    const value = values[i];
    const bucket = sums[Number(day.slice(5, 7)) - 1];
    if (value === null || value === undefined || !bucket) return;
    bucket.total += value;
    bucket.count += 1;
  });
  return sums.map((b) => (b.count ? round1(b.total / b.count) : 0));
}

async function normalsFor(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: '1991-01-01',
    end_date: '2020-12-31',
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'Australia/Sydney',
  });
  const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`);
  if (!response.ok) throw new Error(`archive: HTTP ${response.status}`);
  const { daily } = Archive.parse(await response.json());
  return {
    highC: monthlyMeans(daily.time, daily.temperature_2m_max),
    lowC: monthlyMeans(daily.time, daily.temperature_2m_min),
  };
}

const out = {
  note: 'Monthly mean daily max/min, 1991-2020, Jan..Dec, from the Open-Meteo Historical Weather API. Regenerate with: npx tsx pipeline/scripts/compute-normals.ts',
  places: {
    katoomba: await normalsFor(PLACES.katoomba.latitude, PLACES.katoomba.longitude),
    sydney: await normalsFor(PLACES.sydney.latitude, PLACES.sydney.longitude),
  },
};
writeFileSync(new URL('../weather-normals.json', import.meta.url), `${JSON.stringify(out, null, 2)}\n`);
console.log('ok');
