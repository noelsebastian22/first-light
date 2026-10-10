import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import normals from '../../weather-normals.json';
import { fetchWeather, weatherSummary } from './weather';

const fixture = (name: string) => readFileSync(new URL(`../../../fixtures/open-meteo/${name}`, import.meta.url), 'utf8');

function fakeFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const body = url.searchParams.get('latitude') === '-33.71' ? fixture('katoomba.json') : fixture('sydney.json');
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
  });
}

describe('fetchWeather', () => {
  it('maps the Open-Meteo forecast and monthly normals to Weather', async () => {
    const fetchImpl = fakeFetch();
    const weather = await fetchWeather(fetchImpl as unknown as typeof fetch, normals, '2026-10-13');

    expect(weather.katoomba).toEqual({
      name: 'Katoomba',
      nowC: 9,
      highC: 17,
      lowC: 7,
      normalHighC: 17,
      normalLowC: 8,
      summary: 'Fog',
      rainChancePct: 20,
      windKmh: 12,
      sunrise: '05:50',
      hourly: [
        { time: '06:00', tempC: 8 },
        { time: '09:00', tempC: 10 },
        { time: '12:00', tempC: 15 },
        { time: '15:00', tempC: 17 },
        { time: '18:00', tempC: 13 },
      ],
    });
    expect(weather.sydney).toMatchObject({ name: 'Sydney CBD', highC: 22, lowC: 14, normalHighC: 23, normalLowC: 14, summary: 'Clear' });
  });

  it('asks Open-Meteo for the edition date in Sydney time', async () => {
    const fetchImpl = fakeFetch();
    await fetchWeather(fetchImpl as unknown as typeof fetch, normals, '2026-10-13');
    const url = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('timezone')).toBe('Australia/Sydney');
    expect(url.searchParams.get('start_date')).toBe('2026-10-13');
    expect(url.searchParams.get('end_date')).toBe('2026-10-13');
  });

  it('throws a short error when Open-Meteo fails', async () => {
    const fetchImpl = vi.fn(async () => new Response('down', { status: 503 }));
    await expect(fetchWeather(fetchImpl as unknown as typeof fetch, normals, '2026-10-13')).rejects.toThrow('weather: HTTP 503');
  });
});

describe('weatherSummary', () => {
  it('describes WMO weather codes in plain words', () => {
    expect(weatherSummary(0)).toBe('Clear');
    expect(weatherSummary(3)).toBe('Overcast');
    expect(weatherSummary(61)).toBe('Light rain');
    expect(weatherSummary(95)).toBe('Thunderstorm');
    expect(weatherSummary(1234)).toBe('Unsettled');
  });
});
