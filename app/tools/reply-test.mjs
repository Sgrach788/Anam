// 纯函数测试：切句 + 时间标签清理。
// 用法：node app/tools/reply-test.mjs
import { MAX_PART, findSentenceCut, findCommaCut, partDelay, sanitizeReply, normalizeReplySpeed, replySpeedMultiplier } from '../lib/reply.mjs';

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

// 时间标签清理
check('去掉行首 [今天 19:12]', sanitizeReply('[今天 19:12] 你好。') === '你好。', sanitizeReply('[今天 19:12] 你好。'));
check('去掉「今天 19:12：」前缀', sanitizeReply('今天 19:12：在的。') === '在的。', sanitizeReply('今天 19:12：在的。'));
check('只有标签时变空', sanitizeReply('[昨天 22:13]') === '');
check('去掉 [10月28日 09:05]', sanitizeReply('[10月28日 09:05] 早。') === '早。');
check('去掉裸 [21:25]', sanitizeReply('[21:25] 好 来') === '好 来', sanitizeReply('[21:25] 好 来'));
check('去掉句中裸 [21:25]', sanitizeReply('这样能看清吗[21:25]') === '这样能看清吗', sanitizeReply('这样能看清吗[21:25]'));
check('去掉裸 [21:25:30]', sanitizeReply('[21:25:30] 好') === '好', sanitizeReply('[21:25:30] 好'));
check('去掉行首裸 21:25', sanitizeReply('21:25 好') === '好', sanitizeReply('21:25 好'));
check('行内裸时间不误伤', sanitizeReply('嗯21:25好') === '嗯21:25好');
check('正常文本不动', sanitizeReply('今天有点累。') === '今天有点累。');
// 模型把历史 sticker 抄成独立正文；只清独立句，不误伤行内文字
check('去掉独立 [表情] 句', sanitizeReply('[表情] 开心。') === '', sanitizeReply('[表情] 开心。'));
check('去掉句中独立 [表情] 句', sanitizeReply('今天真好。[表情] 开心。') === '今天真好。', sanitizeReply('今天真好。[表情] 开心。'));
check('保留行内普通文字', sanitizeReply('看到你很开心。') === '看到你很开心。');

// 切句
check('句号切点', findSentenceCut('第一句。第二句') === 4, findSentenceCut('第一句。第二句'));
check('闭合引号跟着走', findSentenceCut('他说「好。」然后') === 6, findSentenceCut('他说「好。」然后'));
check('连续感叹号一起切', findSentenceCut('真的吗！！然后') === 5, findSentenceCut('真的吗！！然后'));
check('没有标点返回 0', findSentenceCut('没有标点的一句话') === 0);
check('换行也算句末', findSentenceCut('第一行\n第二行') === 4);

// 超长且无句末标点：在逗号处切
const long = '这是很长的一句话，'.repeat(5) + '后面还有内容';
check('超长句子按逗号切', findCommaCut(long) > 0 && findCommaCut(long) <= MAX_PART, findCommaCut(long));
check('没有逗号就硬切', findCommaCut('字'.repeat(80)) === MAX_PART);

// 停顿
check('停顿 600–1800ms', partDelay(0) === 600 && partDelay(15) === 1200 && partDelay(100) === 1800, `${partDelay(0)},${partDelay(15)},${partDelay(100)}`);
check('速度三档倍率', normalizeReplySpeed('slow') === 'slow' && replySpeedMultiplier('slow') === 1.5
  && replySpeedMultiplier('normal') === 1 && replySpeedMultiplier('fast') === 0.6);
check('未知速度回退正常', normalizeReplySpeed('turbo') === 'normal' && replySpeedMultiplier(undefined) === 1);

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);
