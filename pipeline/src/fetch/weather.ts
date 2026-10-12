import { z } from 'zod';
import type { Weather, WeatherPlace } from '@first-light/contracts';

export interface WeatherNormals {
  places: Record<'katoomba' | 'sydney', { highC: number[]; lowC: number[] }>;
}

const PLACES = {
  katoomba: { name: 'Katoomba', latitude: -33.71, longitude: 150.31 },
  sydney: { name: 'Sydney CBD', latitude: -33.87, longitude: 151.21 },
} as const;

const HOURS = ['06:00', '09:00', '12:00', '15:00', '18:00'];

const Forecast = z.object({
  current: z.object({ temperature_2m: z.number(), wind_speed_10m: z.number(), weather_code: z.number() }),
  hourly: z.object({ time: z.array(z.string()), temperature_2m: z.array(z.number()) }),
  daily: z.object({
    temperature_2m_max: z.array(z.number()).min(1),
    temperature_2m_min: z.array(z.number()).min(1),
    precipitation_probability_max: z.array(z.number().nullable()).min(1),
    sunrise: z.array(z.string()).min(1),
    weather_code: z.array(z.number()).min(1),
  }),
});

/** WMO weather interpretation codes, as Open-Meteo documents them. */
const WMO: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail',
};

export function weatherSummary(code: number): string {
  return WMO[code] ?? 'Unsettled';
}

function forecastUrl(latitude: number, longitude: number, date: string): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,wind_speed_10m,weather_code',
    hourly: 'temperature_2m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,weather_code',
    timezone: 'Australia/Sydney',
    start_date: date,
    end_date: date,
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

/** "2026-10-13T05:50" → "05:50" (Open-Meteo already returns Sydney local time). */
const localTime = (stamp: string) => stamp.slice(11, 16);

async function place(
  fetchImpl: typeof fetch,
  key: keyof typeof PLACES,
  normals: WeatherNormals,
  editionDate: string,
): Promise<WeatherPlace> {
  const { name, latitude, longitude } = PLACES[key];
  const response = await fetchImpl(forecastUrl(latitude, longitude, editionDate));
  if (!response.ok) throw new Error(`weather: HTTP ${response.status}`);
  const parsed = Forecast.safeParse(await response.json());
  if (!parsed.success) throw new Error('weather: unexpected Open-Meteo response');
  const { current, hourly, daily } = parsed.data;

  const monthIndex = Number(editionDate.slice(5, 7)) - 1;
  const normal = normals.places[key];
  const hourlyTemps = HOURS.flatMap((hour) => {
    const i = hourly.time.findIndex((t) => localTime(t) === hour);
    const temp = hourly.temperature_2m[i];
    return i >= 0 && temp !== undefined ? [{ time: hour, tempC: Math.round(temp) }] : [];
  });

  return {
    name,
    nowC: Math.round(current.temperature_2m),
    highC: Math.round(daily.temperature_2m_max[0] ?? current.temperature_2m),
    lowC: Math.round(daily.temperature_2m_min[0] ?? current.temperature_2m),
    normalHighC: Math.round(normal.highC[monthIndex] ?? 0),
    normalLowC: Math.round(normal.lowC[monthIndex] ?? 0),
    summary: weatherSummary(daily.weather_code[0] ?? current.weather_code),
    rainChancePct: Math.round(daily.precipitation_probability_max[0] ?? 0),
    windKmh: Math.round(current.wind_speed_10m),
    sunrise: localTime(daily.sunrise[0] ?? ''),
    hourly: hourlyTemps,
  };
}

/** Open-Meteo forecast for Katoomba and Sydney CBD on the edition's Sydney date. */
export async function fetchWeather(fetchImpl: typeof fetch, normals: WeatherNormals, editionDate: string): Promise<Weather> {
  const [katoomba, sydney] = await Promise.all([
    place(fetchImpl, 'katoomba', normals, editionDate),
    place(fetchImpl, 'sydney', normals, editionDate),
  ]);
  return { katoomba, sydney };
}
