// 天气/日期上下文纯函数测试。
import { buildWeatherLine, weatherFresh, weatherText, WEATHER_CACHE_MS } from '../lib/weather.mjs';
import { dateContextLine } from '../lib/calendar.mjs';

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

check('WMO 天气码', weatherText(0) === '晴' && weatherText(61) === '小雨' && weatherText(95) === '雷阵雨');
check('天气缓存新鲜', weatherFresh({ fetchedAt: new Date().toISOString() }) === true);
check('天气缓存过期', weatherFresh({ fetchedAt: new Date(Date.now() - WEATHER_CACHE_MS - 1000).toISOString() }) === false);
const line = buildWeatherLine({
  city: '香港', current: { temp: 26, code: 61 },
  today: { tempMax: 28, tempMin: 24, code: 61, rainChance: 70 },
});
check('天气行包含城市/温度/降水', line.includes('香港') && line.includes('24–28°C') && line.includes('70%'), line);
check('无城市不生成', buildWeatherLine({ today: {} }) === '');
const winter = dateContextLine(new Date(2026, 11, 21));
check('冬至日期上下文', winter.includes('冬至') && winter.includes('星期一') && winter.includes('圣诞'), winter);
const christmas = dateContextLine(new Date(2026, 11, 25));
check('圣诞日期上下文', christmas.includes('圣诞') && christmas.includes('星期五'), christmas);

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);
