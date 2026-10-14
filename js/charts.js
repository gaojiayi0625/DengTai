/* ============================================================================
 * 登台 DengTai · 图表层（纯手写 SVG，零第三方依赖）
 * ----------------------------------------------------------------------------
 * line   折线图（支持目标线、面积填充、数据点）
 * bars   分组柱状图（计划 vs 实际）
 * donut  环形占比图
 * hbar   水平条形对比（偏差方向）
 * ========================================================================== */
(function (global) {
  'use strict';

  var C = {
    grid: '#2b3257',
    axis: '#6f7aa3',
    gold: '#e8b45a',
    goldSoft: 'rgba(232,180,90,.16)',
    green: '#35c08a',
    red: '#e05252',
    blue: '#5b8cff',
    text: '#a7b0d0'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function niceMax(v) {
    if (v <= 0) return 10;
    var exp = Math.floor(Math.log10(v));
    var base = Math.pow(10, exp);
    var f = v / base;
    var m = f <= 1 ? 1 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return m * base;
  }

  /* ------------------------------------------------------------ 折线图 */
  /**
   * @param {object} o
   *   width,height, labels:string[], series:[{name,color,values:number[],area?:bool}]
   *   unit:string, goal?:number, goalText?:string, decimals?:number
   */
  function line(o) {
    var W = o.width || 640, H = o.height || 230;
    var pad = { l: 52, r: 22, t: 24, b: 34 };
    var labels = o.labels || [];
    var series = o.series || [];
    var n = labels.length;
    if (!n) return '<div class="empty">暂无数据</div>';

    var vals = [];
    series.forEach(function (s) { vals = vals.concat(s.values); });
    if (o.goal) vals.push(o.goal);
    var vMin = Math.min.apply(null, vals);
    var vMax = Math.max.apply(null, vals);
    var lo = o.yMin != null ? o.yMin : Math.max(0, Math.floor((vMin - (vMax - vMin) * 0.25) * 10) / 10);
    var hi = o.yMax != null ? o.yMax : niceMax(vMax + (vMax - vMin) * 0.15);
    if (hi === lo) hi = lo + 1;

    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var X = function (i) { return pad.l + (n === 1 ? iw / 2 : iw * i / (n - 1)); };
    var Y = function (v) { return pad.t + ih - (v - lo) / (hi - lo) * ih; };
    var d = o.decimals == null ? 1 : o.decimals;

    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img">';

    /* 网格 + Y 轴刻度 */
    var TICKS = 4;
    for (var t = 0; t <= TICKS; t++) {
      var v = lo + (hi - lo) * t / TICKS;
      var y = Y(v);
      svg += '<line x1="' + pad.l + '" y1="' + y.toFixed(1) + '" x2="' + (W - pad.r) + '" y2="' + y.toFixed(1) +
        '" stroke="' + C.grid + '" stroke-width="1" stroke-dasharray="' + (t === 0 ? '0' : '3,4') + '"/>';
      svg += '<text x="' + (pad.l - 10) + '" y="' + (y + 4).toFixed(1) + '" fill="' + C.axis +
        '" font-size="11" text-anchor="end">' + v.toFixed(v >= 100 || d === 0 ? 0 : d) + '</text>';
    }

    /* 目标线 */
    if (o.goal) {
      var gy = Y(o.goal);
      svg += '<line x1="' + pad.l + '" y1="' + gy.toFixed(1) + '" x2="' + (W - pad.r) + '" y2="' + gy.toFixed(1) +
        '" stroke="' + C.gold + '" stroke-width="1.5" stroke-dasharray="6,5" opacity="0.85"/>';
      svg += '<text x="' + (W - pad.r) + '" y="' + (gy - 6).toFixed(1) + '" fill="' + C.gold +
        '" font-size="11" text-anchor="end">' + esc(o.goalText || ('目标 ' + o.goal)) + '</text>';
    }

    /* X 轴标签 */
    labels.forEach(function (lb, i) {
      svg += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 12) + '" fill="' + C.axis +
        '" font-size="11" text-anchor="middle">' + esc(lb) + '</text>';
    });

    /* 数据序列 */
    series.forEach(function (s) {
      var col = s.color || C.gold;
      var pts = s.values.map(function (v, i) { return [X(i), Y(v)]; });
      var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');

      if (s.area) {
        var area = path + ' L' + X(n - 1).toFixed(1) + ' ' + (pad.t + ih) + ' L' + X(0).toFixed(1) + ' ' + (pad.t + ih) + ' Z';
        svg += '<path d="' + area + '" fill="' + col + '" opacity="0.10"/>';
      }
      svg += '<path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';

      pts.forEach(function (p, i) {
        svg += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.6" fill="#151931" stroke="' + col + '" stroke-width="2.2"/>';
        svg += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] - 11).toFixed(1) + '" fill="' + col +
          '" font-size="11" font-weight="600" text-anchor="middle">' + s.values[i] + (o.unit || '') + '</text>';
      });
    });

    svg += '</svg>';
    return svg;
  }

  /* -------------------------------------------------------- 分组柱状图 */
  /**
   * @param {object} o
   *   width,height, labels:string[], series:[{name,color,values:number[]}], unit, goal
   */
  function bars(o) {
    var W = o.width || 700, H = o.height || 260;
    var pad = { l: 50, r: 18, t: 26, b: 40 };
    var labels = o.labels || [];
    var series = o.series || [];
    var n = labels.length;
    if (!n) return '<div class="empty">暂无数据</div>';

    var vals = [];
    series.forEach(function (s) { vals = vals.concat(s.values); });
    var vMax = Math.max.apply(null, vals);
    if (o.goal) vMax = Math.max(vMax, o.goal);
    var hi = niceMax(vMax * 1.16);

    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var groupW = iw / n;
    var m = series.length || 1;
    var barW = Math.min(34, (groupW * 0.62) / m);
    var Y = function (v) { return pad.t + ih - v / hi * ih; };

    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img">';

    var TICKS = 4;
    for (var t = 0; t <= TICKS; t++) {
      var v = hi * t / TICKS, y = Y(v);
      svg += '<line x1="' + pad.l + '" y1="' + y.toFixed(1) + '" x2="' + (W - pad.r) + '" y2="' + y.toFixed(1) +
        '" stroke="' + C.grid + '" stroke-width="1" stroke-dasharray="' + (t === 0 ? '0' : '3,4') + '"/>';
      svg += '<text x="' + (pad.l - 10) + '" y="' + (y + 4).toFixed(1) + '" fill="' + C.axis +
        '" font-size="11" text-anchor="end">' + Math.round(v) + '</text>';
    }

    labels.forEach(function (lb, i) {
      var gx = pad.l + groupW * i + groupW / 2;
      var totalW = barW * m + 5 * (m - 1);
      var startX = gx - totalW / 2;
      series.forEach(function (s, j) {
        var val = s.values[i] || 0;
        var x = startX + j * (barW + 5);
        var y = Y(val), h = Math.max(2, pad.t + ih - y);
        svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + h.toFixed(1) +
          '" rx="4" fill="' + (s.color || C.gold) + '" opacity="' + (s.dim ? 0.45 : 0.92) + '"/>';
        svg += '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" fill="' + (s.color || C.gold) +
          '" font-size="10.5" font-weight="600" text-anchor="middle">' + val + (o.unit || '') + '</text>';
      });
      /* 多行标签 */
      var parts = String(lb).split('|');
      parts.forEach(function (p2, k) {
        svg += '<text x="' + gx.toFixed(1) + '" y="' + (H - 24 + k * 13) + '" fill="' + C.axis +
          '" font-size="11" text-anchor="middle">' + esc(p2) + '</text>';
      });
    });

    svg += '</svg>';
    return svg;
  }

  /* ------------------------------------------------------------ 环形图 */
  function donut(o) {
    var S = o.size || 190, r = S / 2 - 16, cx = S / 2, cy = S / 2, sw = o.stroke || 22;
    var items = (o.items || []).filter(function (x) { return x.value > 0; });
    var total = items.reduce(function (a, b) { return a + b.value; }, 0) || 1;
    var svg = '<svg viewBox="0 0 ' + S + ' ' + S + '" width="' + S + '" height="' + S + '" role="img">';
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + C.grid + '" stroke-width="' + sw + '"/>';

    var acc = -Math.PI / 2;
    items.forEach(function (it) {
      var ang = it.value / total * Math.PI * 2;
      var a0 = acc, a1 = acc + ang;
      var large = ang > Math.PI ? 1 : 0;
      var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      svg += '<path d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' +
        x1.toFixed(1) + ' ' + y1.toFixed(1) + '" fill="none" stroke="' + it.color + '" stroke-width="' + sw + '" stroke-linecap="butt"/>';
      acc = a1;
    });

    if (o.centerTitle) {
      svg += '<text x="' + cx + '" y="' + (cy - 2) + '" fill="#e8ebf7" font-size="' + (o.centerSize || 24) +
        '" font-weight="700" text-anchor="middle">' + esc(o.centerTitle) + '</text>';
    }
    if (o.centerSub) {
      svg += '<text x="' + cx + '" y="' + (cy + 19) + '" fill="' + C.axis + '" font-size="11.5" text-anchor="middle">' + esc(o.centerSub) + '</text>';
    }
    svg += '</svg>';
    return svg;
  }

  /* --------------------------------------------------------- 偏差条形图 */
  /**
   * 每段"实际 - 计划"的正负偏差：向右=超时(红)，向左=抢跑(绿)
   * @param {Array<{title:string, dev:number}>} items
   */
  function hbar(items, o) {
    o = o || {};
    var W = o.width || 640;
    var rowH = o.rowH || 34;
    var H = items.length * rowH + 26;
    var labelW = o.labelW || 128;
    var maxAbs = Math.max.apply(null, items.map(function (x) { return Math.abs(x.dev); }).concat([10]));
    var mid = labelW + (W - labelW - 54) / 2;
    var half = (W - labelW - 54) / 2;
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img">';

    svg += '<line x1="' + mid.toFixed(1) + '" y1="6" x2="' + mid.toFixed(1) + '" y2="' + (H - 20) + '" stroke="' + C.grid + '" stroke-width="1"/>';
    svg += '<text x="' + (mid - half + 2) + '" y="' + (H - 6) + '" fill="' + C.axis + '" font-size="10.5">← 提前</text>';
    svg += '<text x="' + (mid + half - 2) + '" y="' + (H - 6) + '" fill="' + C.axis + '" font-size="10.5" text-anchor="end">超时 →</text>';

    items.forEach(function (it, i) {
      var cy = 15 + i * rowH;
      var w = Math.abs(it.dev) / maxAbs * half;
      var isOver = it.dev > 0;
      var col = isOver ? C.red : C.green;
      var x = isOver ? mid : mid - w;
      svg += '<text x="' + (labelW - 10) + '" y="' + (cy + 4) + '" fill="' + C.text + '" font-size="12" text-anchor="end">' + esc(it.title) + '</text>';
      svg += '<rect x="' + x.toFixed(1) + '" y="' + (cy - 7) + '" width="' + Math.max(2, w).toFixed(1) + '" height="14" rx="4" fill="' + col + '" opacity="0.9"/>';
      var tx = isOver ? (mid + w + 8) : (mid - w - 8);
      svg += '<text x="' + tx.toFixed(1) + '" y="' + (cy + 4) + '" fill="' + col + '" font-size="11.5" font-weight="600" text-anchor="' +
        (isOver ? 'start' : 'end') + '">' + (isOver ? '+' : '') + it.dev + 's</text>';
    });
    svg += '</svg>';
    return svg;
  }

  /* ------------------------------------------------ 时长分配（堆叠条） */
  function stackBar(sections, total) {
    var W = 640, H = 64;
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img">';
    var ramp = ['#b98838', '#d4a24c', '#e8b45a', '#f0c87e', '#9db9ff', '#5b8cff', '#35c08a', '#2b7f60'];
    var x = 0;
    sections.forEach(function (s, i) {
      var w = (s.quota / total) * W;
      svg += '<rect x="' + x.toFixed(1) + '" y="8" width="' + Math.max(0, w - 2).toFixed(1) + '" height="34" rx="5" fill="' + ramp[i % ramp.length] + '"/>';
      if (w > 42) {
        svg += '<text x="' + (x + w / 2).toFixed(1) + '" y="30" fill="#1b1405" font-size="11.5" font-weight="700" text-anchor="middle">' +
          s.quota + 's</text>';
      }
      x += w;
    });
    /* 刻度 */
    var step = total / 4;
    for (var t = 0; t <= 4; t++) {
      var px = Math.max(16, Math.min(W - 16, W * t / 4));
      svg += '<text x="' + px.toFixed(1) + '" y="58" fill="' + C.axis + '" font-size="10.5" text-anchor="middle">' +
        Math.round(step * t / 60) + 'min</text>';
    }
    svg += '</svg>';
    return svg;
  }

  global.Charts = { line: line, bars: bars, donut: donut, hbar: hbar, stackBar: stackBar, COLORS: C };
})(window);
