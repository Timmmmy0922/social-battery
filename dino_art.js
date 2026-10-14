/* ===========================================================
   原创水豚（卡皮巴拉）形象 —— dino_art.js
   -----------------------------------------------------------
   为什么是水豚：卡皮巴拉是物种名，动物本身不能被谁的商标独占，
   所以画一只原创水豚——热度借得到，版权是自己的。

   设计要点（都是「可爱」的来源，改的时候别破坏）：
     - 侧面。水豚最可爱的角度是侧脸：钝钝的方鼻子、额头顶平
     - 头大身体小（头约占全长 45%），这是「幼态」的核心
     - 腿特别短，尾巴几乎没有，耳朵两点小圆
     - 描边粗、圆头圆角，整体一坨软糖感
   画布：viewBox 0 0 200 200，朝左（鼻子在左边）
   =========================================================== */
(function (root) {
  const INK = '#3A2A1C';
  const F1 = '#C68B4E';   // 毛色
  const F2 = '#A96F35';   // 暗部：耳朵 / 四肢 / 鼻头
  const F3 = '#EBD3AE';   // 肚皮 / 口鼻
  const PK = '#E9A79B';   // 腮红
  const BL = '#7FC4F0';   // 泪 / 汗
  const SH = 'rgba(120,84,30,.16)';

  const S = (d, extra = '') =>
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const F = (d, fill) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;

  /* ---------- 轮廓 ----------
     一条闭合线：鼻子 → 额头 → 背 → 屁股 → 后腿 → 肚子 → 前腿 → 下巴 → 回鼻子。
     头在前（左），身体在后（右）。 */
  const BODY = 'M52 84' +
    'C46 80 46 70 54 64' +
    'C60 58 70 53 82 52' +
    'C96 50 108 54 115 62' +
    'C124 56 137 54 148 58' +
    'C164 63 176 78 179 96' +
    'C182 116 179 134 172 146' +
    'C170 156 166 162 162 164' +
    'L150 164' +
    'C148 152 147 144 146 138' +
    'C138 144 128 147 116 147' +
    'C110 157 106 163 102 165' +
    'L90 165' +
    'C88 154 86 146 83 141' +
    'C70 140 58 136 51 128' +
    'C44 120 38 106 40 90 Z';

  const HIND = F('M148 132 q-10 16 -2 26 q10 4 18 -2 q4 -14 -2 -24 Z', F2);

  function body(o = {}) {
    const { tilt = 0, ear = true, legFront = 'stand' } = o;
    const legs = legFront === 'stand'
      ? F('M84 140 q-6 20 0 26 q4 5 12 3 q4 -16 0 -26 Z', F2) +
        F('M100 141 q-6 20 0 26 q4 5 12 3 q4 -16 0 -26 Z', F2) +
        HIND +
        F('M160 140 q-6 20 -1 26 q4 5 12 3 q4 -16 0 -26 Z', F2)
      : F('M82 138 q-22 10 -18 26 h24 q5 -14 0 -26 Z', F2) +
        F('M150 136 q-24 12 -20 28 h26 q6 -16 0 -28 Z', F2);
    const earP = ear
      ? F('M76 58 q-3 -11 7 -12 q9 1 6 12 Z', F2) +
        F('M114 62 q-3 -11 7 -12 q9 1 6 12 Z', F2)
      : '';
    return `
      <g transform="rotate(${tilt} 110 120)">
        ${legs}
        ${F(BODY, F1)}
        <ellipse cx="118" cy="126" rx="32" ry="19" fill="${F3}" stroke="none" opacity=".62"/>
        ${earP}
        ${S(BODY, 'stroke-width="3"')}
      </g>`;
  }

  /* ---------- 侧脸零件 ----------
     眼睛在头前上方；口鼻是一块钝钝的浅色，鼻头一个小深色圆。
     侧面那个大钝鼻子是水豚的灵魂。 */
  function face(o = {}) {
    const ex = 70, ey = 74;
    const nx = 50, ny = 86;
    const kind = o.eyes || 'calm';
    const dot = `<circle cx="${ex}" cy="${ey}" r="7.4" fill="${INK}"/>` +
                `<circle cx="${ex - 2.2}" cy="${ey - 2.4}" r="2.3" fill="#fff"/>`;
    let eyePart;
    switch (kind) {
      case 'closed':
        eyePart = S(`M${ex - 9} ${ey + 1} q9 -11 18 0`, 'stroke-width="3.4"'); break;
      case 'sleepy':
        eyePart = dot + `<path d="M${ex - 10} ${ey - 6} h20" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`; break;
      case 'sparkle': {
        const r = 8;
        eyePart = `<path d="M${ex} ${ey - r} L${ex + r * .3} ${ey - r * .3} L${ex + r} ${ey} L${ex + r * .3} ${ey + r * .3} L${ex} ${ey + r} L${ex - r * .3} ${ey + r * .3} L${ex - r} ${ey} L${ex - r * .3} ${ey - r * .3} Z" fill="${INK}"/>`;
        break;
      }
      case 'sad':
        eyePart = `<circle cx="${ex}" cy="${ey + 3}" r="7.4" fill="${INK}"/>` +
                  S(`M${ex - 10} ${ey - 11} q10 3 16 8`, 'stroke-width="2.6"'); break;
      case 'angry':
        eyePart = `<circle cx="${ex}" cy="${ey + 1}" r="7.4" fill="${INK}"/>` +
                  `<circle cx="${ex - 2}" cy="${ey - 1}" r="2.2" fill="#fff"/>` +
                  S(`M${ex - 12} ${ey - 14} l20 8`, 'stroke-width="3.6"'); break;
      case 'dead':
        eyePart = S(`M${ex - 10} ${ey - 10} l20 20`, 'stroke-width="3.4"') +
                  S(`M${ex + 10} ${ey - 10} l-20 20`, 'stroke-width="3.4"'); break;
      default:
        eyePart = dot;
    }
    return `
      ${eyePart}
      <ellipse cx="${nx + 7}" cy="${ny + 5}" rx="17" ry="14" fill="${F3}" stroke="${INK}" stroke-width="2.4"/>
      <ellipse cx="${nx + 1}" cy="${ny + 1}" rx="6.2" ry="4.8" fill="${INK}"/>
      ${o.mouth || S(`M${nx + 4} ${ny + 19} q11 7 21 -2`, 'stroke-width="2.8"')}`;
  }

  const blush = (op = .7, dx = 0, dy = 0) =>
    `<ellipse cx="${66 + dx}" cy="${110 + dy}" rx="9" ry="6" fill="${PK}" opacity="${op}"/>`;

  const shadow = (cx = 110, cy = 176, rx = 62) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="7" fill="${SH}"/>`;

  /* ---------- 8 种表情 ---------- */
  const MASCOTS = {
    // 假装有电：半阖眼 + 硬笑 + 冷汗
    fake: () => shadow() + body() + face({ eyes: 'sleepy', mouth: S('M48 107 q11 6 20 -2', 'stroke-width="2.8"') }) +
      blush(.5) + `<path d="M150 44 q6 12 1 18 q-8 -3 -6 -18 Z" fill="${BL}" stroke="${INK}" stroke-width="2"/>`,

    // 电量跳崖：大哭
    cry: () => shadow() + body({ tilt: -2 }) +
      face({ eyes: 'sad', mouth: `<ellipse cx="48" cy="106" rx="11" ry="9" fill="#8A4A44" stroke="${INK}" stroke-width="2.4"/>` }) +
      blush(.6) +
      `<path d="M56 90 q-7 18 -2 28 q8 -9 8 -28 Z" fill="${BL}" stroke="${INK}" stroke-width="2"/>`,

    // 食堂充电：星星眼 + 笑 + 抱着吃的
    yum: () => shadow() + body() + face({ eyes: 'sparkle', mouth: S('M46 105 q12 10 22 -2', 'stroke-width="2.8"') }) +
      blush(.8) +
      `<g transform="rotate(-12 100 138)">
         <ellipse cx="104" cy="136" rx="14" ry="9" fill="#E8734F" stroke="${INK}" stroke-width="2.6"/>
         <path d="M90 136 h-12" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
       </g>`,

    // 人体充电宝：闭眼笑 + 爱心
    love: () => shadow() + body() + face({ eyes: 'closed', mouth: S('M46 104 q12 11 23 -3', 'stroke-width="2.8"') }) +
      blush(1) +
      `<path d="M150 44 c-6 -10 -22 -8 -22 4 c0 9 12 15 22 22 c10 -7 22 -13 22 -22 c0 -12 -16 -14 -22 -4 Z"
             fill="#F07A88" stroke="${INK}" stroke-width="2.6"/>`,

    // 低电量暴走：怒眉 + 张嘴 + 冒气
    angry: () => shadow() + body({ tilt: 2 }) +
      face({ eyes: 'angry', mouth: `<ellipse cx="48" cy="107" rx="9" ry="10" fill="#8A4A44" stroke="${INK}" stroke-width="2.4"/>` }) +
      `<path d="M158 52 q11 -6 16 3 q-9 1 -11 12 q-6 -6 -5 -15 Z" fill="#F07A88" stroke="${INK}" stroke-width="2.2"/>
       <path d="M170 92 q10 8 5 20" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" opacity=".45"/>
       <path d="M176 72 q9 -6 13 3" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" opacity=".4"/>`,

    // 省电模式：坐着 + 半阖眼 + zzz
    chill: () => shadow(110, 178, 68) + body({ ear: false, legFront: 'sit' }) +
      face({ eyes: 'sleepy', mouth: S('M50 107 q9 -6 16 3 q7 -9 14 -1', 'stroke-width="2.8"') }) +
      `<text x="150" y="44" font-size="21" font-weight="700" fill="${INK}" opacity=".42">z</text>
       <text x="166" y="28" font-size="14" font-weight="700" fill="${INK}" opacity=".28">z</text>`,

    // 已关机：叉眼 + 平嘴 + 吐舌
    dead: () => shadow(110, 178, 68) + body({ tilt: 3, ear: false, legFront: 'sit' }) +
      face({ eyes: 'dead', mouth: S('M48 108 h20', 'stroke-width="2.8"') }) + blush(.45) +
      `<path d="M56 114 q9 4 5 13 q-9 0 -11 -11 Z" fill="#F07A88" stroke="${INK}" stroke-width="2.2"/>`,

    // 满电社交：闭眼大笑 + 闪光
    laugh: () => shadow() + body({ tilt: -1 }) +
      face({ eyes: 'closed', mouth: `<path d="M44 102 q13 17 26 -2 Z" fill="#8A4A44" stroke="${INK}" stroke-width="2.6"/>` }) +
      blush(.85) +
      `<path d="M150 62 l4 8 l8 4 l-8 4 l-4 8 l-4 -8 l-8 -4 l8 -4 Z" fill="${INK}" opacity=".22"/>`,
  };

  const KEYS = Object.keys(MASCOTS);

  function art(key, size = 200, cls = '') {
    const f = MASCOTS[key] || MASCOTS.fake;
    return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" class="${cls}" aria-hidden="true">${f()}</svg>`;
  }

  const ART = { MASCOTS, art, KEYS, INK, F1, F2, F3, PK, BL };

  if (typeof module !== 'undefined' && module.exports) module.exports = ART;
  root.DINO = ART;
  root.DINO_SVG = MASCOTS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
