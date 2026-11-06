// Open-Meteo 天气缓存与中文短句；纯函数优先，网络在 server。
export const WEATHER_CACHE_MS = 60 * 60 * 1000;

export const WMO_TEXT = {
  0: '晴', 1: '大致晴', 2: '多云', 3: '阴',
  45: '雾', 48: '雾凇',
  51: '小毛毛雨', 53: '毛毛雨', 55: '强毛毛雨',
  56: '冻毛毛雨', 57: '强冻毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  66: '冻雨', 67: '强冻雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '米雪',
  80: '小阵雨', 81: '阵雨', 82: '强阵雨',
  85: '小阵雪', 86: '强阵雪',
  95: '雷阵雨', 96: '雷阵雨伴小冰雹', 99: '雷阵雨伴大冰雹',
};

export function weatherText(code) {
  return WMO_TEXT[Number(code)] || '天气未知';
}

export function weatherFresh(cache, now = Date.now()) {
  return Boolean(cache?.fetchedAt) && now - Date.parse(cache.fetchedAt) < WEATHER_CACHE_MS;
}

export function buildWeatherLine(cache) {
  if (!cache?.city || !cache?.today) return '';
  const today = cache.today;
  const current = cache.current || {};
  const condition = weatherText(today.code ?? current.code);
  const min = Number(today.tempMin);
  const max = Number(today.tempMax);
  const rain = Number(today.rainChance);
  const temps = Number.isFinite(min) && Number.isFinite(max) ? `${Math.round(min)}–${Math.round(max)}°C` : '';
  const parts = [`今天天气：${cache.city}`];
  if (temps) parts.push(temps);
  if (condition) parts.push(condition);
  if (Number.isFinite(rain) && rain >= 30) parts.push(`降水概率 ${Math.round(rain)}%`);
  const line = `${parts.join('，')}。`;
  return line.length > 60 ? `${line.slice(0, 58)}。` : line;
}
