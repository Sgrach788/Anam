// 表情发送策略纯函数测试：默认值、固定骰子、边界、软频率文案。
// 用法：node app/tools/meme-strategy-test.mjs
import {
  MEME_STRATEGY_DEFAULTS, memeStrategyFromConfig, memeStrategyPatch,
  rollMemeGate, memeSoftFrequencyBlock, memePromptBlock, memeNoMemeStreak,
} from '../lib/memes.mjs';

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

check('默认概率 100', MEME_STRATEGY_DEFAULTS.probability === 100);
check('默认间隔 2', MEME_STRATEGY_DEFAULTS.minGapReplies === 2);
check('默认软提示关闭', MEME_STRATEGY_DEFAULTS.softFrequency === false);
check('默认每条 1 张', MEME_STRATEGY_DEFAULTS.maxPerReply === 1);

check('配置缺省回退默认', JSON.stringify(memeStrategyFromConfig({})) === JSON.stringify(MEME_STRATEGY_DEFAULTS), JSON.stringify(memeStrategyFromConfig({})));
check('配置越界夹紧', memeStrategyFromConfig({ memeSendProbability: 150, memeMinGapReplies: 9 }).probability === 100
  && memeStrategyFromConfig({ memeSendProbability: -1, memeMinGapReplies: -2 }).minGapReplies === 0);

check('概率 0 永不命中', rollMemeGate(0, 0) === false && rollMemeGate(0, 0.99) === false);
check('概率 100 必命中', rollMemeGate(100, 0) === true && rollMemeGate(100, 0.99) === true);
check('25% 骰子 0.1 命中', rollMemeGate(25, 0.1) === true);
check('25% 骰子 0.9 未命中', rollMemeGate(25, 0.9) === false);

let invalid = 0;
for (const patch of [{ probability: 101 }, { probability: -1 }, { probability: 'x' }, { minGapReplies: 6 }, { minGapReplies: -1 }, { softFrequency: 'yes' }]) {
  try { memeStrategyPatch(patch); } catch { invalid++; }
}
check('非法策略参数被拒绝', invalid === 6, `invalid=${invalid}`);

const soft = memeSoftFrequencyBlock(true);
check('软提示包含 2–3 条参考', soft.includes('每约 2–3 条') && soft.includes('不必精确计数'));
check('软提示包含用户明确要求例外', soft.includes('用户明确要求时不受软频率参考约束'));
check('软提示不向用户解释', soft.includes('不要向用户解释频率判断'));
check('软提示包含连续 2 条追赶', soft.includes('连续 2 条回复都没有配图'));
check('软提示包含情绪触发条款', soft.includes('遇到玩笑、鼓励、庆祝、共情或轻松接话'));
check('软提示包含 4 轮强制', soft.includes('连续 4 条助手回复都没有配图时，本条必须配 1 张'));
check('软提示包含三种输出教学', soft.includes('纯文字：') && soft.includes('文字+表情：') && soft.includes('只发表情：'));
check('软提示关闭为空', memeSoftFrequencyBlock(false) === '');
check('目录开启软提示时注入', memePromptBlock([{ id: 'abc12345', label: '开心', tags: [] }], { softFrequency: true }).includes('用户明确要求时不受软频率参考约束'));

const round = (key, sticker = false, parts = 2) => Array.from({ length: parts }, () => ({ role: 'assistant', replyTo: key, type: sticker ? 'sticker' : 'text' }));
check('streak：最近 3 轮没带、第 4 轮带了 = 3', memeNoMemeStreak([...round('old', true), ...round('a'), ...round('b'), ...round('c')]) === 3);
check('streak：最近 1 轮带了 = 0', memeNoMemeStreak(round('a', true)) === 0);
check('streak：同一轮 3 气泡没带 = 1', memeNoMemeStreak(round('a', false, 3)) === 1);
check('streak：连续 5 轮没带 = 5', memeNoMemeStreak([...round('a'), ...round('b'), ...round('c'), ...round('d'), ...round('e')]) === 5);
const injected4 = memePromptBlock([{ id: 'abc12345', label: '开心', tags: [] }], { softFrequency: true, streak: 4 });
check('streak=4 注入“必须”且 N=4', injected4.includes('服务端事实：你已经连续 4 条助手回复没有配图，本条必须配 1 张。'));
const injected2 = memePromptBlock([{ id: 'abc12345', label: '开心', tags: [] }], { softFrequency: true, streak: 2 });
check('streak=2 注入“优先”且 N=2', injected2.includes('服务端事实：你已经连续 2 条助手回复没有配图，优先配 1 张。'));
check('streak=1 不注入事实行', !memeSoftFrequencyBlock(true, 1).includes('服务端事实：'));

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);




