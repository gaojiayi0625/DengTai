/* ============================================================================
 * 登台 DengTai · 算法与数据层自测（Node 环境，无浏览器）
 * 运行：node docs/test-logic.js
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

/* --- 伪造浏览器环境 --- */
global.window = global;
const mem = {};
global.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; }
};
global.document = undefined;

function load(f) {
  const code = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  (0, eval)(code);
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 0.01); }

console.log('=== 1. 载入模块 ===');
load('js/analyze.js');
load('js/store.js');
const A = global.Analyze, S = global.Store;
check('Analyze 已导出', !!A && typeof A.countWords === 'function');
check('Store 已导出', !!S && typeof S.load === 'function');

console.log('\n=== 2. 字数统计 ===');
check('中文逐字计：你好世界 = 4', A.countWords('你好世界') === 4, A.countWords('你好世界'));
check('空白不计入', A.countWords('你好\n  世界') === 4, A.countWords('你好\n  世界'));
check('英文/数字词折 2 字：HarmonyOS 6 = 4', A.countWords('HarmonyOS 6') === 4, A.countWords('HarmonyOS 6'));
check('中英混合：华为 HarmonyOS = 4', A.countWords('华为HarmonyOS') === 4, A.countWords('华为HarmonyOS'));
check('空串 = 0', A.countWords('') === 0);

console.log('\n=== 3. 语速模型 ===');
check('240 字/分钟 → 240 字 = 60s', near(A.estimateSeconds('字'.repeat(240), 240), 60), A.estimateSeconds('字'.repeat(240), 240));
check('120 字/分钟 → 240 字 = 120s', near(A.estimateSeconds('字'.repeat(240), 120), 120));
check('默认语速 240', A.DEFAULT_SPEED === 240);

console.log('\n=== 4. 口头禅检测 ===');
const txt = '然后我们做了调研，然后发现一个问题，就是这个市场其实没有人在做。';
const f = A.detectFillers(txt);
check('检出"然后" 2 次', (f.items.find(i => i.word === '然后') || {}).n === 2, JSON.stringify(f.items));
check('检出"这个" 1 次', (f.items.find(i => i.word === '这个') || {}).n === 1);
check('检出"就是" 1 次', (f.items.find(i => i.word === '就是') || {}).n === 1);
check('检出"其实" 1 次', (f.items.find(i => i.word === '其实') || {}).n === 1);
check('总命中 = 5（然后×2 + 这个 + 就是 + 其实）', f.total === 5, f.total);
check('密度 = 命中/字数*100', near(f.density, f.total / A.countWords(txt) * 100), f.density);
check('长词优先（"然后的话"不被"然后"抢占）',
  (A.detectFillers('然后的话我们再看看').items.find(i => i.word === '然后的话') || {}).n === 1,
  JSON.stringify(A.detectFillers('然后的话我们再看看').items));
check('干净文本密度 0', A.detectFillers('今天我们汇报三个部分。').total === 0);
check('分级：≤1.0 干净', A.fillerVerdict(0.5).level === 'ok');
check('分级：>4.5 密集', A.fillerVerdict(5.2).level === 'bad');

console.log('\n=== 5. 分段计划与定位 ===');
const demo = S.defaults();
check('演示讲稿 6 段', demo.sections.length === 6, demo.sections.length);
const plan = A.planTimeline(demo.sections);
check('总计划 = 480s（8 分钟）', plan.total === 480, plan.total);

/* 数据自洽性：讲稿必须"读得完"——预计用时不超过计划总时长，且不能太空 */
const totalChars = demo.sections.reduce((a, s) => a + A.countWords(s.text), 0);
const estSec = totalChars / demo.event.speed * 60;
check('预计用时 ≤ 计划总时长（讲稿读得完）', estSec <= plan.total,
  Math.round(estSec) + 's vs ' + plan.total + 's');
check('预计用时 ≥ 计划 85%（讲稿不至于太空）', estSec >= plan.total * 0.85,
  Math.round(estSec) + 's / ' + plan.total + 's');
check('每段字数与配额基本匹配（偏差 < 25%）', demo.sections.every(s => {
  const est = A.countWords(s.text) / demo.event.speed * 60;
  return Math.abs(est - s.quota) / s.quota < 0.25;
}), demo.sections.map(s => Math.round(A.countWords(s.text) / demo.event.speed * 60) + '/' + s.quota).join(' '));
check('演示讲稿含可检出的口头禅（密度 0.5~3）', (() => {
  const d = A.detectFillers(demo.sections.map(s => s.text).join(''));
  return d.density >= 0.5 && d.density <= 3;
})(), A.detectFillers(demo.sections.map(s => s.text).join('')).density.toFixed(2));
check('第 1 段窗口 0~45', plan.timeline[0].start === 0 && plan.timeline[0].end === 45);
check('第 2 段窗口 45~135', plan.timeline[1].start === 45 && plan.timeline[1].end === 135);
check('时间窗连续无缝隙', plan.timeline.every((s, i) => i === 0 ? s.start === 0 : s.start === plan.timeline[i - 1].end));

check('用时 10s 落在第 1 段', A.locate(plan.timeline, 10).index === 0);
check('用时 60s 落在第 2 段', A.locate(plan.timeline, 60).index === 1, A.locate(plan.timeline, 60).index);
check('用时 479s 落在第 6 段', A.locate(plan.timeline, 479).index === 5);
check('超时后仍停在最后一段', A.locate(plan.timeline, 999).index === 5);
check('偏移量 = 用时 - 本段起点', A.locate(plan.timeline, 60).dev === 15, A.locate(plan.timeline, 60).dev);

console.log('\n=== 6. 三色预警 ===');
check('剩余 120s → 绿灯', A.traffic(480, 360).level === 'ok');
check('剩余 60s → 黄灯', A.traffic(480, 420).level === 'warn');
check('剩余 3s → 黄灯', A.traffic(480, 477).level === 'warn');
check('超时 1s → 红灯', A.traffic(480, 481).level === 'over');
check('超时显示负的剩余', A.traffic(480, 500).remain === -20);
check('fmt 480 → 08:00', A.fmt(480) === '08:00', A.fmt(480));
check('fmt 65 → 01:05', A.fmt(65) === '01:05', A.fmt(65));
check('fmt 负数归零', A.fmt(-5) === '00:00');

console.log('\n=== 7. 演示排练数据 ===');
check('内置 6 次排练记录', demo.records.length === 6, demo.records.length);
check('记录含分段实际用时', demo.records[0].sections.length === 6);
check('总用时 = 各段之和', demo.records.every(r =>
  r.totalActual === r.sections.reduce((a, s) => a + s.actual, 0)));
check('计划总时长一致 = 480', demo.records.every(r => r.totalQuota === 480));
const devOf = r => Math.abs(r.totalActual - r.totalQuota);
check('越练越接近目标（首场偏差 > 末场偏差）',
  devOf(demo.records[0]) > devOf(demo.records[5]),
  devOf(demo.records[0]) + ' vs ' + devOf(demo.records[5]));
check('口头禅密度逐场下降',
  demo.records[0].fillers.density > demo.records[5].fillers.density,
  demo.records[0].fillers.density + ' → ' + demo.records[5].fillers.density);
check('日期按时间递增', demo.records.every((r, i) => i === 0 || r.atTs > demo.records[i - 1].atTs));

console.log('\n=== 8. 统计摘要 ===');
const st = S.stats(demo.records);
check('次数 = 6', st.count === 6);
check('平均用时在合理区间（480±10%）', Math.abs(st.avg - 480) < 48, st.avg.toFixed(1));
check('best = 最小总用时', st.best === Math.min(...demo.records.map(r => r.totalActual)));
check('口头禅趋势斜率为负（在进步）', st.fillerSlope < 0, st.fillerSlope.toFixed(3));
check('空记录不报错', S.stats([]).count === 0);

console.log('\n=== 9. 持久化与导入导出 ===');
const d1 = S.load();
d1.event.speed = 200;
S.save(d1);
check('保存后可读回（命中缓存）', S.load().event.speed === 200);
const json = S.exportJSON();
check('导出为合法 JSON', (() => { try { JSON.parse(json); return true; } catch (e) { return false; } })());
check('导出内容含 app 标识', JSON.parse(json).app === 'DengTai');
check('导出含讲稿与记录', JSON.parse(json).data.sections.length === 6 && JSON.parse(json).data.records.length === 6);
const before = JSON.parse(json).data.sections[0].title;
S.reset();
check('reset 后恢复 6 段演示讲稿', S.load().sections.length === 6);
S.importJSON(json);
check('导入后标题一致', S.load().sections[0].title === before, S.load().sections[0].title);
check('导入后语速一致 = 200', S.load().event.speed === 200);
let threw = false;
try { S.importJSON('{"foo":1}'); } catch (e) { threw = true; }
check('非法数据导入抛错', threw);

console.log('\n=== 10. 增删改 ===');
S.reset();
const n0 = S.load().sections.length;
S.upsertSection({ title: '问答环节', text: '谢谢老师提问。', quota: 30, keys: ['提问'] });
check('新增分段', S.load().sections.length === n0 + 1);
const added = S.load().sections[S.load().sections.length - 1];
S.upsertSection({ id: added.id, title: '问答环节（改）', text: '谢谢老师提问。', quota: 40, keys: [] });
check('按 id 更新而非重复插入', S.load().sections.length === n0 + 1);
check('更新生效', S.load().sections[S.load().sections.length - 1].quota === 40);
S.deleteSection(added.id);
check('删除分段', S.load().sections.length === n0);
const r0 = S.load().records.length;
const nr = S.addRecord({ totalQuota: 480, totalActual: 470, sections: [], fillers: { total: 5, density: 0.5 } });
check('新增排练记录', S.load().records.length === r0 + 1);
check('记录自动补日期', !!nr.at && /\d{4}-\d{2}-\d{2}/.test(nr.at), nr.at);
S.deleteRecord(nr.id);
check('删除排练记录', S.load().records.length === r0);

console.log('\n============================================');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log('============================================');
process.exit(fail ? 1 : 0);
