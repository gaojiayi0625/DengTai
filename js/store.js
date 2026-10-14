/* ============================================================================
 * 登台 DengTai · 数据层
 * ----------------------------------------------------------------------------
 * · 讲稿分段（标题 / 正文 / 计划用时 / 关键词）
 * · 排练记录（每段实际用时、总用时、口头禅密度）
 * · localStorage 持久化，支持 JSON 导入导出
 * · 首次运行内置 6 次历史排练的演示数据（确定性生成，非随机漂移）
 * ========================================================================== */
(function (global) {
  'use strict';

  var KEY = 'dengtai.v1';
  var DAY = 86400000;

  /* ---------------------------------------------------------------- 工具 */
  function uid() {
    return 's' + Math.random().toString(36).slice(2, 8);
  }

  /* 确定性伪随机（mulberry32），保证每次生成的演示数据完全一致 */
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dateStr(ts) {
    var d = new Date(ts);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* ------------------------------------------------------------ 默认讲稿 */
  /* 6 段计划合计 480s（8 分钟）；正文字数按 240 字/分钟配比，约 1900 字，
     保证"预计讲完用时"略小于"计划总时长"，演示数据自洽 */
  function defaultSections() {
    return [
      {
        id: 's1', title: '开场与自我介绍', quota: 45, keys: ['各位老师', '答辩题目', '五个部分'],
        text: '各位老师好！我是计算机科学与技术专业的江辰，我的答辩题目是《基于端侧视觉的舞台演员追踪系统》。今天的汇报我会分成五个部分：先说选题背景和调研结论，再讲系统方案与技术路线，然后是核心实现和现场演示，接着汇报测试数据与对比结果，最后做一个小结和展望。整个汇报大约八分钟，如果各位老师对某个部分特别感兴趣，也欢迎随时打断我提问，我会展开讲。下面开始第一部分。'
      },
      {
        id: 's2', title: '选题背景与意义', quota: 90, keys: ['真实痛点', '市场空白', '调研'],
        text: '先说选题背景。我们团队在校园剧场和商业剧院两个场景下做了一轮调研，访谈了 62 位观众和 9 位剧院工作人员，回收 214 份有效问卷。调研之后，我们把观众的困扰归纳成三个真实痛点。第一个是信息分散，观众想知道某位演员最近在哪些城市巡演，只能同时翻五六个平台，各平台数据口径还不一样，排期经常互相冲突。第二个是信息滞后，就是临时换角、加场或者取消，往往要到演出前几小时才通知。第三个是座位遮挡不透明，同一个价位区间里，有些位置视野很好，有些会被立柱或者前排挡住，但购票页面只给一张平面示意图，观众只能靠猜，这个体验就很差。这三个痛点叠加起来，其实形成了一个明确的市场空白：目前没有人把演员档期、巡演城市和座位视野打通，做成能直接辅助购票决策的工具。所以这个课题的意义，就是把零散的信息重新组织起来，变成观众真正用得上的决策依据。'
      },
      {
        id: 's3', title: '方案设计与技术路线', quota: 110, keys: ['系统架构', '端侧推理', '合规'],
        text: '下面进入方案设计。系统整体采用端云协同的三层架构。表现层负责交互和可视化，包括首页聚合、演员详情、巡演地图和座位图四个核心界面。能力层封装三项基础能力，就是端侧海报识别、地理编码与路线计算、日历提醒与分享。数据层维护四类核心实体，演员、剧目、场次和座位，并通过参与式审核保证数据质量。技术路线上有三个关键取舍。第一个就是识别放在端侧还是云端，我们选择端侧，用轻量检测模型加文字识别在设备本地完成推理，这样做有两个好处，一是避免把观众拍摄的照片上传到服务器，隐私上更安全，二是弱网环境下也能用，而剧院地下层信号通常很差。第二个是地图的呈现方式，然后巡演城市我们采用抽象点位加连线表现路线，不引入未经审图的地图数据，既规避了合规风险，也降低了安装包体积。第三个是长尾数据的维护方式，我们交给众包，但任何一条修改都必须经过至少两次交叉验证才会生效，避免恶意篡改。其实整个方案的目标很明确，就是用尽量小的端侧开销，换尽量高的信息可信度。'
      },
      {
        id: 's4', title: '核心实现与现场演示', quota: 120, keys: ['关键实现', '遮挡量化', '现场演示'],
        text: '接下来是核心实现，我分三块讲。第一块就是识别链路。从观众按下快门到屏幕上出现结构化结果，一共经过五个环节：图片预处理、舞台区域定位、文字检测、文字识别，最后是语义结构化。我们在中端机型上测了两百次，平均端到端耗时 820 毫秒，其中文字识别大约占了六成，是这个环节的主要瓶颈，后续会优先在这一步做模型量化。第二块就是座位视野量化，这也是我们比较有原创性的部分。我们把每一个座位到舞台中心的视线做成一条直线，然后判断这条直线上是否存在立柱、音响或者灯架这样的固定遮挡物，再结合前排观众的平均身高做一个拟合修正，最后按照遮挡比例把座位划分成三个等级：绿色表示视野完整，黄色表示轻微遮挡但不影响主舞台，红色表示中度以上遮挡，可能看不全。观众点开任意一个座位，就能看到等级、方位、对应的票价区间，以及同价位里更优的选择。第三块就是排程提醒。观众选中关注的演员之后，可以一键把这个演员接下来的场次加进日历，如果巡演城市或者演出时间有变化，我们会推送提醒。这里给各位老师做一次现场演示，请看屏幕。'
      },
      {
        id: 's5', title: '测试验证与数据分析', quota: 70, keys: ['准确率', '性能', '对照实验'],
        text: '再汇报测试结果。然后识别模块我们自建了一个 480 张海报的测试集，覆盖 12 个城市的剧院宣传物料，包含中英文混排、暗光拍摄、倾斜拍摄这些比较难的情况。在这个测试集上，演员姓名抽取的准确率是 94.6%，召回率 91.2%，主要错误来自赞助商名单和演员名单排版非常接近。座位遮挡判定我们邀请了三位剧院工作人员做人工标注，系统判定与人工标注的一致率是 96.3%。性能方面，冷启动到可交互 1.4 秒，地图页在 60 帧率下连续运行十分钟没有掉帧。我们还做了一组对照实验，其实就是把端侧方案和纯云端方案放在同一个弱网场景下比较，端侧方案的响应时间缩短了 68%，同时全程没有上传任何一张原始图片。这组数据说明，前面在端侧的取舍是成立的。'
      },
      {
        id: 's6', title: '工作总结与致谢', quota: 45, keys: ['不足', '下一步', '感谢'],
        text: '最后就是做个小结。这个项目完成了三个目标：一是把分散的演员档期和巡演信息聚合到一个入口，二是把座位视野从模糊描述变成可量化的三级标注，三是把被动查询变成主动提醒。然后不足也有两点：样本城市覆盖还不够广，多语言海报的支持还在开发中。然后下一步我们计划补充更多城市的线下数据，同时开放接口给剧院方，让他们直接维护场次和座位信息，从源头上解决数据滞后。感谢指导老师的耐心指导，也感谢各位老师今天的提问，我的汇报到此结束，谢谢！'
      }
    ];
  }

  /* ------------------------------------------------------- 演示排练记录 */
  function defaultRecords(sections) {
    var rnd = seeded(20261014);
    var chars = sections.reduce(function (a, s) {
      return a + global.Analyze.countWords(s.text);
    }, 0);

    /* 6 次排练：越靠后越熟练——整体偏长幅度收窄、口头禅密度下降 */
    var profiles = [
      { back: -9, bias: 1.14, jitter: 0.09, density: 3.4 },
      { back: -7, bias: 1.11, jitter: 0.08, density: 3.0 },
      { back: -5, bias: 1.07, jitter: 0.07, density: 2.6 },
      { back: -3, bias: 1.04, jitter: 0.06, density: 2.1 },
      { back: -2, bias: 1.02, jitter: 0.05, density: 1.7 },
      { back: -1, bias: 1.01, jitter: 0.04, density: 1.3 }
    ];

    var now = new Date();
    var base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return profiles.map(function (p, pi) {
      var secs = sections.map(function (s, si) {
        /* 后段更易超时：给一个随段序递增的漂移 */
        var drift = 1 + si * 0.012;
        var noise = (rnd() * 2 - 1) * p.jitter;
        var actual = Math.round(s.quota * p.bias * drift * (1 + noise));
        return { id: s.id, title: s.title, quota: s.quota, actual: Math.max(5, actual) };
      });
      var totalQuota = secs.reduce(function (a, x) { return a + x.quota; }, 0);
      var totalActual = secs.reduce(function (a, x) { return a + x.actual; }, 0);
      /* p.back 为负值（-9 = 9 天前），因此用加法回推历史日期 */
      var at = base + p.back * DAY + 19 * 3600000 + pi * 900000;
      return {
        id: 'r' + (pi + 1),
        at: dateStr(at),
        atTs: at,
        totalQuota: totalQuota,
        totalActual: totalActual,
        sections: secs,
        fillers: {
          density: p.density,
          total: Math.round(chars * p.density / 100)
        }
      };
    });
  }

  /* --------------------------------------------------------------- 状态 */
  function defaults() {
    var sections = defaultSections();
    return {
      version: 1,
      event: { name: '课程答辩', quota: 480, speed: 240 },
      sections: sections,
      records: defaultRecords(sections),
      updatedAt: Date.now()
    };
  }

  var cache = null;

  function load() {
    if (cache) return cache;
    var data = null;
    try {
      var raw = global.localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.sections && parsed.sections.length) data = parsed;
      }
    } catch (e) { data = null; }
    if (!data) {
      data = defaults();
      /* 首次运行即落盘，保证演示数据在刷新后依然稳定（不依赖第一次 save） */
      try { global.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    }
    /* 兼容老版本缺字段 */
    if (!data.records) data.records = [];
    if (!data.event) data.event = { name: '课程答辩', quota: 480, speed: 240 };
    cache = data;
    return cache;
  }

  function save(data) {
    cache = data;
    cache.updatedAt = Date.now();
    try {
      global.localStorage.setItem(KEY, JSON.stringify(cache));
      return true;
    } catch (e) {
      return false;
    }
  }

  function reset() {
    cache = null;
    try { global.localStorage.removeItem(KEY); } catch (e) {}
    return load();
  }

  /* --------------------------------------------------------------- 操作 */
  function upsertSection(sec) {
    var d = load();
    if (!sec.id) sec.id = uid();
    var i = -1;
    for (var k = 0; k < d.sections.length; k++) if (d.sections[k].id === sec.id) i = k;
    if (i >= 0) d.sections[i] = sec; else d.sections.push(sec);
    save(d);
    return sec;
  }

  function deleteSection(id) {
    var d = load();
    d.sections = d.sections.filter(function (s) { return s.id !== id; });
    save(d);
  }

  function addRecord(rec) {
    var d = load();
    rec.id = rec.id || ('r' + Date.now());
    rec.atTs = rec.atTs || Date.now();
    if (!rec.at) rec.at = dateStr(rec.atTs);
    d.records.push(rec);
    d.records.sort(function (a, b) { return (a.atTs || 0) - (b.atTs || 0); });
    save(d);
    return rec;
  }

  function deleteRecord(id) {
    var d = load();
    d.records = d.records.filter(function (r) { return r.id !== id; });
    save(d);
  }

  /* ----------------------------------------------------------- 统计摘要 */
  function stats(records) {
    if (!records || !records.length) {
      return { count: 0, avg: 0, best: null, worst: null, avgDev: 0, trendDown: 0 };
    }
    var totals = records.map(function (r) { return r.totalActual; });
    var avg = totals.reduce(function (a, b) { return a + b; }, 0) / totals.length;
    var best = Math.min.apply(null, totals);
    var worst = Math.max.apply(null, totals);
    var devs = records.map(function (r) { return r.totalActual - r.totalQuota; });
    var avgDev = devs.reduce(function (a, b) { return a + b; }, 0) / devs.length;

    /* 口头禅密度趋势：线性回归斜率（每场变化量），负值代表在进步 */
    var n = records.length;
    var xs = records.map(function (_, i) { return i; });
    var ys = records.map(function (r) { return (r.fillers && r.fillers.density) || 0; });
    var mx = xs.reduce(function (a, b) { return a + b; }, 0) / n;
    var my = ys.reduce(function (a, b) { return a + b; }, 0) / n;
    var num = 0, den = 0;
    for (var i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) * (xs[i] - mx); }
    var slope = den ? num / den : 0;

    return {
      count: n,
      avg: avg,
      best: best,
      worst: worst,
      avgDev: avgDev,
      first: records[0],
      last: records[n - 1],
      fillerSlope: slope
    };
  }

  /* ----------------------------------------------------------- 导入导出 */
  function exportJSON() {
    var d = load();
    var payload = {
      app: 'DengTai',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: d
    };
    return JSON.stringify(payload, null, 2);
  }

  function importJSON(text) {
    var obj = JSON.parse(text);
    var d = obj && obj.data ? obj.data : obj;
    if (!d || !d.sections || !d.sections.length) throw new Error('文件格式不正确：缺少讲稿分段');
    cache = null;
    save({
      version: 1,
      event: d.event || { name: '课程答辩', quota: 480, speed: 240 },
      sections: d.sections,
      records: d.records || []
    });
    return load();
  }

  global.Store = {
    KEY: KEY,
    load: load,
    save: save,
    reset: reset,
    upsertSection: upsertSection,
    deleteSection: deleteSection,
    addRecord: addRecord,
    deleteRecord: deleteRecord,
    stats: stats,
    exportJSON: exportJSON,
    importJSON: importJSON,
    defaults: defaults,
    dateStr: dateStr
  };
})(window);
