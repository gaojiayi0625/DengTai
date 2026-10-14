/* ============================================================================
 * 登台 DengTai · 应用层
 * ----------------------------------------------------------------------------
 * 路由：#/script 讲稿工作台 · #/prompter 提词排练 · #/review 练习复盘 · #/about 关于
 * 核心：全屏提词器（自动滚动 / 分段计时 / 三色预警 / 口头禅检测）
 * ========================================================================== */
(function (global) {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var A = global.Analyze, S = global.Store, CH = global.Charts;

  /* ------------------------------------------------------------- 小工具 */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function deviationTag(dev) {
    if (dev === 0) return '<span class="pill pill-gray">持平</span>';
    if (dev > 0) return '<span class="pill pill-red">超时 +' + dev + 's</span>';
    return '<span class="pill pill-green">提前 ' + dev + 's</span>';
  }

  /* ======================================================================
   * 一、讲稿工作台
   * ==================================================================== */
  function renderScript() {
    var d = S.load();
    var secs = d.sections;
    var speed = d.event.speed || A.DEFAULT_SPEED;
    var totalQuota = secs.reduce(function (a, s) { return a + (s.quota || 0); }, 0);
    var totalChars = secs.reduce(function (a, s) { return a + A.countWords(s.text); }, 0);
    var plan = A.planTimeline(secs);
    var estSeconds = totalChars / speed * 60;

    /* 逐段口头禅（合并全文统计） */
    var allText = secs.map(function (s) { return s.text; }).join('');
    var filler = A.detectFillers(allText);
    var verdict = A.fillerVerdict(filler.density);

    var h = '';

    /* KPI 行 */
    h += '<div class="grid grid-4">'
      + kpi('讲稿总字数', totalChars, '字', 'gold', '按中文逐字计，英文数字折 2 字')
      + kpi('预计讲完用时', A.fmt(estSeconds), '', estSeconds <= totalQuota ? 'green' : 'red', '语速 ' + speed + ' 字/分钟')
      + kpi('计划总时长', A.fmt(totalQuota), '', 'blue', secs.length + ' 个分段')
      + kpi('口头禅密度', filler.density.toFixed(2), '处/百字', filler.density <= 2.5 ? 'green' : 'red',
        '全文 ' + filler.total + ' 处 · ' + verdict.text)
      + '</div>';

    /* 主体两栏 */
    h += '<div class="ws-grid mt16">';

    /* 左：分段列表 */
    h += '<div class="card">'
      + '<div class="card-head"><h3>讲稿分段</h3>'
      + '<div style="display:flex;gap:8px;align-items:center">'
      + '<span class="hint">点击任意分段编辑</span>'
      + '<button class="btn btn-ghost btn-sm" data-act="add-sec">+ 新增分段</button>'
      + '</div></div>'
      + '<div class="sec-list">';
    if (!secs.length) {
      h += '<div class="empty"><div class="big">✎</div><h3>还没有分段</h3><p>点击右上角新增第一段讲稿</p></div>';
    }
    secs.forEach(function (s, i) {
      var chars = A.countWords(s.text);
      var est = chars / speed * 60;
      var over = est > s.quota;
      h += '<div class="sec-item" data-act="edit-sec" data-id="' + s.id + '">'
        + '<div class="sec-idx">' + (i + 1) + '</div>'
        + '<div class="sec-main">'
        + '<div class="sec-title">' + esc(s.title) + '</div>'
        + '<div class="sec-prev">' + esc(s.text.slice(0, 62) || '（尚未填写内容）') + '</div>'
        + '</div>'
        + '<div class="sec-meta">'
        + '<div class="sec-quota">' + s.quota + '<small>s</small></div>'
        + '<div class="sec-words" style="color:' + (over ? '#ff9d9d' : '#6f7aa3') + '">'
        + chars + ' 字 · 约 ' + Math.round(est) + 's</div>'
        + '</div></div>';
    });
    h += '</div>';

    /* 时长分配条 */
    if (secs.length) {
      h += '<div class="mt16"><div class="card-head" style="margin-bottom:8px">'
        + '<h3 style="font-size:14px">时长分配</h3><span class="hint">共 ' + A.fmt(totalQuota) + '</span></div>'
        + CH.stackBar(secs, totalQuota || 1) + '</div>';
    }
    h += '</div>';

    /* 右：口头禅 + 设置 */
    h += '<div class="grid">';

    h += '<div class="card">'
      + '<div class="card-head"><h3>口头禅检测</h3>'
      + '<span class="pill ' + (filler.density <= 2.5 ? 'pill-green' : 'pill-red') + '">' + verdict.text + '</span></div>';
    if (!filler.items.length) {
      h += '<div class="hint">未检测到常见口头禅，表达很干净。</div>';
    } else {
      var maxN = filler.items[0].n || 1;
      h += '<div class="hint">全文共 ' + filler.total + ' 处，密度 ' + filler.density.toFixed(2) + ' 处/百字</div>';
      h += '<div class="filler-list">';
      filler.items.slice(0, 7).forEach(function (it) {
        h += '<div class="filler-row">'
          + '<span class="filler-word">' + esc(it.word) + '</span>'
          + '<span class="filler-bar"><i style="width:' + (it.n / maxN * 100).toFixed(1) + '%"></i></span>'
          + '<span class="filler-n">' + it.n + ' 次</span>'
          + '</div>';
      });
      h += '</div>';
      h += '<div class="hint mt16">建议：把高频口头禅改成 0.5 秒停顿，既自然又能压时长。</div>';
    }
    h += '</div>';

    h += '<div class="card">'
      + '<div class="card-head"><h3>排练设置</h3><span class="hint">影响预计用时与滚动速度</span></div>'
      + '<label class="hint" style="display:block;margin-bottom:6px">讲稿语速（字/分钟）</label>'
      + '<select class="input" data-act="speed" style="margin-bottom:14px">'
      + [180, 200, 220, 240, 260, 280, 300].map(function (v) {
        return '<option value="' + v + '"' + (v === speed ? ' selected' : '') + '>' + v + ' 字/分钟'
          + (v === 240 ? '（常规）' : v === 200 ? '（稳健）' : v === 280 ? '（偏快）' : '') + '</option>';
      }).join('')
      + '</select>'
      + '<label class="hint" style="display:block;margin-bottom:6px">活动名称</label>'
      + '<input class="input" data-act="event-name" value="' + esc(d.event.name) + '" style="margin-bottom:16px" />'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="btn btn-primary" data-act="run">进入排练</button>'
      + '<button class="btn btn-ghost" data-act="import">导入</button>'
      + '<button class="btn btn-ghost" data-act="export">导出</button>'
      + '<button class="btn btn-danger" data-act="reset">恢复演示数据</button>'
      + '</div>'
      + '</div>';

    h += '</div>'; /* grid */
    h += '</div>'; /* ws-grid */

    $('#view').innerHTML = h;
  }

  function kpi(label, value, unit, tone, foot) {
    return '<div class="card"><div class="kpi-label">' + esc(label) + '</div>'
      + '<div class="kpi-value tone-' + tone + '">' + esc(value)
      + (unit ? '<small>' + esc(unit) + '</small>' : '') + '</div>'
      + '<div class="kpi-foot">' + esc(foot) + '</div></div>';
  }

  /* ======================================================================
   * 二、提词排练（准备页 + 全屏提词器）
   * ==================================================================== */
  function renderPrompterPrep() {
    var d = S.load();
    var secs = d.sections;
    var totalQuota = secs.reduce(function (a, s) { return a + (s.quota || 0); }, 0);
    var totalChars = secs.reduce(function (a, s) { return a + A.countWords(s.text); }, 0);
    var h = '';

    h += '<div class="grid grid-4">'
      + kpi('即将上场', d.event.name, '', 'gold', '共 ' + secs.length + ' 个分段')
      + kpi('总计时上限', A.fmt(totalQuota), '', 'blue', '绿灯 > 60s · 黄灯 ≤ 60s · 红灯超时')
      + kpi('全文可读字数', totalChars, '字', 'green', '自动滚动按语速换算')
      + kpi('连续排练', (S.load().records || []).length, '次', 'blue', '历史记录可在复盘页查看')
      + '</div>';

    h += '<div class="grid grid-32 mt16">';
    h += '<div class="card">'
      + '<div class="card-head"><h3>出场前检查</h3><span class="hint">这些都会在提词器中实时提示</span></div>'
      + '<table class="list"><thead><tr><th style="width:52px">顺序</th><th>分段</th><th style="width:90px">计划</th><th style="width:90px">字数</th><th style="width:110px">预计用时</th></tr></thead><tbody>';
    secs.forEach(function (s, i) {
      var chars = A.countWords(s.text);
      var est = Math.round(chars / (d.event.speed || 240) * 60);
      h += '<tr><td>' + (i + 1) + '</td><td>' + esc(s.title) + '</td><td>' + s.quota + 's</td><td>' + chars + '</td>'
        + '<td>' + (est > s.quota
          ? '<span class="pill pill-red">' + est + 's</span>'
          : '<span class="pill pill-green">' + est + 's</span>') + '</td></tr>';
    });
    h += '</tbody></table></div>';

    h += '<div class="card" style="text-align:center;display:flex;flex-direction:column;justify-content:center;gap:14px">'
      + '<div style="font-size:52px;line-height:1">🎬</div>'
      + '<h3 style="margin:0;font-size:17px">准备好了就上台</h3>'
      + '<div class="hint">全屏提词 · 自动滚动 · 三色倒计时<br/>空格 开始/暂停 · ← → 切段 · 滚轮调速 · Esc 退出</div>'
      + '<button class="btn btn-primary" data-act="run" style="padding:13px 22px;font-size:15px">开始排练</button>'
      + '<div class="hint">首次进入请把浏览器切到全屏（F11），<br/>观众视角更接近真实舞台。</div>'
      + '</div>';
    h += '</div>';

    $('#view').innerHTML = h;
  }

  /* --------------------------------------------------- 提词器运行时状态 */
  var P = {
    on: false,
    running: false,
    elapsed: 0,
    lastTs: 0,
    speed: 240,
    secIndex: 0,
    timeSpent: [],
    raf: 0,
    paras: [],
    curPara: 0,
    y: 0,
    fontScale: 1,
    mirror: false,
    mic: null,
    micStream: null
  };

  /** 把一段文字切成适合提词的"段"（按句号聚合，约 40 字一段） */
  function splitParas(text, maxLen) {
    maxLen = maxLen || 44;
    var sents = String(text || '').match(/[^。！？；!?;]*[。！？；!?;]|[^。！？；!?;]+/g) || [];
    var out = [], buf = '';
    sents.forEach(function (s) {
      s = s.trim();
      if (!s) return;
      if (buf && (buf + s).length > maxLen) { out.push(buf); buf = s; }
      else buf += s;
    });
    if (buf) out.push(buf);
    return out.length ? out : [''];
  }

  /** 关键词加粗（返回 HTML） */
  function markKeys(text, keys) {
    var html = esc(text);
    (keys || []).forEach(function (k) {
      if (!k) return;
      k = String(k).trim();
      if (!k) return;
      var re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      html = html.replace(re, function (m) { return '<span class="kw">' + m + '</span>'; });
    });
    return html;
  }

  var P_EL = {};

  function prompterInit() {
    P_EL.wrap = $('#prompter');
    P_EL.timer = $('#p-timer');
    P_EL.section = $('#p-section');
    P_EL.secbar = $('#p-secbar');
    P_EL.secinfo = $('#p-secinfo');
    P_EL.play = $('#p-play');
    P_EL.flow = $('#p-flow');
    P_EL.stage = $('#p-stage');
    P_EL.mic = $('#p-mic');
    P_EL.micBar = $('#p-mic-bar');
  }

  /** 构建提词内容与滚动基准 */
  function buildFlow() {
    var d = S.load();
    var speed = P.speed;
    var paras = [];
    var html = '';
    d.sections.forEach(function (s, si) {
      var list = splitParas(s.text);
      list.forEach(function (t, k) {
        var chars = A.countWords(t);
        paras.push({
          sec: si,
          text: t,
          chars: chars,
          secStart: 0,
          secEnd: 0
        });
        html += '<p class="p-para" data-sec="' + si + '" data-k="' + k + '">'
          + (k === 0 ? '<span class="sec-tag">' + esc(s.title) + ' · ' + s.quota + 's</span><br/>' : '')
          + markKeys(t, s.keys) + '</p>';
      });
    });
    P_EL.flow.innerHTML = html;
    /* 累计每段结束时的"文稿时间"（按语速换算） */
    var acc = 0;
    paras.forEach(function (p) {
      p.secStart = acc;
      acc += p.chars / speed * 60;
      p.secEnd = acc;
    });
    P.paras = paras;
    /* 记录每段的真实累计用时 */
    P.timeSpent = d.sections.map(function () { return 0; });
    P.y = 0;
    P.curPara = 0;
    P_EL.flow.style.transform = 'translateY(0px)';
  }

  function openPrompter() {
    var d = S.load();
    if (!d.sections.length) { toast('请先在讲稿工作台添加分段'); return; }
    P.speed = d.event.speed || 240;
    P.on = true;
    P.running = false;
    P.elapsed = 0;
    P.secIndex = 0;
    P.fontScale = 1;
    P_EL.wrap.classList.remove('hidden');
    buildFlow();
    renderHud(0);
    requestAnimationFrame(tick);
    toast('空格 开始 · Esc 退出');
  }

  function closePrompter() {
    P.on = false;
    P.running = false;
    cancelAnimationFrame(P.raf);
    P.raf = 0;
    P_EL.wrap.classList.add('hidden');
    stopMic();
  }

  function timeline() {
    return A.planTimeline(S.load().sections);
  }

  function renderHud(elapsed) {
    var tl = timeline();  /* 每秒重建，保证编辑后即时生效 */
    var total = tl.total;
    var loc = A.locate(tl.timeline, elapsed);
    var seg = tl.timeline[loc.index] || { quota: 1, start: 0, title: '' };
    var detail = S.load().sections[loc.index] || { title: '' };

    P_EL.timer.textContent = A.fmt(elapsed) + ' / ' + A.fmt(total);
    var tr = A.traffic(total, elapsed);
    P_EL.timer.className = 'p-timer' + (tr.level === 'warn' ? ' warn' : tr.level === 'over' ? ' over' : '');

    P_EL.section.textContent = (loc.index + 1) + '. ' + (detail.title || '');
    var pct = Math.max(0, Math.min(100, (elapsed - seg.start) / seg.quota * 100));
    P_EL.secbar.style.width = pct.toFixed(1) + '%';

    var spent = Math.round(elapsed - seg.start);      /* 本段已用 */
    var over = spent - seg.quota;                      /* 相对本段计划的超出量 */
    var devHtml = over > 0
      ? '<span class="late">本段超出 ' + over + 's</span>'
      : '<span class="early">本段剩余 ' + (-over) + 's</span>';
    P_EL.secinfo.innerHTML = '计划 ' + seg.quota + 's · 已用 ' + spent + 's · ' + devHtml
      + ' · 整体' + (tr.level === 'over' ? '已超时 ' + A.fmt(-tr.remain) : '余 ' + A.fmt(tr.remain));
  }

  function tick(ts) {
    if (!P.on) return;
    if (!P.lastTs) P.lastTs = ts;
    var dt = Math.min(0.25, (ts - P.lastTs) / 1000);
    P.lastTs = ts;

    if (P.running) {
      P.elapsed += dt;
      if (P.timeSpent[P.secIndex] != null) P.timeSpent[P.secIndex] += dt;
    }

    renderHud(P.elapsed);
    autoScroll();
    drawMic();
    P.raf = requestAnimationFrame(tick);
  }

  /** 根据文稿时间把"当前段"滚到舞台中部 */
  function autoScroll() {
    var paras = P.paras;
    if (!paras.length) return;
    var t = P.elapsed;
    var idx = 0;
    for (var i = 0; i < paras.length; i++) {
      if (t >= paras[i].secStart) idx = i;
      if (t < paras[i].secEnd) break;
    }
    idx = Math.min(idx, paras.length - 1);

    if (idx !== P.curPara) {
      var prev = $$('.p-para', P_EL.flow)[P.curPara];
      var cur = $$('.p-para', P_EL.flow)[idx];
      if (prev) prev.classList.remove('current');
      if (cur) cur.classList.add('current');
      /* 已读段落淡化 */
      $$('.p-para', P_EL.flow).forEach(function (el, i) {
        el.classList.toggle('done', i < idx);
      });
      P.curPara = idx;
      /* 段落切换同步当前分段 */
      var sec = paras[idx].sec;
      if (sec !== P.secIndex) P.secIndex = sec;
    }

    var node = $$('.p-para', P_EL.flow)[idx];
    if (!node) return;
    var stageH = P_EL.stage.clientHeight;
    var target = stageH * 0.44 - (node.offsetTop + node.offsetHeight / 2);
    /* 阻尼跟随，避免跳变 */
    P.y += (target - P.y) * 0.08;
    var extra = P.fontScale !== 1 ? '' : '';
    P_EL.flow.style.transform = 'translateY(' + P.y.toFixed(1) + 'px)' + extra;
  }

  /* --------------------------------------------------------- 麦克风监测 */
  function startMic() {
    if (!global.navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('当前环境不支持麦克风监测'); return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      P.micStream = stream;
      var ctx = new (global.AudioContext || global.webkitAudioContext)();
      var src = ctx.createMediaStreamSource(stream);
      var an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      P.mic = { ctx: ctx, an: an, buf: new Uint8Array(an.frequencyBinCount) };
      P_EL.mic.hidden = false;
      toast('麦克风已开启，音量条会随语速跳动');
    }).catch(function () {
      toast('无法访问麦克风（可继续使用计时与提词）');
    });
  }

  function stopMic() {
    if (P.mic && P.mic.ctx) { try { P.mic.ctx.close(); } catch (e) {} }
    if (P.micStream) { P.micStream.getTracks().forEach(function (t) { t.stop(); }); }
    P.mic = null; P.micStream = null;
    if (P_EL.mic) P_EL.mic.hidden = true;
  }

  function drawMic() {
    if (!P.mic) return;
    P.mic.an.getByteTimeDomainData(P.mic.buf);
    var sum = 0;
    for (var i = 0; i < P.mic.buf.length; i++) {
      var v = (P.mic.buf[i] - 128) / 128;
      sum += v * v;
    }
    var rms = Math.sqrt(sum / P.mic.buf.length);
    var pct = Math.min(100, rms * 320);
    P_EL.micBar.style.width = pct.toFixed(0) + '%';
  }

  /* ----------------------------------------------------------- 结束排练 */
  function finishPrompter() {
    var d = S.load();
    var secs = d.sections;
    if (!secs.length) { closePrompter(); return; }
    var totalActual = 0;
    var secsRec = secs.map(function (s, i) {
      var actual = Math.round(P.timeSpent[i] || 0);
      totalActual += actual;
      return { id: s.id, title: s.title, quota: s.quota, actual: actual };
    });
    var allText = secs.map(function (s) { return s.text; }).join('');
    var f = A.detectFillers(allText);

    var rec = S.addRecord({
      atTs: Date.now(),
      totalQuota: secs.reduce(function (a, s) { return a + s.quota; }, 0),
      totalActual: totalActual,
      sections: secsRec,
      fillers: { total: f.total, density: f.density }
    });

    closePrompter();
    go('review');
    toast('已保存本次排练：' + A.fmt(rec.totalActual) + ' / 计划 ' + A.fmt(rec.totalQuota));
  }

  /* ======================================================================
   * 三、练习复盘
   * ==================================================================== */
  var selRecord = null;

  function renderReview() {
    var d = S.load();
    var recs = (d.records || []).slice().sort(function (a, b) { return (a.atTs || 0) - (b.atTs || 0); });
    var st = S.stats(recs);
    var h = '';

    if (!recs.length) {
      $('#view').innerHTML = '<div class="card"><div class="empty"><div class="big">◫</div>'
        + '<h3>还没有排练记录</h3><p>去「提词排练」跑一次，结束后会自动保存这里</p></div></div>';
      return;
    }

    h += '<div class="grid grid-4">'
      + kpi('累计排练', st.count, '次', 'blue', st.first.at + ' 起')
      + kpi('平均总用时', A.fmt(st.avg), '', 'gold', '目标 ' + A.fmt(recs[0].totalQuota))
      + kpi('平均偏差', (st.avgDev >= 0 ? '+' : '') + Math.round(st.avgDev) + 's', '', Math.abs(st.avgDev) <= 15 ? 'green' : 'red',
        st.avgDev > 0 ? '整体偏慢，注意压缩过场' : '整体偏快，可以多留停顿')
      + kpi('最近成绩', A.fmt(st.last.totalActual), '', 'green',
        '口头禅 ' + (st.last.fillers ? st.last.fillers.density.toFixed(1) : '0') + ' 处/百字')
      + '</div>';

    /* 趋势图 */
    h += '<div class="grid grid-2 mt16">';
    h += '<div class="card"><div class="card-head"><h3>总用时趋势</h3><span class="hint">越贴近虚线（目标）越稳</span></div>'
      + CH.line({
        width: 620, height: 240,
        labels: recs.map(function (r) { return r.at.slice(5); }),
        unit: 's',
        goal: recs[0].totalQuota,
        goalText: '目标 ' + recs[0].totalQuota + 's',
        series: [{ name: '总用时', color: CH.COLORS.gold, area: true, values: recs.map(function (r) { return r.totalActual; }) }]
      }) + '</div>';

    h += '<div class="card"><div class="card-head"><h3>口头禅密度趋势</h3><span class="hint">'
      + (st.fillerSlope < -0.05 ? '持续下降，表达在变干净' : '保持关注')
      + '</span></div>'
      + CH.line({
        width: 620, height: 240,
        labels: recs.map(function (r) { return r.at.slice(5); }),
        decimals: 1, yMin: 0,
        series: [{
          name: '密度', color: CH.COLORS.green, area: true,
          values: recs.map(function (r) { return +(r.fillers ? r.fillers.density : 0).toFixed(1); })
        }]
      }) + '</div>';
    h += '</div>';

    /* 选中记录的分段对比 */
    var sel = selRecord || recs[recs.length - 1].id;
    var rec = recs.filter(function (r) { return r.id === sel; })[0] || recs[recs.length - 1];
    selRecord = rec.id;

    h += '<div class="grid grid-32 mt16">';
    h += '<div class="card"><div class="card-head"><h3>' + rec.at + ' · 各段计划 vs 实际</h3>'
      + '<span class="hint">' + (rec.totalActual - rec.totalQuota >= 0 ? '总超时 +' : '总提前 ')
      + Math.abs(rec.totalActual - rec.totalQuota) + 's</span></div>'
      + CH.bars({
        width: 700, height: 250, unit: 's',
        labels: rec.sections.map(function (s) { return s.title.length > 6 ? s.title.slice(0, 6) + '|' + s.title.slice(6) : s.title; }),
        series: [
          { name: '计划', color: '#4a5480', values: rec.sections.map(function (s) { return s.quota; }) },
          { name: '实际', color: CH.COLORS.gold, values: rec.sections.map(function (s) { return s.actual; }) }
        ]
      })
      + '<div class="legend">'
      + '<span><i style="background:#4a5480"></i>计划用时</span>'
      + '<span><i style="background:' + CH.COLORS.gold + '"></i>实际用时</span>'
      + '</div>'
      + '</div>';

    h += '<div class="card"><div class="card-head"><h3>偏差定位</h3><span class="hint">哪一段拖了后腿</span></div>'
      + CH.hbar(rec.sections.map(function (s) { return { title: s.title, dev: s.actual - s.quota }; }), { width: 640, rowH: 36 })
      + '</div>';
    h += '</div>';

    /* 历史表 */
    h += '<div class="card mt16"><div class="card-head"><h3>排练历史</h3><span class="hint">点击行查看该次分段对比</span></div>'
      + '<table class="list"><thead><tr>'
      + '<th style="width:110px">日期</th><th style="width:110px">总用时</th><th style="width:120px">偏差</th>'
      + '<th style="width:130px">口头禅密度</th><th>分段用时</th><th style="width:80px">操作</th>'
      + '</tr></thead><tbody>';
    recs.slice().reverse().forEach(function (r) {
      var dev = r.totalActual - r.totalQuota;
      var minA = Math.min.apply(null, r.sections.map(function (s) { return Math.min(s.quota, s.actual); }));
      var maxA = Math.max.apply(null, r.sections.map(function (s) { return Math.max(s.quota, s.actual); }));
      var spark = r.sections.map(function (s) {
        var pct = Math.round(Math.abs(s.actual - s.quota) / Math.max(1, maxA - minA) * 100);
        var col = s.actual > s.quota ? '#e05252' : '#35c08a';
        return '<span title="' + esc(s.title) + ' ' + s.actual + 's" style="display:inline-block;width:46px;height:8px;border-radius:20px;background:rgba(255,255,255,.07);margin-right:5px;vertical-align:middle">'
          + '<i style="display:block;height:100%;width:' + Math.max(12, pct) + '%;border-radius:20px;background:' + col + '"></i></span>';
      }).join('');
      h += '<tr data-act="pick-rec" data-id="' + r.id + '" style="cursor:pointer">'
        + '<td>' + esc(r.at) + '</td>'
        + '<td style="font-weight:650">' + A.fmt(r.totalActual) + '</td>'
        + '<td>' + deviationTag(dev) + '</td>'
        + '<td>' + (r.fillers ? r.fillers.density.toFixed(1) : '-') + ' 处/百字</td>'
        + '<td>' + spark + '</td>'
        + '<td><button class="btn btn-danger btn-sm" data-act="del-rec" data-id="' + r.id + '">删除</button></td>'
        + '</tr>';
    });
    h += '</tbody></table></div>';

    $('#view').innerHTML = h;
  }

  /* ======================================================================
   * 四、关于
   * ==================================================================== */
  function renderAbout() {
    var d = S.load();
    var h = '';
    h += '<div class="grid grid-32">';
    h += '<div class="card doc">'
      + '<h3>登台 DengTai 是什么</h3>'
      + '<p>一个给「要上台讲话的人」用的 PC 端工作台。课程答辩、比赛路演、组会汇报——真正的问题是<b>超时、忘词、节奏失控</b>，而答辩现场一定有一台电脑，所以把工具做成网页应用，双击就能用、完全离线、不需要装任何东西。</p>'

      + '<h3>三件事，一个闭环</h3>'
      + '<ul>'
      + '<li><b>讲稿工作台</b>：按分段录入讲稿，自动统计字数、按语速换算预计用时，并检测口头禅分布，提前发现"话太满"和"话太碎"。</li>'
      + '<li><b>提词排练</b>：全屏提词器，讲稿按语速自动滚动，当前句高亮、已读句淡出；顶部是绿/黄/红三色倒计时与本段进度条，脚下有麦克风音量条提醒"声音是不是太小了"。</li>'
      + '<li><b>练习复盘</b>：每次排练的分段实际用时全部记录，用计划 vs 实际对比柱状图和"提前/超时"偏差图告诉你哪一段在拖后腿，再用趋势线看自己有没有真的在进步。</li>'
      + '</ul>'

      + '<h3>核心算法</h3>'
      + '<div class="formula">预计用时（秒）= 讲稿字数 ÷ 语速（字/分钟）× 60</div>'
      + '<p>字数统计按中文逐字计，连续英文/数字按 2 个汉字折算。默认语速 240 字/分钟（正常演讲 200～260），可在讲稿工作台调整，调整后预计用时与提词器滚动速度同步变化。</p>'
      + '<div class="formula">口头禅密度 = 填充词出现次数 ÷ 讲稿字数 × 100（处/百字）</div>'
      + '<p>填充词表覆盖 <code>' + A.FILLERS.slice(0, 10).join('、') + '</code> 等 ' + A.FILLERS.length + ' 个高频虚词。密度 ≤ 1.0 判断为"表达干净"，1.0～2.5 为"略有"，2.5～4.5 为"偏多"，> 4.5 建议逐句打磨。</p>'
      + '<p style="color:#6f7aa3">需要说明：该检测基于词表频率统计，属于启发式方法——"第一个就是……"这类正常用法也会被计入，所以它的定位是提醒你回看讲稿，而不是替你下结论。</p>'
      + '<div class="formula">倒计时分级：剩余 &gt; 60s 绿灯　|　0 ≤ 剩余 ≤ 60s 黄灯　|　剩余 &lt; 0 红灯超时</div>'

      + '<h3>快捷键</h3>'
      + '<ul>'
      + '<li><code>空格</code> 开始 / 暂停计时与滚动</li>'
      + '<li><code>← →</code> 跳到上一段 / 下一段开头</li>'
      + '<li><code>滚轮</code> 手动微调语速（滚动速度）</li>'
      + '<li><code>M</code> 开启 / 关闭麦克风音量监测</li>'
      + '<li><code>R</code> 重置本次排练　<code>Esc</code> 退出提词器</li>'
      + '</ul>'

      + '<h3>数据与隐私</h3>'
      + '<p>所有讲稿和排练记录都只存在你本机的浏览器本地存储里（<code>localStorage</code>），不上传任何服务器；麦克风只用于实时计算音量，不做录音、不保存。换电脑时用"导出"生成 JSON 备份，在新机器上"导入"即可。</p>'
      + '<p>首次打开会内置 6 次演示排练记录，模拟一场答辩从初稿到定稿的打磨过程；想重新来一遍，用讲稿工作台里的「恢复演示数据」。</p>'
      + '</div>';

    h += '<div class="grid">'
      + '<div class="card">'
      + '<div class="card-head"><h3>当前数据</h3></div>'
      + kpi('分段数', d.sections.length, '段', 'gold', '共 ' + d.sections.reduce(function (a, s) { return a + A.countWords(s.text); }, 0) + ' 字')
      + '<div style="height:14px"></div>'
      + kpi('排练记录', (d.records || []).length, '次', 'blue', '可导出备份')
      + '</div>'
      + '<div class="card">'
      + '<div class="card-head"><h3>导出 / 导入</h3></div>'
      + '<div class="hint" style="line-height:2">导出文件为纯文本 JSON，包含讲稿分段与全部排练记录。<br/>导入会覆盖当前数据，建议先导出一次备份。</div>'
      + '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'
      + '<button class="btn btn-primary" data-act="export">导出备份</button>'
      + '<button class="btn btn-ghost" data-act="import">导入备份</button>'
      + '</div>'
      + '<div class="hint mt16">版本 v1.0 · 零第三方依赖 · 单页离线应用</div>'
      + '</div>'
      + '</div>';
    h += '</div>';
    $('#view').innerHTML = h;
  }

  /* ======================================================================
   * 五、分段编辑弹层
   * ==================================================================== */
  var editing = null;

  function openModal(id) {
    var d = S.load();
    var sec = id ? d.sections.filter(function (s) { return s.id === id; })[0] : null;
    editing = sec ? sec.id : null;
    $('#modal-title').textContent = sec ? '编辑分段' : '新增分段';
    $('#f-title').value = sec ? sec.title : '';
    $('#f-text').value = sec ? sec.text : '';
    $('#f-quota').value = sec ? sec.quota : 45;
    $('#f-keys').value = sec ? (sec.keys || []).join(', ') : '';
    $('#modal-del').style.visibility = sec ? 'visible' : 'hidden';
    $('#modal-mask').classList.add('show');
    setTimeout(function () { $('#f-title').focus(); }, 30);
  }

  function closeModal() {
    $('#modal-mask').classList.remove('show');
    editing = null;
  }

  function saveModal() {
    var title = $('#f-title').value.trim() || '未命名分段';
    var text = $('#f-text').value;
    var quota = Math.max(5, parseInt($('#f-quota').value, 10) || 30);
    var keys = $('#f-keys').value.split(/[,，、]/).map(function (s) { return s.trim(); }).filter(Boolean);
    S.upsertSection({ id: editing || undefined, title: title, text: text, quota: quota, keys: keys });
    closeModal();
    route();
    toast('已保存：' + title);
  }

  /* ======================================================================
   * 六、导入导出
   * ==================================================================== */
  function doExport() {
    var d = S.load();
    var blob = new Blob([S.exportJSON()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '登台备份-' + S.dateStr(Date.now()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
    toast('已导出：讲稿 ' + d.sections.length + ' 段 + 记录 ' + d.records.length + ' 条');
  }

  function doImport() {
    $('#file-import').click();
  }

  /* ======================================================================
   * 七、路由与事件
   * ==================================================================== */
  function route() {
    var hash = (location.hash || '#/script').replace(/^#\/?/, '');
    var name = hash.split('?')[0] || 'script';
    if (['script', 'prompter', 'review', 'about'].indexOf(name) < 0) name = 'script';

    $$('.nav-item').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-route') === name);
    });
    $('#event-chip').textContent = S.load().event.name + ' · ' + A.fmt(S.load().sections.reduce(function (a, s) { return a + s.quota; }, 0));

    if (name === 'script') renderScript();
    else if (name === 'prompter') renderPrompterPrep();
    else if (name === 'review') renderReview();
    else renderAbout();

    if (global.__dengtaiAfterRender) global.__dengtaiAfterRender(name);
    window.scrollTo(0, 0);
  }

  /** 跳转到指定页面：改 hash 后直接渲染，
      不依赖 hashchange（部分环境/嵌入式浏览器下该事件不触发） */
  function go(name) {
    var target = '#/' + name;
    if (location.hash !== target) location.hash = target;
    route();
  }

  function onViewClick(e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    var d = S.load();

    if (act === 'add-sec') { openModal(null); }
    else if (act === 'edit-sec') { openModal(t.getAttribute('data-id')); }
    else if (act === 'run') { go('prompter'); openPrompter(); }
    else if (act === 'export') { doExport(); }
    else if (act === 'import') { doImport(); }
    else if (act === 'reset') {
      if (confirm('恢复演示数据？当前讲稿与全部排练记录将被覆盖。')) {
        S.reset(); route(); toast('已恢复演示数据');
      }
    }
    else if (act === 'pick-rec') {
      selRecord = t.getAttribute('data-id');
      renderReview();
    }
    else if (act === 'del-rec') {
      e.stopPropagation();
      var id = t.getAttribute('data-id');
      if (confirm('删除这条排练记录？')) {
        S.deleteRecord(id);
        if (selRecord === id) selRecord = null;
        renderReview();
        toast('已删除');
      }
    }
  }

  function onViewChange(e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var act = t.getAttribute('data-act');
    if (act === 'speed') {
      var d = S.load();
      d.event.speed = parseInt(t.value, 10) || 240;
      S.save(d);
      renderScript();
      toast('语速已设为 ' + d.event.speed + ' 字/分钟');
    } else if (act === 'event-name') {
      var d2 = S.load();
      d2.event.name = t.value.trim() || '课程答辩';
      S.save(d2);
      $('#event-chip').textContent = d2.event.name + ' · ' + A.fmt(d2.sections.reduce(function (a, s) { return a + s.quota; }, 0));
    }
  }

  /* --------------------------------------------------------- 键盘控制 */
  function onKey(e) {
    /* 提词器关闭时的全局快捷键 */
    if (!P.on) {
      if (e.key === 'Enter' && document.activeElement === document.body) return;
      return;
    }
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      P.running = !P.running;
      P_EL.play.textContent = P.running ? '❚❚' : '▶';
    } else if (e.key === 'Escape') {
      closePrompter();
    } else if (e.key === 'ArrowRight') {
      var tl = timeline();
      var loc = A.locate(tl.timeline, P.elapsed);
      var nx = Math.min(tl.timeline.length - 1, loc.index + 1);
      P.elapsed = tl.timeline[nx].start;
      toast('跳到：' + tl.timeline[nx].title);
    } else if (e.key === 'ArrowLeft') {
      var tl2 = timeline();
      var loc2 = A.locate(tl2.timeline, P.elapsed);
      var pv = Math.max(0, loc2.index - 1);
      P.elapsed = tl2.timeline[pv].start;
      toast('回到：' + tl2.timeline[pv].title);
    } else if (e.key === 'm' || e.key === 'M') {
      if (P.mic) stopMic(); else startMic();
    } else if (e.key === 'r' || e.key === 'R') {
      P.elapsed = 0; P.lastTs = 0;
      P.timeSpent = S.load().sections.map(function () { return 0; });
      buildFlow();
      toast('已重置本次排练');
    }
  }

  function onWheel(e) {
    if (!P.on) return;
    e.preventDefault();
    var d = S.load();
    var step = e.deltaY > 0 ? -10 : 10;
    d.event.speed = Math.max(120, Math.min(360, (d.event.speed || 240) + step));
    S.save(d);
    P.speed = d.event.speed;
    /* 重算文稿时间轴 */
    var acc = 0;
    P.paras.forEach(function (p) {
      p.secStart = acc;
      acc += p.chars / P.speed * 60;
      p.secEnd = acc;
    });
    toast('语速 ' + P.speed + ' 字/分钟');
  }

  /* --------------------------------------------------------------- 启动 */
  function init() {
    prompterInit();

    /* 提词器控制条加一个麦克风按钮 */
    var ctrl = $('.p-ctrl');
    if (ctrl && !$('#p-micbtn')) {
      var mb = document.createElement('button');
      mb.className = 'p-btn'; mb.id = 'p-micbtn'; mb.title = '麦克风音量监测（M）';
      mb.textContent = '◉';
      ctrl.insertBefore(mb, $('#p-play'));
      mb.addEventListener('click', function () { if (P.mic) stopMic(); else startMic(); });
      $('#p-foot').textContent = '空格 开始/暂停 · ← → 切段 · 滚轮调速 · M 麦克风 · R 重置 · Esc 退出';
    }

    $('#p-play').addEventListener('click', function () {
      P.running = !P.running;
      P_EL.play.textContent = P.running ? '❚❚' : '▶';
    });
    $('#p-exit').addEventListener('click', closePrompter);
    $('#p-finish').addEventListener('click', finishPrompter);
    $('#p-restart').addEventListener('click', function () {
      P.elapsed = 0; P.lastTs = 0;
      P.timeSpent = S.load().sections.map(function () { return 0; });
      buildFlow();
      toast('已重置本次排练');
    });

    $('#btn-export').addEventListener('click', doExport);
    $('#btn-run').addEventListener('click', function () { go('prompter'); openPrompter(); });

    /* 导航：拦截链接点击直接渲染，同时保留 hashchange/popstate 处理前进后退 */
    $('#nav').addEventListener('click', function (e) {
      var a = e.target.closest('.nav-item');
      if (!a) return;
      e.preventDefault();
      go(a.getAttribute('data-route'));
    });
    global.addEventListener('hashchange', route);
    global.addEventListener('popstate', route);

    $('#modal-save').addEventListener('click', saveModal);
    $('#modal-cancel').addEventListener('click', closeModal);
    $('#modal-del').addEventListener('click', function () {
      if (!editing) return;
      if (confirm('删除这个分段？')) { S.deleteSection(editing); closeModal(); route(); toast('已删除分段'); }
    });
    $('#modal-mask').addEventListener('click', function (e) {
      if (e.target === $('#modal-mask')) closeModal();
    });

    $('#file-import').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          S.importJSON(String(fr.result));
          selRecord = null;
          route();
          toast('导入成功');
        } catch (err) {
          toast('导入失败：' + err.message);
        }
      };
      fr.readAsText(f, 'utf-8');
      e.target.value = '';
    });

    $('#view').addEventListener('click', onViewClick);
    $('#view').addEventListener('change', onViewChange);
    document.addEventListener('keydown', onKey);
    $('#p-stage').addEventListener('wheel', onWheel, { passive: false });

    route();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* 供自测脚本调用 */
  global.DengTaiApp = { route: route, openPrompter: openPrompter, P: P };
})(window);
