// 本地日期上下文：星期 + 中国/香港主要公众假日 + 24 节气（2026–2027）。
// 纯静态、零网络；只在 prompt 的易变尾巴使用。
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const HOLIDAYS = {
  '2026-01-01': '元旦',
  '2026-02-17': '春节',
  '2026-02-18': '春节初二',
  '2026-02-19': '春节初三',
  '2026-04-05': '清明',
  '2026-05-01': '劳动节',
  '2026-06-19': '端午',
  '2026-09-25': '中秋',
  '2026-10-01': '国庆',
  '2026-10-18': '重阳',
  '2026-12-25': '圣诞',
  '2026-12-26': '圣诞翌日',
  '2027-01-01': '元旦',
  '2027-02-06': '春节',
  '2027-02-07': '春节初二',
  '2027-02-08': '春节初三',
  '2027-04-05': '清明',
  '2027-05-01': '劳动节',
  '2027-06-09': '端午',
  '2027-09-15': '中秋',
  '2027-10-01': '国庆',
  '2027-10-08': '重阳',
  '2027-12-25': '圣诞',
  '2027-12-26': '圣诞翌日',
};

const SOLAR_TERMS = {
  '2026-01-05': '小寒', '2026-01-20': '大寒', '2026-02-04': '立春', '2026-02-18': '雨水',
  '2026-03-05': '惊蛰', '2026-03-20': '春分', '2026-04-05': '清明', '2026-04-20': '谷雨',
  '2026-05-05': '立夏', '2026-05-21': '小满', '2026-06-05': '芒种', '2026-06-21': '夏至',
  '2026-07-07': '小暑', '2026-07-23': '大暑', '2026-08-07': '立秋', '2026-08-23': '处暑',
  '2026-09-07': '白露', '2026-09-23': '秋分', '2026-10-08': '寒露', '2026-10-23': '霜降',
  '2026-11-07': '立冬', '2026-11-22': '小雪', '2026-12-07': '大雪', '2026-12-21': '冬至',
  '2027-01-05': '小寒', '2027-01-20': '大寒', '2027-02-04': '立春', '2027-02-19': '雨水',
  '2027-03-06': '惊蛰', '2027-03-21': '春分', '2027-04-05': '清明', '2027-04-20': '谷雨',
  '2027-05-06': '立夏', '2027-05-21': '小满', '2027-06-06': '芒种', '2027-06-21': '夏至',
  '2027-07-07': '小暑', '2027-07-23': '大暑', '2027-08-08': '立秋', '2027-08-23': '处暑',
  '2027-09-08': '白露', '2027-09-23': '秋分', '2027-10-08': '寒露', '2027-10-24': '霜降',
  '2027-11-07': '立冬', '2027-11-22': '小雪', '2027-12-07': '大雪', '2027-12-22': '冬至',
};

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

function nextHoliday(date) {
  const today = dayNumber(date);
  return Object.entries(HOLIDAYS)
    .map(([key, name]) => {
      const [year, month, day] = key.split('-').map(Number);
      return { key, name, days: Math.floor(Date.UTC(year, month - 1, day) / 86400000) - today };
    })
    .filter((item) => item.days > 0 && item.days <= 90)
    .sort((a, b) => a.days - b.days)[0] || null;
}

export function dateContextLine(date = new Date()) {
  const key = dateKey(date);
  const weekday = WEEKDAYS[date.getDay()];
  const events = [];
  if (HOLIDAYS[key]) events.push(HOLIDAYS[key]);
  if (SOLAR_TERMS[key]) events.push(SOLAR_TERMS[key]);
  const next = nextHoliday(date);
  if (next) events.push(`离${next.name}还有${next.days}天`);
  if (!events.length) return `今天星期${weekday}。`;
  return `今天星期${weekday}，${events.join('，')}。`;
}

export { HOLIDAYS, SOLAR_TERMS };
