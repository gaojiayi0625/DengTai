/* ============================================================================
 * 登台 DengTai · 讲稿分析与计时引擎
 * ----------------------------------------------------------------------------
 * · 语速模型：中文按"字/分钟"估算，默认 240 字/分钟（正常演讲语速 200~260）
 * · 口头禅检测：高频虚词/填充词统计，按密度给出警示
 * · 分段计时：把总配额按段累计，排练时由"当前用时"定位所在段并计算偏差
 * ========================================================================== */
(function (global) {
  'use strict';

  /* 口头禅词表（从高到低按词长匹配，避免"的话"匹配不到等边界问题） */
  var FILLERS = ['然后的话', '所以说', '然后呢', '还有就是', '然后', '就是', '那个', '这个', '其实', '的话', '嗯', '呃', '啊', '说白了', '反正'];

  var DEFAULT_SPEED = 240; // 字/分钟

  /** 统计讲稿字数：中文字符逐字计，连续英文/数字算 1 个"词"折 2 字 */
  function countWords(text) {
    if (!text) return 0;
    var src = String(text);
    /* 去空白只为数中文，英文/数字必须在原文上按空白分词，
       否则 "HarmonyOS 6" 会被并成一个词 */
    var cleaned = src.replace(/\s+/g, '');
    var cjk = (cleaned.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
    var latinWords = (src.match(/[A-Za-z0-9]+/g) || []).length;
    return cjk + latinWords * 2;
  }

  /**
   * 口头禅检测
   * @returns {{total:number, density:number, items:Array<{word:string,n:number}>, spots:Array<{idx:number,word:string}>}}
   *   density = 每百字口头禅个数
   */
  function detectFillers(text) {
    var src = String(text || '');
    var counts = {};
    var spots = [];
    FILLERS.forEach(function (w) {
      var from = 0, n = 0;
      while (true) {
        var i = src.indexOf(w, from);
        if (i < 0) break;
        n++;
        spots.push({ idx: i, word: w });
        from = i + w.length;
      }
      if (n > 0) counts[w] = n;
    });
    var total = 0;
    var items = Object.keys(counts).map(function (w) { total += counts[w]; return { word: w, n: counts[w] }; });
    items.sort(function (a, b) { return b.n - a.n; });
    var chars = countWords(src);
    return {
      total: total,
      density: chars ? total / chars * 100 : 0,
      items: items,
      spots: spots
    };
  }

  /**
   * 语速评估：根据口头禅密度给一句结论
   */
  function fillerVerdict(density) {
    if (density <= 1.0) return { level: 'ok', text: '表达干净利落' };
    if (density <= 2.5) return { level: 'warn', text: '略有口头禅，不影响整体' };
    if (density <= 4.5) return { level: 'warn2', text: '口头禅偏多，注意停顿代替' };
    return { level: 'bad', text: '口头禅密集，建议逐句打磨讲稿' };
  }

  /**
   * 单段预计用时（秒）
   */
  function estimateSeconds(text, speed) {
    return countWords(text) / (speed || DEFAULT_SPEED) * 60;
  }

  /**
   * 分段计划：返回每段的 [start, end) 计划时间窗（秒），以及总计划时长
   */
  function planTimeline(sections) {
    var t = 0;
    var timeline = sections.map(function (s) {
      var start = t;
      t += (s.quota || 30);
      return { id: s.id, title: s.title, start: start, end: t, quota: s.quota || 30 };
    });
    return { timeline: timeline, total: t };
  }

  /**
   * 根据当前用时定位所在段并计算偏差
   * @param {Array} timeline planTimeline().timeline
   * @param {number} elapsed 当前已用时（秒）
   * @returns {{index:number, dev:number, plannedEnd:number}}
   *   dev = 实际 - 计划（>0 落后 / <0 抢跑）
   */
  function locate(timeline, elapsed) {
    for (var i = 0; i < timeline.length; i++) {
      var seg = timeline[i];
      if (elapsed < seg.end || i === timeline.length - 1) {
        return { index: i, dev: elapsed - seg.start, plannedEnd: seg.end };
      }
    }
    return { index: 0, dev: 0, plannedEnd: timeline[0].end };
  }

  /**
   * 整体状态：剩余时间分级（绿灯 >60s / 黄灯 ≤60s / 红灯 超时）
   */
  function traffic(total, elapsed) {
    var remain = total - elapsed;
    if (remain > 60) return { level: 'ok', remain: remain };
    if (remain >= 0) return { level: 'warn', remain: remain };
    return { level: 'over', remain: remain };
  }

  /** 秒 → mm:ss */
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  global.Analyze = {
    FILLERS: FILLERS,
    DEFAULT_SPEED: DEFAULT_SPEED,
    countWords: countWords,
    detectFillers: detectFillers,
    fillerVerdict: fillerVerdict,
    estimateSeconds: estimateSeconds,
    planTimeline: planTimeline,
    locate: locate,
    traffic: traffic,
    fmt: fmt
  };
})(window);
