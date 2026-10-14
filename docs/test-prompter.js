/* 提词器端到端测试：注入页面执行（cdp.js evalfile 用）
   验证：打开提词器 → 计时累加 → 分段定位 → 超时红灯 → 结束存档 */
new Promise(function (res) {
  var log = [];
  var P = DengTaiApp.P;

  document.querySelector('#btn-run').click();
  log.push('提词器已打开 = ' + !document.querySelector('#prompter').classList.contains('hidden'));
  log.push('段落总数 = ' + P.paras.length + '（6 段讲稿自动切句）');

  /* 跳到第 2 段（45~135s）并开始计时 */
  P.elapsed = 110;
  P.running = true;

  setTimeout(function () {
    log.push('计时显示 = ' + document.querySelector('#p-timer').textContent);
    log.push('当前分段 = ' + document.querySelector('#p-section').textContent);
    log.push('分段信息 = ' + document.querySelector('#p-secinfo').innerText);
    log.push('段落进度条宽 = ' + document.querySelector('#p-secbar').style.width);
    log.push('当前句索引 = ' + P.curPara + ' / 已读句数 = ' + document.querySelectorAll('.p-para.done').length);
    log.push('当前句高亮 = ' + document.querySelectorAll('.p-para.current').length + ' 个');
    log.push('自动滚动位移 = ' + document.querySelector('#p-flow').style.transform);
    log.push('本段已计时 = ' + (P.timeSpent[P.secIndex] || 0).toFixed(2) + 's');
    log.push('计时颜色 = ' + document.querySelector('#p-timer').className);

    /* 直接推进到超时 */
    P.elapsed = 505;
    setTimeout(function () {
      log.push('超时后计时 = ' + document.querySelector('#p-timer').textContent
        + ' | 颜色类 = ' + document.querySelector('#p-timer').className);
      log.push('超时后分段信息 = ' + document.querySelector('#p-secinfo').innerText);

      var before = JSON.parse(localStorage.getItem('dengtai.v1')).records.length;
      document.querySelector('#p-finish').click();
      var after = JSON.parse(localStorage.getItem('dengtai.v1')).records.length;
      var rec = JSON.parse(localStorage.getItem('dengtai.v1')).records.slice(-1)[0];
      log.push('排练记录 ' + before + ' → ' + after);
      log.push('新记录 = ' + rec.at + ' 总用时 ' + rec.totalActual + 's / 计划 ' + rec.totalQuota
        + 's，分段数 ' + rec.sections.length + '，口头禅密度 ' + rec.fillers.density);
      log.push('结束后跳转到 ' + location.hash
        + '，提词器已关闭 = ' + document.querySelector('#prompter').classList.contains('hidden'));
      res(log.join('\n'));
    }, 900);
  }, 1300);
});
