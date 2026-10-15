/* ============================================================
   社交电量测试 · 交互层
   ------------------------------------------------------------
   滚动动画是自己写的一套：IntersectionObserver 负责「进入视野」，
   rAF 负责「和滚动位置绑定」的动画（首屏舞台、雷达绘制、计数）。
   没有引第三方动画库，因为要保证在微信内置浏览器里也能跑。
   ============================================================ */
(function () {
  'use strict';
  const E = window.ENGINE;
  const D = window.DINO;
  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- 状态 ---------------- */
  const state = {
    qi: 0,
    answers: new Array(E.QUESTIONS.length).fill(null),  // 每题的选项下标
    result: null,
    poster: null,
    profile: null,   // 开场问答收集的性别/年龄段
  };

  /* ---------------- 工具 ---------------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 1900);
  }
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('on'));
    $(id).classList.add('on');
    if (id !== 'result') window.scrollTo(0, 0);
  }
  function paraText(str) {
    return str.split('\n\n').map((p) => `<p>${p}</p>`).join('');
  }
  // 有真图就用真图，没有就退回矢量形象
  const HAS_REAL = typeof window.DINO_REAL === 'object' && window.DINO_REAL !== null;
  // 素材已经从实底抠成透明底了，所有表情都直接贴在奶油色页面上，不再需要圆角底衬。
  const OPAQUE_EXPR = { fake: 1, cry: 1, yum: 1, love: 1, angry: 1, chill: 1, dead: 1, laugh: 1 };
  function EXPR(key, size) {
    const expr = E.RESULTS[key].expr;          // 注意：取图要用 expr，不是结果 key
    const real = HAS_REAL ? window.DINO_REAL[expr] : null;
    if (real) {
      const opaque = OPAQUE_EXPR[expr] ? ' dino-opaque' : '';
      return `<img src="${real}" width="${size}" height="${size}" alt="" class="dino-img${opaque}">`;
    }
    return D.art(expr, size);
  }
  // 不绑定某只结果、随便来个形象时用（首页、加载页）
  function anyDino(prefer, size) {
    const real = HAS_REAL ? (window.DINO_REAL[prefer] || window.DINO_REAL.laugh || window.DINO_REAL.fake) : null;
    if (real) {
      const opaque = OPAQUE_EXPR[prefer] ? ' dino-opaque' : '';
      return `<img src="${real}" width="${size}" height="${size}" alt="" class="dino-img${opaque}">`;
    }
    return D.art(prefer, size);
  }

  /* ---------------- 底部抽屉 ---------------- */
  let sheetOpen = false;
  let lockedAtY = 0;
  function lockBody() {
    // body 一旦 position:fixed，文档滚动位置会被清成 0，
    // 所以先把当前位置记下来、用 top 顶住，关掉的时候再还原，
    // 否则用户在报告中间点一下维度就会整页弹回顶部。
    lockedAtY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = (-lockedAtY) + 'px';
    document.body.classList.add('locked');
  }
  function unlockBody() {
    document.body.classList.remove('locked');
    document.body.style.top = '';
    window.scrollTo(0, lockedAtY);
  }
  function openSheet(title, html) {
    const sheet = $('sheet'), scrim = $('scrim');
    if (!sheet) return;
    $('sheetTitle').textContent = title;
    $('sheetBody').innerHTML = html;
    scrim.classList.add('on');
    sheet.classList.add('on');
    sheetOpen = true;
    lockBody();
    // 让里头的进度条动起来
    requestAnimationFrame(() => {
      sheet.querySelectorAll('.sc-fill[data-w]').forEach((f) => { f.style.width = f.dataset.w + '%'; });
    });
  }
  function closeSheet() {
    if (!sheetOpen) return;
    $('sheet').classList.remove('on');
    $('scrim').classList.remove('on');
    sheetOpen = false;
    unlockBody();
  }

  /* ---------------- 开始页 ---------------- */
  function buildStart() {
    $('heroArt').innerHTML = anyDino('laugh', 206);
    $('statN').textContent = E.QUESTIONS.length;
    // 六维预览：告诉用户会量什么，但不泄露任何结果
    const box = $('dimTease');
    if (box) {
      box.innerHTML = '';
      E.DIMS.forEach((d) => {
        const poles = E.DIM_POLES[d];
        const cell = document.createElement('div');
        cell.className = 'dimcell';
        cell.innerHTML = `<div class="dn">${E.DIM_LABELS[d]}</div>
          <div class="dd">${poles[0]} ↔ ${poles[1]}</div>
          <div class="dt"><i></i></div>`;
        box.appendChild(cell);
      });
    }
  }

  /* ---------------- 开场问答：性别 / 年龄段 ----------------
     为什么要问：结果里有百分位比较（「排在前 X%」），
     不收集就没法说清楚是「跟谁比」——之前那句「同龄人」是编的。
     两项都必选，选完才能进答题页。 */
  const PROFILE = { gender: null, age: null };

  function openIntro() {
    closeSheet();
    // 小角色陪一下，随机换个表情免得每次都一样
    const art = $('introArt');
    if (art) art.innerHTML = anyDino(['chill', 'fake', 'yum', 'laugh'][state.qi % 4] || 'chill', 96);
    syncIntro();
    show('intro');
    window.scrollTo(0, 0);
  }

  function syncIntro() {
    const g = $('chipsGender'), a = $('chipsAge'), btn = $('introNext'), hint = $('introHint');
    if (g) [].forEach.call(g.children, (c) => c.classList.toggle('on', c.dataset.v === PROFILE.gender));
    if (a) [].forEach.call(a.children, (c) => c.classList.toggle('on', c.dataset.v === PROFILE.age));
    const ready = !!(PROFILE.gender && PROFILE.age);
    if (btn) btn.disabled = !ready;
    if (hint) hint.textContent = ready ? '好了，开始吧' : '两项都选一下就能开始';
  }

  function bindIntro() {
    const g = $('chipsGender'), a = $('chipsAge');
    if (g) [].forEach.call(g.children, (c) => {
      c.onclick = () => { PROFILE.gender = c.dataset.v; syncIntro(); };
    });
    if (a) [].forEach.call(a.children, (c) => {
      c.onclick = () => { PROFILE.age = c.dataset.v; syncIntro(); };
    });
    const btn = $('introNext');
    if (btn) btn.onclick = () => {
      if (!PROFILE.gender || !PROFILE.age) return;
      state.profile = { gender: PROFILE.gender, age: PROFILE.age,
        ageLabel: (E.AGE_LABELS && E.AGE_LABELS[PROFILE.age]) || '' };
      startQuiz();
    };
  }

  /* ---------------- 答题页 ---------------- */
  function startQuiz() {
    state.qi = 0;
    state.locked = false;      // 防止上一次的锁没解开，导致点了没反应
    state.answers.fill(null);
    closeSheet();              // 抽屉开着的时候重新开始，要先收起来
    show('quiz');
    renderQ();
  }

  // 答题时小角色随进度换表情，并说一句吐槽
  const Q_MOODS = ['laugh', 'chill', 'yum', 'fake', 'cry', 'dead'];
  const Q_LINES = [
    '不用想太多，第一反应最像你',
    '这题我自己也答不出来',
    '别装，我看得出来',
    '答到这里了，不错嘛',
    '这题有点扎心吧',
    '就快好了，撑住',
  ];

  function renderQ() {
    const [q, opts] = E.QUESTIONS[state.qi];
    const total = E.QUESTIONS.length;
    $('qNow').textContent = state.qi + 1;
    $('qNum').textContent = 'Q' + (state.qi + 1);
    if ($('qBar')) $('qBar').style.width = (state.qi / total * 100) + '%';
    $('qText').textContent = q;
    $('qBack').hidden = state.qi === 0;

    // 进度点：答过的高亮，当前那个亮一点
    const dots = $('qDots');
    if (dots) {
      if (dots.children.length !== total) {
        dots.innerHTML = '';
        for (let i = 0; i < total; i++) dots.appendChild(document.createElement('i'));
      }
      Array.prototype.forEach.call(dots.children, (d, i) => {
        d.className = i < state.qi ? 'done' : (i === state.qi ? 'now' : '');
      });
    }

    // 换表情 + 换话，并弹一下
    const mood = $('qMascot');
    if (mood) {
      mood.innerHTML = anyDino(Q_MOODS[state.qi % Q_MOODS.length], 76);
      mood.classList.remove('pop');
      void mood.offsetWidth;
      mood.classList.add('pop');
    }
    const speech = $('qSpeech');
    if (speech) speech.textContent = Q_LINES[state.qi % Q_LINES.length];

    const box = $('opts');
    box.innerHTML = '';
    const LETTER = ['A', 'B', 'C', 'D'];
    opts.forEach(([text], i) => {
      const strip = document.createElement('div');
      strip.className = 'opt-strip';
      strip.style.setProperty('--d', (i * 65) + 'ms');
      const b = document.createElement('button');
      b.className = 'opt';
      if (state.answers[state.qi] === i) b.classList.add('sel');
      b.innerHTML = `<span class="key">${LETTER[i]}</span><span>${text}</span>`;
      b.onclick = () => pick(i);
      strip.appendChild(b);
      box.appendChild(strip);
    });
  }

  function pick(i) {
    if (state.locked) return;
    state.locked = true;
    state.answers[state.qi] = i;

    const btns = document.querySelectorAll('#opts .opt');
    btns.forEach((b, k) => b.classList.toggle('sel', k === i));
    if ($('qBar')) $('qBar').style.width = ((state.qi + 1) / E.QUESTIONS.length * 100) + '%';

    setTimeout(() => {
      state.locked = false;
      if (state.qi < E.QUESTIONS.length - 1) {
        state.qi++;
        renderQ();
      } else {
        finish();
      }
    }, reduce ? 0 : 190);
  }

  function goBack() {
    if (state.qi === 0) return;
    state.qi--;
    renderQ();
  }

  /* ---------------- 结算 ---------------- */
  function rawScores() {
    const raw = {};
    E.DIMS.forEach((d) => { raw[d] = 0; });
    state.answers.forEach((ci, qi) => {
      if (ci === null) return;
      const add = E.QUESTIONS[qi][1][ci][1];
      for (const d in add) raw[d] += add[d];
    });
    return raw;
  }

  const LOAD_MSGS = [
    '正在读取你的 18 个选择…',
    '换算六维人格分值…',
    '和 8 种电量人格逐一比对…',
    '计算匹配度与稀有度…',
  ];

  function finish() {
    show('loading');
    $('loadArt').innerHTML = anyDino('chill', 152);
    let p = 0;
    const bar = $('loadBar');
    const txt = $('loadText');
    const t0 = performance.now();
    const total = reduce ? 420 : 2100;

    (function tick(now) {
      const el = Math.min(1, (now - t0) / total);
      const eased = 1 - Math.pow(1 - el, 2);
      p = eased;
      bar.style.width = (eased * 100) + '%';
      txt.textContent = LOAD_MSGS[Math.min(LOAD_MSGS.length - 1, Math.floor(eased * LOAD_MSGS.length))];
      if (el < 1) requestAnimationFrame(tick);
      else showResult();
    })(t0);
  }

  /* ---------------- 结果页 ---------------- */
  function showResult() {
    const r = E.rank(rawScores(), state.profile);
    const p = E.personal(r);
    state.result = r;
    state.personal = p;
    try { window.__lastRank = r; } catch (e) { /* 仅供测试读取 */ }

    // 首屏
    $('stageArt').innerHTML = EXPR(r.key, 230);
    $('rName').textContent = E.RESULTS[r.key].name;
    $('rMatch').textContent = '0%';
    $('rRare').textContent = p.rarity + '%';

    // 判决
    $('rVerdict').textContent = p.lead + '「' + E.RESULTS[r.key].verdict + '」';
    // 第二像的那只：匹配度接近时说明你是「两栖」，这是定制感的一部分
    $('rSecond').innerHTML = r.secondMatch >= r.match - 6
      ? `另外，还有 <b>${r.secondShare}%</b> 的你是 <b>${E.RESULTS[r.second].name}</b>（匹配度 ${r.secondMatch}%）——你身上这两只一直在抢方向盘。`
      : `第二像的是 <b>${E.RESULTS[r.second].name}</b>（匹配度 ${r.secondMatch}%），但差距明显，你很纯。`;
    $('rDesc').innerHTML = paraText(E.RESULTS[r.key].desc);
    $('rAdvice').textContent = E.RESULTS[r.key].advice;

    // 最突出 / 最弱
    $('gTopName').textContent = E.DIM_LABELS[p.t1];
    $('gTopVal').textContent = r.scores[p.t1] + ' 分 · 前 ' + (100 - E.percentile(p.t1, r.scores[p.t1])) + '%';
    $('gTopDesc').textContent = E.describe(p.t1, r.scores[p.t1]);
    $('gLowName').textContent = E.DIM_LABELS[p.l1];
    $('gLowVal').textContent = r.scores[p.l1] + ' 分';
    $('gLowDesc').textContent = E.describe(p.l1, r.scores[p.l1]);

    // 六维条：可点，点开看这一维的解读
    const box = $('barBox');
    box.innerHTML = '';
    E.DIMS.forEach((d) => {
      const pct = E.percentile(d, r.scores[d]);
      const row = document.createElement('div');
      row.className = 'bar';
      row.setAttribute('role', 'button');
      row.innerHTML = `<div class="bl">${E.DIM_LABELS[d]}</div>
        <div class="bt"><i data-v="${r.scores[d]}" style="width:0%"></i></div>
        <div class="bv">${r.scores[d]}</div>
        <div class="bmore">›</div>`;
      row.onclick = () => showDimSheet(d);
      box.appendChild(row);
    });

    // 8 只的相似度排名：让人看见「我还有多少是别的只」
    const rankCard = $('rankCard');
    if (rankCard) {
      rankCard.innerHTML = '';
      r.order.forEach((k) => {
        const isMe = k === r.key;
        // 条形宽度按匹配度映射（匹配度大体落在 40-99，拉到 0-100 才看得出差别）
        const w = Math.max(3, Math.min(100, ((r.matches[k] - 40) / 58) * 100));
        const row = document.createElement('div');
        row.className = 'rk' + (isMe ? ' me' : '');
        row.innerHTML = `<div class="rkart">${EXPR(k, 40)}</div>
          <div class="rkname">${E.RESULTS[k].name}${isMe ? ' · 你' : ''}</div>
          <div class="rktrack"><i data-w="${w.toFixed(1)}"></i></div>
          <div class="rkval">${r.matches[k]}%</div>`;
        row.onclick = () => showDinoSheet(k);
        rankCard.appendChild(row);
      });
    }

    // 关系磁场
    const rel = p.rel;
    $('rAttract').textContent = E.RESULTS[rel.attract].name;
    $('rAttractDesc').textContent = p.rel.chargeText;
    $('atMini').innerHTML = EXPR(rel.attract, 46);
    $('rRepel').textContent = E.RESULTS[rel.repel].name;
    $('rRepelDesc').textContent = p.rel.drainText;
    $('rpMini').innerHTML = EXPR(rel.repel, 46);
    $('shareArt').innerHTML = EXPR(r.key, 86);

    // 首屏数字：进结果页就直接数上去
    counters = [];
    [['rMatch', r.match, 0], ['rRare', p.rarity, 1]].forEach(([id, to, dec]) => {
      const el = $(id);
      if (el) counters.push({ el, to, dec, done: false, startedAt: -1 });
    });

    show('result');
    window.scrollTo(0, 0);
    fabOn = false;
    $('fab').classList.remove('on');
    if ($('guide')) $('guide').classList.remove('on');
    fitRadar();       // 按实际容器宽度定 canvas 分辨率，避免拉糊
    initScroll();     // 每测一次都要重新绑定
  }

  /* ---------------- 抽屉内容 ---------------- */
  // 某一维的详细解读
  function showDimSheet(d) {
    const r = state.result, p = state.personal;
    const v = r.scores[d];
    const pct = E.percentile(d, v);
    const poles = E.DIM_POLES[d];
    const isTop = d === p.t1, isLow = d === p.l1;
    const badge = isTop ? '你最高的一维' : (isLow ? '你最低的一维' : '');
    const zh = E.DESCRIBE[d] || {};
    openSheet(E.DIM_LABELS[d], `
      <div class="sc-hero">
        <div>
          <div class="big">${v}<span class="unit"> / 100</span></div>
          <div class="unit">超过 ${pct}% 的测试者${badge ? ' · ' + badge : ''}</div>
        </div>
        <div class="art">${EXPR(r.key, 64)}</div>
      </div>
      <div class="sc-scale">
        <div class="sc-track">
          <div class="sc-fill" data-w="${v}"></div>
          <div class="sc-mark" style="left:50%"></div>
        </div>
        <div class="sc-lbl"><span>${poles[0]}</span><span>${poles[1]}</span></div>
      </div>
      <div class="sc-note">${zh.meaning || ''}</div>
      <div class="sc-row"><span>你这一维的分数</span><b>${v}</b></div>
      <div class="sc-row"><span>${(E.AGE_LABELS && E.AGE_LABELS[(r.profile || {}).age]) || '所有测过的人'}中的位置</span><b>前 ${Math.max(1, 100 - pct)}%</b></div>
      <div class="sc-note">${E.describe(d, v)}</div>
      ${zh.advice ? `<div class="sc-note">${zh.advice}</div>` : ''}
    `);
  }

  // 某一种人格：我像它多少、它是什么
  function showDinoSheet(k) {
    const r = state.result, p = state.personal;
    const res = E.RESULTS[k];
    const isMe = k === r.key;
    const myFit = E.percentile ? r.matches[k] : 0;
    openSheet(res.name, `
      <div class="sc-hero">
        <div class="art" style="width:76px;height:76px;border-radius:22px;overflow:hidden">${EXPR(k, 76)}</div>
        <div>
          <div class="big">${r.matches[k]}<span class="unit">% 匹配</span></div>
          <div class="unit">${isMe ? '这就是你的结果' : `在你身上占 ${r.share[k]}% 的分量`}</div>
        </div>
      </div>
      <div class="sc-note">${res.verdict}</div>
      <div class="sc-row"><span>稀有度</span><b>${res.rarity}%</b></div>
      <div class="sc-row"><span>最显眼的维度</span><b>${topDimsOf(k).map((d) => E.DIM_LABELS[d]).join('、')}</b></div>
      <div class="sc-note">${res.desc.split('\n\n')[0]}</div>
      ${isMe ? '' : `<div class="sc-note">你身上有 ${r.share[k]}% 是它。你和它最像的地方是「${E.DIM_LABELS[topDimsOf(k)[0]]}」。</div>`}
    `);
  }

  // 某种人格最突出的两个维度（按它的画像方向）
  function topDimsOf(k) {
    const u = E.ARCH[k];
    return E.DIMS.slice().sort((a, b) => u[b] - u[a]).slice(0, 2);
  }

  // 关系磁场：为什么是这两只
  function showRelSheet() {
    const p = state.personal, r = state.result;
    openSheet('谁在耗你的电', `
      <div class="sc-note">这不是写死的配对。系统拿你的六维画像和另外 7 种人格逐一算了方向差：最贴的那个会给你充电，最相反的那个一直在耗你。</div>
      <div class="sc-row"><span>给你充电</span><b>${E.RESULTS[p.rel.attract].name}</b></div>
      <div class="sc-row"><span>最耗你电</span><b>${E.RESULTS[p.rel.repel].name}</b></div>
      <div class="sc-note">${p.rel.chargeText}</div>
      <div class="sc-note">${p.rel.drainText}</div>
    `);
  }

  /* ---------------- 引导按钮 ---------------- */
  // 点它：弹一下，然后滚到下一个还没看的地方
  function guideTargets() {
    const ids = ['barBox', 'radar', 'rankCard', 'rDesc', 'rAdvice', 'shareArt'];
    const out = [];
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      const box = el.closest('.block') || el.parentElement || el;
      if (!out.includes(box)) out.push(box);
    });
    return out;
  }
  function onGuideTap() {
    const g = $('guide');
    const tap = g.querySelector('.guide-tap');
    // 1) 先弹一下，让人知道点到了
    g.classList.add('pop');
    setTimeout(() => g.classList.remove('pop'), 540);

    // 2) 同时滚到下一个还没看的段落
    const vh = window.innerHeight;
    const next = guideTargets().find((el) => el.getBoundingClientRect().top > vh * 0.22);
    const goTo = next || $('saveBtn');
    if (goTo) {
      const y = goTo.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    }

    // 3) 然后整只蹦到别处再淡出，过一会儿在右下角重新冒出来（像只页面小动物）
    if (tap && !reduce) {
      const dx = (Math.random() < 0.5 ? -1 : 1) * (26 + Math.random() * 46);
      const dy = -(70 + Math.random() * 60);
      const rot = (Math.random() * 30 - 15).toFixed(1);
      g.classList.add('hop');
      tap.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(.55)`;
      tap.style.opacity = '0';
      setTimeout(() => {
        tap.style.transition = 'none';
        tap.style.transform = '';
        tap.style.opacity = '';
        // 换个位置、换句话再冒出来
        g.classList.remove('hop');
        g.classList.remove('on');
        const tail = $('guideTail');
        if (tail) {
          TAUNTS.push(TAUNTS.shift());
          tail.textContent = TAUNTS[0];
        }
        void g.offsetWidth;
        requestAnimationFrame(() => { tap.style.transition = ''; updateGuide(); });
      }, 520);
    }
  }
  /* 引导按钮：滚动的时候探头出来，停下来 0.8 秒就缩回去。
     它待在底部操作条正上方那条窄带里（那里本来就被渐隐层盖着，不会压到正文）。 */
  let guideIdleTimer = 0;
  let lastY = -1;
  function updateGuide() {
    const g = $('guide');
    if (!g || guideDismissed) return;
    const res = $('result');
    if (!res || !res.classList.contains('on')) { g.classList.remove('on'); return; }
    const y = window.scrollY;
    const vh = window.innerHeight;
    const docH = document.documentElement.scrollHeight;

    if (y < vh * 0.5 || (y + vh) > docH - 260 || sheetOpen) {
      g.classList.remove('on');
      return;
    }
    // 已经在滚 = 探头；停下 0.8 秒 = 缩回去
    if (Math.abs(y - lastY) > 2) {
      lastY = y;
      g.classList.add('on');
      clearTimeout(guideIdleTimer);
      guideIdleTimer = setTimeout(() => { g.classList.remove('on'); }, 820);
    }
  }

  /* ---------------- 滚动动画引擎 ---------------- */
  let io = null;          // IntersectionObserver
  let scrubs = [];        // 和滚动绑定的元素
  let counters = [];      // 进入视野时跑数字的元素
  let raf = 0;
  let fabOn = false;
  let guideDismissed = false;
  // 引导按钮上的贱话，点一次换一句（都控制在 4 个字内，免得跑出屏幕）
  const TAUNTS = ['来点我啊', '戳这里', '点我嘛', '这边这边', '再点一下', '快点我'];

  function initScroll() {
    scrubs.forEach((s) => { s.el.style.transform = ''; });
    scrubs = [];
    // 注意：不要在这里清 counters —— 首屏数字是 showResult() 里填好的，
    // 清了就再也没人重新填，匹配度会永远停在 0%。
    if (io) { io.disconnect(); io = null; }

    // 重新测一次时，先把上一次的入场状态清掉
    const revealEls = document.querySelectorAll('#result .rv');
    revealEls.forEach((el) => el.classList.remove('in'));

    /* 1. 进入视野的错峰入场 */
    io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add('in');
        // 六维条：进入视野后按顺序长出来（宽度直接用分值）
        if (el.classList.contains('bars')) {
          el.querySelectorAll('.bt i').forEach((f, i) => {
            const val = f.dataset.v || '0';
            setTimeout(() => {
              f.style.transition = 'width .9s cubic-bezier(.22,1,.36,1)';
              f.style.width = val + '%';
            }, 85 * i);
          });
        }
        // 8 只排名条
        if (el.id === 'rankCard') {
          el.querySelectorAll('.rktrack i').forEach((f, i) => {
            setTimeout(() => {
              f.style.transition = 'width .9s cubic-bezier(.22,1,.36,1)';
              f.style.width = f.dataset.w + '%';
            }, 55 * i);
          });
        }
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));

    /* 2. 和滚动位置绑定的效果
       用「元素顶部进入视口底部之后，页面又滚了多少」当进度，不用视口进入比例。
       原因：首屏 stage 就在文档最顶部，用进入比例算的话一打开就已经播到 1/3。
       每个效果的参数是「从元素顶部到达视口底部算起，滚动多少像素后播完」。 */
    const stage = $('stage');
    const stageArt = $('stageArt');
    const stageCopy = $('stageCopy');
    const stageGlow = $('stageGlow');
    const cue = $('cue');
    const radarWrap = document.querySelector('.radar-card');

    scrubs.push({
      el: stage, mode: 'start', d0: 0, d1: 560, freeze: true,
      apply: (t) => {
        if (reduce) return;
        stageArt.style.transform = `translateY(${-34 * t}px) scale(${1 + 0.34 * t})`;
        stageArt.style.opacity = String(1 - 0.5 * t);
        // 文案最后才淡：一开始就看不清会显得「糊」
        stageCopy.style.transform = `translateY(${-16 * t}px)`;
        stageCopy.style.opacity = String(1 - Math.min(1, Math.max(0, (t - 0.35) / 0.55)));
        stageGlow.style.transform = `translate(-50%,-56%) scale(${1 + 0.62 * t})`;
        stageGlow.style.opacity = String(0.55 + 0.45 * t);
        cue.style.opacity = String(Math.max(0, 1 - t * 2.2));
      },
    });

    // 雷达：卡片顶部进入视口后再往下滚一点，就把它画出来
    if (radarWrap) {
      scrubs.push({
        el: radarWrap, mode: 'start', d0: 0, d1: 420,
        apply: (t) => drawRadar(state.result.scores, t),
      });
    }

    // 顶部进度条：整页滚了多少
    const railBar = $('rail') && $('rail').firstElementChild;
    if (railBar) {
      scrubs.push({
        el: $('rail'), mode: 'page',
        apply: (t) => { railBar.style.width = (t * 100) + '%'; },
      });
    }

    // 底部操作条：滚过首屏才出现
    scrubs.push({
      el: $('result'), mode: 'start', d0: 260, d1: 700,
      apply: (t) => {
        const on = t > 0.6;
        if (on !== fabOn) { fabOn = on; $('fab').classList.toggle('on', on); }
      },
    });

    // 首屏数字：进结果页就直接数上去，不用等滚动（不然 rAF 被节流时会算出怪数字）
    setTimeout(() => {
      counters.forEach((c) => {
        if (c.done || c.startedAt >= 0) return;
        c.startedAt = performance.now();
        countTo(c, 1200);
      });
    }, 260);

    measure();
    onScroll();
  }

  /* 记录每个 scrub 的绝对滚动区间：
     base = 元素顶部到达视口底部时的 scrollY。
     进度 = (scrollY - base - d0) / (d1 - d0)，clamp 到 0..1。
     freeze=true 的元素（首屏 stage）base 固定为 0，因为它本来就在文档最顶部。 */
  function measure() {
    const vh = window.innerHeight || 1;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
    scrubs.forEach((s) => {
      if (s.mode === 'page') { s.base = 0; s.d0 = 0; s.d1 = maxScroll; return; }
      if (s.freeze) { s.base = 0; return; }
      const r = s.el.getBoundingClientRect();
      s.base = r.top + window.scrollY - vh;
    });

  }

  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      for (const s of scrubs) {
        const span = (s.d1 - s.d0) || 1;
        const pr = Math.min(1, Math.max(0, (y - s.base - s.d0) / span));
        s.apply(pr);
      }
      // 首屏的数字：滚到差不多位置就开始数
      counters.forEach((c) => {
        if (c.done || c.startedAt >= 0) return;
        const r = c.el.getBoundingClientRect();
        if (r.top < vh * 0.88 && r.bottom > 0) {
          c.startedAt = performance.now();
          countTo(c, 1100);
        }
      });

      updateGuide();
    });
  }

    // 把一个数字从 0 数到目标值，带缓出。
  // 不依赖 rAF 传进来的时间戳（它和 performance.now() 起点不同，还可能被节流），
  // 每一帧自己取时间归一化；如果时间没走，就自己兜住到最终值，绝不会停在 0%。
  function countTo(c, dur) {
    if (reduce) { c.el.textContent = c.to.toFixed(c.dec) + '%'; c.done = true; return; }
    const t0 = performance.now();
    let frames = 0;
    const step = () => {
      frames++;
      const span = performance.now() - t0;
      let t = span > 0 ? span / dur : frames / 40;
      if (t > 3) t = 1;                       // 时间戳异常（被快进）就直接到终点
      t = Math.max(0, Math.min(1, t));
      const v = c.to * (1 - Math.pow(1 - t, 3));
      c.el.textContent = v.toFixed(c.dec) + '%';
      if (t < 1) requestAnimationFrame(step);
      else { c.el.textContent = c.to.toFixed(c.dec) + '%'; c.done = true; }
    };
    requestAnimationFrame(step);
  }

  /* ---------------- 雷达图 ---------------- */
  const RADAR_LOGICAL_W = 740;
  let radarHits = [];   // 顶点位置，用来做点击命中
  function fitRadar() {
    const c = $('radar');
    if (!c) return;
    const cssW = c.parentElement ? c.parentElement.clientWidth - 16 : 0;
    if (cssW > 40) {
      const cssH = Math.round(cssW * 660 / 740);
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      c.style.width = cssW + 'px';
      c.style.height = cssH + 'px';
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);
    }
  }

  function drawRadar(vals, progress) {
    const c = $('radar');
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const dpr = W / RADAR_LOGICAL_W;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 + 10 * dpr;
    const R = Math.min(W, H) * 0.31;
    const n = E.DIMS.length;
    const ang = (i) => -Math.PI / 2 + i * Math.PI * 2 / n;

    // 底纹网格
    ctx.lineWidth = 1.4 * dpr;
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = ang(i % n), r = R * ring / 4;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = ring === 4 ? '#D2C6AC' : '#E8E0D0';
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const a = ang(i);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.strokeStyle = '#E8E0D0';
      ctx.stroke();
    }

    // 数据多边形：progress 0-0.55 缩放出现，之后维点逐个亮起
    const grow = Math.min(1, progress / 0.55);
    const ease = 1 - Math.pow(1 - grow, 3);
    if (ease > 0.001) {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = ang(i);
        const r = R * (vals[E.DIMS[i]] / 100) * ease;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      const trace = () => {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
      };

      // 1) 外发光：让面积从底色里跳出来
      trace();
      ctx.save();
      ctx.shadowColor = 'rgba(60,116,85,.55)';
      ctx.shadowBlur = 20 * dpr;
      ctx.fillStyle = 'rgba(78,143,107,.30)';
      ctx.fill();
      ctx.restore();

      // 2) 主填充：上亮下深的渐变，做出「有面积」的体量感
      trace();
      const grad = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
      grad.addColorStop(0, 'rgba(255,214,72,.90)');
      grad.addColorStop(0.55, 'rgba(255,196,40,.78)');
      grad.addColorStop(1, 'rgba(240,168,20,.66)');
      ctx.fillStyle = grad;
      ctx.fill();

      // 3) 描边
      trace();
      ctx.strokeStyle = '#D99400';
      ctx.lineWidth = 3.4 * dpr;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 4) 顶点 + 从中心拉出来的轴线高光
      const dots = Math.min(1, Math.max(0, (progress - 0.55) / 0.45));
      radarHits = [];
      for (let i = 0; i < n; i++) {
        const a = ang(i);
        const r = R * (vals[E.DIMS[i]] / 100) * ease;
        const vx = cx + Math.cos(a) * r, vy = cy + Math.sin(a) * r;
        // 顶点和标签都算可点区域，手指不用那么准
        radarHits.push({
          dim: E.DIMS[i], x: vx, y: vy,
          lx: cx + Math.cos(a) * (R + 34 * dpr), ly: cy + Math.sin(a) * (R + 26 * dpr),
        });
        if (i / n > dots + 0.001) continue;
        ctx.beginPath();
        ctx.arc(vx, vy, 6.2 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = '#D99400';
        ctx.stroke();
      }
    }

    // 标签
    ctx.font = `700 ${13 * dpr}px -apple-system,"PingFang SC",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const a = ang(i);
      const x = cx + Math.cos(a) * (R + 34 * dpr);
      const y = cy + Math.sin(a) * (R + 26 * dpr);
      ctx.fillStyle = '#6B5B45';
      ctx.fillText(E.DIM_LABELS[E.DIMS[i]], x, y);
      ctx.fillStyle = '#221D17';
      ctx.font = `900 ${15 * dpr}px -apple-system,"PingFang SC",sans-serif`;
      ctx.fillText(String(vals[E.DIMS[i]]), x, y + 17 * dpr);
      ctx.font = `700 ${13 * dpr}px -apple-system,"PingFang SC",sans-serif`;
    }
  }

  /* ---------------- 海报 ---------------- */
  /* 把 SVG 变成可以 drawImage 的 Image。
     Safari 对 SVG 的 data URL 限制比较奇怪，所以先试 Blob URL，失败再退回 data URL。 */
  function loadSvgImage(svgStr, pixelSize) {
    const svg = svgStr.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelSize}" height="${pixelSize}" `);
    return new Promise((resolve, reject) => {
      const tryLoad = (src, onFail) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = onFail;
        img.src = src;
      };
      let blobUrl = null;
      try {
        blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      } catch (e) { blobUrl = null; }

      const fb = () => {
        if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch (e) { } }
        tryLoad('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), reject);
      };
      if (blobUrl) tryLoad(blobUrl, fb);
      else fb();
    });
  }
  const svgStrOf = (key) => D.art(E.RESULTS[key].expr, 200).replace(/width="\d+" height="\d+" /, '');

  // 海报上的形象：优先真图，真图加载失败再退回矢量
  function loadDinoImage(key, pixelSize) {
    const real = HAS_REAL ? window.DINO_REAL[E.RESULTS[key].expr] : null;
    if (real) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => loadSvgImage(svgStrOf(key), pixelSize).then(resolve, reject);
        img.src = real;
      });
    }
    return loadSvgImage(svgStrOf(key), pixelSize);
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function wrapText(ctx, text, x, y, maxW, lh) {
    const chars = String(text).split('');
    let line = '', yy = y;
    for (const ch of chars) {
      if (ch === '\n') { ctx.fillText(line, x, yy); line = ''; yy += lh; continue; }
      if (ctx.measureText(line + ch).width > maxW) { ctx.fillText(line, x, yy); line = ch; yy += lh; }
      else line += ch;
    }
    ctx.fillText(line, x, yy);
    return yy;
  }
  function drawRadarOn(ctx, cx, cy, R, vals, dpr) {
    const n = E.DIMS.length;
    const ang = (i) => -Math.PI / 2 + i * Math.PI * 2 / n;
    ctx.lineWidth = 1.2 * dpr;
    for (let ring = 1; ring <= 3; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = ang(i % n), r = R * ring / 3;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.strokeStyle = '#EADFC4'; ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const a = ang(i);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.strokeStyle = '#EADFC4'; ctx.stroke();
    }
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const idx = i % n, a = ang(idx), r = R * vals[E.DIMS[idx]] / 100;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(78,143,107,.5)'; ctx.fill();
    ctx.strokeStyle = '#3C7455'; ctx.lineWidth = 2.4 * dpr; ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${12 * dpr}px -apple-system,"PingFang SC",sans-serif`;
    ctx.fillStyle = '#6B5B45'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const a = ang(i);
      ctx.fillText(E.DIM_LABELS[E.DIMS[i]] + ' ' + vals[E.DIMS[i]],
        cx + Math.cos(a) * (R + 46 * dpr), cy + Math.sin(a) * (R + 30 * dpr));
    }
    ctx.textBaseline = 'alphabetic';
  }

  /* ---------------- 结果海报 ----------------
     设计目标：让用户「一转发就自带社交属性」。
     做法：
      1. 顶部品牌条永远可见（转发出去别人知道这是哪测的）
      2. 一只巨大的电量数字 + 一句定性判决，截图时最抓眼
      3. 结果名是主角，配「稀有度」造稀缺感
      4. 底部把「谁耗你电 / 给你充电」印上去 —— 这是拿去 @ 别人的钩子
      5. 尺寸固定 750×1334（正好是 9:16 手机竖图），朋友圈/小红书不会被裁
     注意：文字高度全部用「实测」而不是估算，否则会重叠。 */
  async function buildPoster() {
    const r = state.result, p = state.personal;
    const res = E.RESULTS[r.key];
    const W = 750, PAD = 46, CW = W - PAD * 2;
    const c = document.createElement('canvas');
    const ctx0 = c.getContext('2d');
    const F = (w, s) => `${w} ${s}px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif`;

    // ---- 先把要画的文字全部换成行，算准总高 ----
    const verdictLines = wrapLines(ctx0, res.verdict, F(700, 27), CW - 64);
    const leadLines = wrapLines(ctx0, p.lead, F(600, 22), CW - 64);
    const LINE_V = 40, LINE_L = 34;

    // 分区高度
    const H_BRAND = 96;
    const H_NAME = 150;
    const H_CARD_V = 74 + verdictLines.length * LINE_V + 26;
    const H_LEAD = leadLines.length * LINE_L + 34;
    const H_RADAR = 356;
    const H_BARS = 62 + E.DIMS.length * 31;
    const H_REL = 196;
    const H_FOOT = 92;
    const H = H_BRAND + 22 + 300 + 20 + H_NAME + 22 + H_CARD_V + 16 + H_LEAD + 16
      + H_RADAR + 16 + H_BARS + 16 + H_REL + H_FOOT;
    c.width = W; c.height = H;

    const ctx = c.getContext('2d');
    let y = 0;

    // ---- 底色 ----
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#F2F7F2'); g.addColorStop(0.45, '#FBF7F0'); g.addColorStop(1, '#F1EDE4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W / 2, 300, 30, W / 2, 300, 420);
    rg.addColorStop(0, 'rgba(78,143,107,.42)'); rg.addColorStop(1, 'rgba(78,143,107,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, 760);

    // ---- 顶部品牌条（转发出去别人知道是哪测的）----
    ctx.fillStyle = '#4E8F6B'; ctx.fillRect(0, 0, W, H_BRAND);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.font = F(900, 30);
    ctx.fillText('社交电量测试', W / 2, H_BRAND / 2 - 12);
    ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.font = F(800, 17);
    ctx.fillText('SOCIAL BATTERY TEST · 你的电还剩几格', W / 2, H_BRAND / 2 + 18);
    y = H_BRAND + 22;

    // ---- 形象 ----
    try {
      const img = await loadDinoImage(r.key, 400);
      const size = 300, x = W / 2 - size / 2;
      ctx.save(); rr(ctx, x, y, size, size, 52); ctx.clip();
      ctx.drawImage(img, x, y, size, size); ctx.restore();
    } catch (e) { /* 图出不来也不影响其余内容 */ }
    y += 300 + 20;

    // ---- 结果名（主角）+ 稀有度 ----
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#221D17'; ctx.font = F(900, 76);
    ctx.fillText(res.name, W / 2, y + 62);
    ctx.fillStyle = '#4E8F6B'; ctx.font = F(900, 30);
    ctx.fillText(`${r.match}% 匹配`, W / 2, y + 112);
    ctx.fillStyle = '#A08F70'; ctx.font = F(700, 20);
    ctx.fillText(`100 个人里只有 ${p.rarity} 个是这种`, W / 2, y + 144);
    y += H_NAME + 22;

    // ---- 判决卡 ----
    ctx.fillStyle = '#fff'; rr(ctx, PAD, y, CW, H_CARD_V, 32); ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4E8F6B'; ctx.font = F(900, 18);
    ctx.fillText('定 性 判 决', PAD + 32, y + 42);
    ctx.fillStyle = '#221D17'; ctx.font = F(700, 27);
    verdictLines.forEach((ln, i) => ctx.fillText(ln, PAD + 32, y + 74 + 24 + i * LINE_V));
    y += H_CARD_V + 16;

    // ---- 引子（最该被转发的一句：按你的分数生成的）----
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6B5B45'; ctx.font = F(600, 22);
    const leadTop = y + 6;
    leadLines.forEach((ln, i) => ctx.fillText(ln, W / 2, leadTop + 20 + i * LINE_L));
    y += H_LEAD + 16;

    // ---- 雷达卡 ----
    ctx.fillStyle = '#fff'; rr(ctx, PAD, y, CW, H_RADAR, 32); ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#221D17'; ctx.font = F(900, 22);
    ctx.fillText('六 维 能 量 雷 达', W / 2, y + 46);
    drawRadarOn(ctx, W / 2, y + 204, 98, r.scores, 1.1);
    y += H_RADAR + 16;

    // ---- 六维条卡 ----
    ctx.fillStyle = '#fff'; rr(ctx, PAD, y, CW, H_BARS, 32); ctx.fill();
    let by = y + 48;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    E.DIMS.forEach((d) => {
      ctx.fillStyle = '#6B5B45'; ctx.font = F(800, 17);
      ctx.fillText(E.DIM_LABELS[d], PAD + 26, by);
      ctx.fillStyle = '#E6DECD';
      rr(ctx, PAD + 132, by - 8, 380, 16, 8); ctx.fill();
      ctx.fillStyle = '#4E8F6B';
      rr(ctx, PAD + 132, by - 8, Math.max(12, 380 * r.scores[d] / 100), 16, 8); ctx.fill();
      ctx.fillStyle = '#221D17'; ctx.font = F(900, 17);
      ctx.textAlign = 'right';
      ctx.fillText(String(r.scores[d]), W - PAD - 26, by);
      ctx.textAlign = 'left';
      by += 31;
    });
    y += H_BARS + 16;

    // ---- 关系磁场（拿去 @ 别人的钩子）----
    ctx.fillStyle = '#4E8F6B'; rr(ctx, PAD, y, CW, H_REL, 32); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = F(800, 17);
    ctx.fillText('把这张发给那个人', W / 2, y + 40);
    ctx.fillStyle = '#fff'; ctx.font = F(900, 30);
    ctx.fillText(`最耗我电 → ${E.RESULTS[p.rel.repel].name}`, W / 2, y + 92);
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = F(900, 30);
    ctx.fillText(`给我充电 → ${E.RESULTS[p.rel.attract].name}`, W / 2, y + 138);
    ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = F(700, 17);
    ctx.fillText('不是写死的配对，是按六维分数算出来的', W / 2, y + 172);
    y += H_REL;

    // ---- 页脚水印 ----
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8C7A5C'; ctx.font = F(900, 24);
    ctx.fillText('测同款 → 小红书 @Stanley', W / 2, y + 46);
    ctx.fillStyle = '#B3A488'; ctx.font = F(700, 16);
    ctx.fillText('本测试为娱乐性质，不构成心理诊断', W / 2, y + 72);

    return c;
  }

  // 把一段文字按最大宽度切成行（用于画之前先算高度，避免重叠）
  function wrapLines(ctx, text, font, maxW) {
    const prev = ctx.font; ctx.font = font;
    const out = [];
    String(text).split('\n').forEach((para) => {
      let line = '';
      for (const ch of para) {
        if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; }
        else line += ch;
      }
      out.push(line || ' ');
    });
    ctx.font = prev;
    return out;
  }

  async function savePoster() {
    if (state.busy) return;
    state.busy = true;
    toast('正在生成海报…');
    try {
      const c = await buildPoster();
      const url = c.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `社交电量测试-${E.RESULTS[state.result.key].name}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('已生成，长按图片也能保存');
    } catch (e) {
      toast('生成失败，请截图保存结果页');
    } finally {
      state.busy = false;
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    bindIntro();
    $('startBtn').onclick = openIntro;
    $('qBack').onclick = goBack;
    $('againBtn').onclick = () => { show('start'); window.scrollTo(0, 0); };
    $('saveBtn').onclick = savePoster;
    $('fabTop').onclick = () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });

    // 抽屉
    $('sheetClose').onclick = closeSheet;
    $('scrim').onclick = closeSheet;

    // 雷达：点顶点或标签，打开那一维
    const rc = $('radar');
    if (rc) {
      rc.onclick = (ev) => {
        if (!radarHits.length) return;
        const box = rc.getBoundingClientRect();
        // 把点击位置换算回 canvas 内部坐标
        const sx = rc.width ? rc.width / box.width : 1;
        const sy = rc.height ? rc.height / box.height : 1;
        const x = (ev.clientX - box.left) * sx;
        const y = (ev.clientY - box.top) * sy;
        const tol = 46 * (rc.width / RADAR_LOGICAL_W);
        let best = null, bd = 1e9;
        radarHits.forEach((h) => {
          [[h.x, h.y], [h.lx, h.ly]].forEach(([hx, hy]) => {
            const d = Math.hypot(x - hx, y - hy);
            if (d < bd) { bd = d; best = h; }
          });
        });
        if (best && bd < tol) showDimSheet(best.dim);
      };
    }

    // 关系磁场：点一下看为什么是这两只
    document.querySelectorAll('.rel').forEach((el) => { el.onclick = showRelSheet; });

    // 引导按钮：点它弹一下并滚到下一段；点右上角小叉关掉
  /* 引导小东西已按用户要求移除，相关绑定一并摘掉 */

    // 点空白处关抽屉
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { fitRadar(); measure(); onScroll(); updateGuide(); });
    window.addEventListener('orientationchange', () => setTimeout(() => { fitRadar(); measure(); onScroll(); updateGuide(); }, 260));
  }

  /* ---------------- 启动 ---------------- */
  buildStart();
  bind();

  /* 给截图 / 联调用的开关（只在带 ?demo= 时才生效，正常用户看不到）：
       ?demo=quiz     直接进答题页
       ?demo=result   自动把 18 题按画像答满，直接落到结果页
       ?noanim=1      关掉所有入场动画（截图时用，否则元素还是透明的）
     也方便以后做「看看某一只长什么样」的宣传图。 */
  (function demo() {
    let q = '';
    try { q = (window.location && window.location.search) || ''; } catch (e) { q = ''; }
    if (/noanim=1/.test(q)) {
      const st = document.createElement('style');
      st.textContent = '.rv{opacity:1 !important;transform:none !important;transition:none !important}'
        + '.opt-strip{animation:none !important;opacity:1 !important}'
        + '.screen.on{animation:none !important}';
      document.head.appendChild(st);
    }
    if (/diag=1/.test(q)) {
      // 量一下有没有元素横向溢出（手机端最容易出问题的就是这个）
      setTimeout(() => {
        const out = [`innerWidth=${window.innerWidth} docScrollW=${document.documentElement.scrollWidth} bodyScrollW=${document.body.scrollWidth}`];
        document.querySelectorAll('body *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
            const cls = typeof el.className === 'string' && el.className ? '.' + el.className.split(/\s+/).join('.') : '';
            out.push(`${el.tagName}${el.id ? '#' + el.id : ''}${cls} L${Math.round(r.left)} R${Math.round(r.right)} W${Math.round(r.width)}`);
          }
        });
        const pre = document.createElement('pre');
        pre.id = 'diagout';
        pre.textContent = out.slice(0, 30).join('\n');
        document.body.appendChild(pre);
      }, 60);
    }
    const m = q.match(/demo=([a-z0-9-]+)/);
    if (!m) return;
    const mode = m[1];
    if (mode === 'poster') {
      // 直接把生成的海报铺满页面，方便用截图验收版式
      if (!state.profile) state.profile = { gender: 'f', age: '23', ageLabel: '23–27 岁' };
      const target = q.match(/demo=poster-([a-z]+)/);
      const u = target ? E.unitVector(E.ARCH[target[1]]) : null;
      state.qi = 0;
      for (let i = 0; i < E.QUESTIONS.length; i++) {
        const [, opts] = E.QUESTIONS[i];
        let pick = 1;
        if (u) {
          let best = -1e9;
          opts.forEach(([, add], oi) => {
            let sc = 0; for (const d in add) sc += add[d] * u[d];
            if (sc > best) { best = sc; pick = oi; }
          });
        }
        state.answers[state.qi] = pick;
        state.qi++;
      }
      state.result = E.rank(rawScores(), state.profile);
      state.personal = E.personal(state.result);
      buildPoster().then((cv) => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#222;overflow:auto;'
          + 'display:flex;align-items:flex-start;justify-content:center;padding:10px';
        const im = document.createElement('img');
        im.src = cv.toDataURL('image/png');
        im.style.cssText = 'width:100%;max-width:520px;border-radius:10px';
        wrap.appendChild(im);
        document.body.appendChild(wrap);
        window.__posterSize = cv.width + 'x' + cv.height;
      });
    } else if (mode === 'intro') {
      // 停在开场问答页（截图 / 联调用）
      PROFILE.gender = 'f';
      openIntro();
    } else if (mode === 'quiz') {
      state.profile = { gender: 'f', age: '23' };   // demo 也给个默认画像，免得对照句没数据
      startQuiz();
    } else if (mode === 'result' || E.ARCH[mode]) {
      if (!state.profile) state.profile = { gender: 'f', age: '23' };
      // ?demo=result 或 ?demo=<某只的key>：自动答题，指定 key 时按那只的画像方向选
      const target = E.ARCH[mode] ? mode : null;
      const u = target ? E.unitVector(E.ARCH[target]) : null;
      state.qi = 0;
      for (let i = 0; i < E.QUESTIONS.length; i++) {
        const [, opts] = E.QUESTIONS[i];
        let pick = 1;
        if (u) {
          let best = -1e9;
          opts.forEach(([, add], oi) => {
            let sc = 0;
            for (const d in add) sc += add[d] * u[d];
            if (sc > best) { best = sc; pick = oi; }
          });
        }
        state.answers[state.qi] = pick;
        state.qi++;
        if (state.qi < E.QUESTIONS.length) renderQ();
      }
      finish();
    }
  })();
  // 引导按钮的图案（有真图就优先用真图）
  /* 引导形象初始化已移除 */
  // 开始页也走一遍入场（逐个元素错峰，不是整块一起冒出来）
  // 已经在 HTML 里写死 --d 的元素（heroArt 必须最先出现）保持自己的延迟
  const preset = new Set(['heroArt']);
  const startEls = [];
  [
    '#start .brandbar', '#start .hero', '#start h1.title', '#start .lede', '#start .statrow',
    '#start .cta-wrap',
    '#start .blk:nth-of-type(1) .blk-head', '#start .roster',
    '#start .blk:nth-of-type(2) .blk-head', '#start .blk:nth-of-type(2) .step',
  ].forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (!startEls.includes(el)) startEls.push(el);
    });
  });
  let delayStep = 0;
  startEls.forEach((el) => {
    el.classList.add('rv');
    if (el.id && preset.has(el.id)) return;
    el.style.setProperty('--d', (++delayStep * 65) + 'ms');
  });
  const startIO = new IntersectionObserver((es) => {
    es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); startIO.unobserve(en.target); } });
  }, { threshold: 0.1 });
  startEls.forEach((el) => startIO.observe(el));
})();
