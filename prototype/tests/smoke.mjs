/**
 * Immortal Sect smoke regression.
 *
 * Runs against the production build with Playwright + local Chrome.
 * Covers: boot, 3-candidate day loop, mainline deferral, building posts,
 * save/load, 9 character arcs, and the render-call budget.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright-core';

const PORT = Number(process.env.TEST_PORT ?? 4311);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const failures = [];
const checks = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

const server = spawn(process.execPath, ['serve.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});
server.on('error', (e) => console.error('smoke server failed:', e.message));

try {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) break;
    } catch {
      /* retry */
    }
    await sleep(100);
  }

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(`${BASE}/?demo=1&story=0&intro=0&fresh=1&auto=0&panel=1`, {
    waitUntil: 'load',
    timeout: 150_000,
  });
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('is-hidden'), null, {
    timeout: 150_000,
  });
  await page.waitForTimeout(500);

  const boot = await page.evaluate(() => ({
    hasGame: Boolean(window.__sect?.game),
    calls: window.__sect.engine.info.render.calls,
    triangles: window.__sect.engine.info.render.triangles,
    playerMeshes: (() => {
      let n = 0;
      window.__sect.player.rig.group.traverse((o) => {
        if (o.isMesh) n++;
      });
      return n;
    })(),
  }));
  check('boot: game exists', boot.hasGame);
  check('perf: idle draw calls under 260', boot.calls < 260, String(boot.calls));
  check('perf: scene triangles under 800k', boot.triangles < 800_000, String(boot.triangles));
  check('perf: player meshes under 40', boot.playerMeshes < 40, String(boot.playerMeshes));

  // ── 3 candidate cards, mainline deferral, skip ───────────────────────────
  const candidate = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.state.day = 1;
    g.state.pendingEvent = null;
    g.state.candidates = [];
    g.state.candidateResolved = true;
    g.state.storyDeferred = [];
    g.state.seenEvents = [];
    g.endDay();
    const first = {
      day: g.state.day,
      candidates: g.state.candidates.slice(),
      main: g.state.candidateMain,
    };
    const other = first.candidates.find((id) => id !== first.main);
    g.chooseCandidate(other);
    const afterPick = {
      pending: g.state.pendingEvent,
      deferred: g.state.storyDeferred.slice(),
    };
    g.state.pendingEvent = null;
    g.endDay();
    const second = {
      candidates: g.state.candidates.slice(),
      main: g.state.candidateMain,
      deferred: g.state.storyDeferred.slice(),
    };
    g.skipCandidates();
    const afterSkip = {
      candidates: g.state.candidates.slice(),
      resolved: g.state.candidateResolved,
      deferred: g.state.storyDeferred.slice(),
    };
    return { first, afterPick, second, afterSkip };
  });
  check('candidates: 3 offers', candidate.first.candidates.length === 3, JSON.stringify(candidate.first));
  check('candidates: unique ids', new Set(candidate.first.candidates).size === 3);
  check('candidates: one mainline', Boolean(candidate.first.main));
  check('candidates: picking another defers mainline', candidate.afterPick.deferred.includes(candidate.first.main));
  check('candidates: deferred mainline returns next day', candidate.second.main === candidate.first.main, JSON.stringify(candidate.second));
  check('candidates: skip clears offers', candidate.afterSkip.candidates.length === 0 && candidate.afterSkip.resolved);

  // ── Building posts + upkeep + save/load ─────────────────────────────────
  const building = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    const before = g.state.resources.stones;
    const posted = g.assignPost('gu', 'field');
    const gu = g.state.disciples.find((d) => d.id === 'gu');
    const report = g.endDay();
    const after = g.state.resources.stones;
    g.saveTo('1');
    g.loadSlot('1');
    const loaded = g.state.disciples.find((d) => d.id === 'gu');
    g.reset();
    g.assignPost('su', 'field');
    const specialist = g.endDay();
    const specialistOutput = specialist.report.lines.find((l) => l.text.includes('建筑产出'))?.text;
    return {
      posted: posted.ok,
      post: gu?.post,
      before,
      after,
      reportLines: report.report.lines.map((l) => l.text),
      loadedPost: loaded?.post,
      specialistOutput,
      risk: {
        tier: g.getEventById('free_beast')?.tier,
        risk: g.getEventById('free_beast')?.risk,
        cooldown: g.getEventById('free_beast')?.cooldown,
      },
    };
  });
  check('building: post accepted', building.posted && building.post === 'field');
  check('building: upkeep/report present', building.reportLines.some((l) => l.includes('建筑产出')));
  check('building: stones paid upkeep', building.after < building.before, JSON.stringify(building));
  check('building: post survives save/load', building.loadedPost === 'field');
  check('building: specialist adds output', building.specialistOutput?.includes('药材 +4'), building.specialistOutput);
  check('events: tier/risk/cooldown metadata', building.risk.tier === 2 && building.risk.risk === 'high' && building.risk.cooldown === 3, JSON.stringify(building.risk));

  // ── Risky options roll a seeded success/failure check ────────────────────
  const riskCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    const event = g.getEventById('free_beast');
    const option = event.options.find((o) => o.check);
    const chance = g.checkChance(option);
    const seedBefore = g.state.checkSeed;
    const result = g.choose('free_beast', option.id);
    return { chance, seedBefore, seedAfter: g.state.checkSeed, text: result.text };
  });
  check('events: success rate computed 5-95', riskCheck.chance >= 5 && riskCheck.chance <= 95, String(riskCheck.chance));
  check('events: check consumes seed', riskCheck.seedAfter !== riskCheck.seedBefore);

  // ── daily objective + disciple strain ────────────────────────────────────
  const objectiveCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.state.dailyObjective = { id: 'herbs', metric: 'herbs', target: 0, done: false };
    g.state.lastObjectiveId = 'none';
    const meritsBefore = g.state.sectMerits;
    const r = g.endDay();
    return {
      meritsBefore,
      meritsAfter: g.state.sectMerits,
      completed: r.report.lines.some((l) => l.text.includes('要务达成')),
      next: g.state.dailyObjective?.id,
    };
  });
  check('objective: completes and rolls next', objectiveCheck.completed && objectiveCheck.meritsAfter > objectiveCheck.meritsBefore && !!objectiveCheck.next, JSON.stringify(objectiveCheck));

  const resignCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    for (const d of g.state.disciples) {
      d.assignment = 'rest';
      d.injury = 0;
      d.mood = 60;
      d.strain = 0;
      d.active = true;
    }
    const x = g.state.disciples.find((d) => d.id === 'qi');
    x.mood = 10;
    x.bond = 5;
    x.strain = 3;
    const orig = Math.random;
    Math.random = () => 0;
    let result;
    try {
      result = g.endDay();
    } finally {
      Math.random = orig;
    }
    return {
      active: g.state.disciples.find((d) => d.id === 'qi').active,
      left: result.report.lines.some((l) => l.text.includes('离开了青云宗')),
    };
  });
  check('disciple: neglect causes departure', resignCheck.left && !resignCheck.active, JSON.stringify(resignCheck));

  // ── sect rank + era milestones ────────────────────────────────────────────
  const eraCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.state.freeMode = true;
    g.state.day = 20;
    g.state.sectMerits = 40;
    g.endDay();
    const hasCard = g.state.candidates.includes('era_three');
    const ev = g.getEventById('era_three');
    const picked = hasCard && ev ? g.chooseCandidate('era_three') : false;
    return { hasCard, hasEvent: !!ev, picked, pending: g.state.pendingEvent };
  });
  check('era: milestone appears and is pickable', eraCheck.hasCard && eraCheck.hasEvent && eraCheck.picked && eraCheck.pending === 'era_three', JSON.stringify(eraCheck));

  const rankLabel = await page.evaluate(() => {
    window.__sect.gameUi.render();
    return document.querySelector('.obj-meta')?.textContent ?? '';
  });
  check('rank: sect rank name shown', rankLabel.includes('三流宗门'), rankLabel);

  // ── sect perks / recall / sanctum ─────────────────────────────────────────
  const perkCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.state.sectMerits = 360; // 霸主：行动 +1，灵石/药材 +7
    for (const d of g.state.disciples) { d.assignment = 'rest'; d.injury = 0; d.mood = 60; }
    g.state.day = 5;
    const max = g.maxActionPoints;
    const r = g.endDay();
    return { max, perkLine: r.report.lines.find((l) => l.text.includes('宗阶香火'))?.text };
  });
  check('perk: rank grants action point + passive harvest', perkCheck.max === 4 && !!perkCheck.perkLine, JSON.stringify(perkCheck));

  const recallCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.state.departed = ['qi'];
    const q = g.state.disciples.find((d) => d.id === 'qi');
    q.active = false; q.mood = 40; q.bond = 40;
    g.state.freeMode = true; g.state.day = 20;
    g.endDay();
    const offered = g.state.candidates.includes('recall_qi');
    const ev = g.getEventById('recall_qi');
    const picked = offered && ev ? g.chooseCandidate('recall_qi') : false;
    const res = g.choose('recall_qi', 'seek');
    return { offered, picked, active: g.state.disciples.find((d) => d.id === 'qi').active, departed: g.state.departed.includes('qi'), text: res.text?.slice(0, 24) };
  });
  check('recall: departed disciple can return', recallCheck.offered && recallCheck.picked && recallCheck.active && !recallCheck.departed, JSON.stringify(recallCheck));

  const sanctumCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.state.freeMode = true;
    g.state.day = 20;
    g.state.sectMerits = 520;
    g.state.seenEvents = ['era_three', 'era_two', 'era_first', 'era_famous', 'era_hegemon'];
    g.endDay();
    return { has: g.state.candidates.includes('era_sanctum'), hasEvent: !!g.getEventById('era_sanctum') };
  });
  check('sanctum: domain tournament at 圣地 rank', sanctumCheck.has && sanctumCheck.hasEvent, JSON.stringify(sanctumCheck));

  // ── New Game+ carries the sect rank forward ───────────────────────────────
  const ngpCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.state.sectMerits = 120; // 二流宗门
    g.state.ending = { rank: 'hold', title: 't', subtitle: 's', text: 'x', epilogues: [], score: 50 };
    g.newGamePlus(); // cycle 1
    const eraMarked = g.state.seenEvents.includes('era_three') && g.state.seenEvents.includes('era_two');
    const eraFirstMarked = g.state.seenEvents.includes('era_first');
    g.newGamePlus(); // cycle 2
    return {
      cycle: g.state.cycle,
      merits: g.state.sectMerits,
      day: g.state.day,
      eraMarked,
      eraFirstMarked,
      hasFrost: g.state.player.techniques.includes('霜刃'),
      pills: g.state.player.pills,
    };
  });
  check('ng+: merit carried, cycle +1, prior eras marked', ngpCheck.cycle === 2 && ngpCheck.merits === 120 && ngpCheck.day === 1 && ngpCheck.eraMarked && !ngpCheck.eraFirstMarked, JSON.stringify(ngpCheck));
  check('ng+: cycle 2 grants 霜刃 + extra pill', ngpCheck.hasFrost && ngpCheck.pills >= 2, JSON.stringify({ hasFrost: ngpCheck.hasFrost, pills: ngpCheck.pills }));

  // ── 21 arcs (7 lines × 3) + finale through the candidate loop ───────────
  const arcs = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.state.ending = { rank: 'hold', title: 'test', subtitle: '', text: '', epilogues: [], score: 50 };
    g.enterFreeMode();
    const picked = [];
    for (let i = 0; i < 21; i++) {
      g.endDay();
      const main = g.state.candidateMain;
      const event = main ? g.getEventById(main) : null;
      const option = event?.options.find((o) => !o.requires || o.requires(g.state));
      if (!main || !event || !option) break;
      if (!g.chooseCandidate(main)) break;
      g.choose(main, option.id);
      picked.push(main);
    }
    if (!g.state.flags.arcFinale) {
      g.endDay();
      const main = g.state.candidateMain;
      const event = main ? g.getEventById(main) : null;
      const option = event?.options.find((o) => !o.requires || o.requires(g.state));
      if (main && event && option && g.chooseCandidate(main)) g.choose(main, option.id);
    }
    return {
      picked,
      done: g.arcStatus().done,
      flags: {
        su: g.state.flags.suArc,
        bai: g.state.flags.baiArc,
        qi: g.state.flags.qiArc,
        xuan: g.state.flags.xuanArc,
        shen: g.state.flags.shenArc,
        gu: g.state.flags.guArc,
        lu: g.state.flags.luArc,
        finale: g.state.flags.arcFinale,
      },
      candidates: g.state.candidates.slice(),
    };
  });
  check('arcs: 21 scenes picked', arcs.picked.length === 21, JSON.stringify(arcs.picked));
  check('arcs: all 7 lines complete', arcs.done === 21 && ['su', 'bai', 'qi', 'xuan', 'shen', 'gu', 'lu'].every((k) => arcs.flags[k] === 3), JSON.stringify(arcs));
  check('arcs: finale flag', arcs.flags.finale === true);
  check('arcs: no tournament card', !arcs.candidates.includes('tournament'));

  // ── Faith ladder (香火天梯): earn → rank bonus → spend → passives ────────
  const faithCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.state.freeMode = true;
    g.state.day = 5;
    // +1 faith on objective completion
    g.state.dailyObjective = { id: 'herbs', metric: 'herbs', target: 1, done: false };
    g.state.resources.herbs = 50;
    for (const d of g.state.disciples) { d.assignment = 'rest'; d.injury = 0; d.mood = 60; }
    g.endDay();
    const faithAfterObjective = g.state.sectFaith;
    // +2 faith per newly crossed rank
    g.state.sectMerits = 30; // cross into 三流宗门
    const beforeRank = g.state.sectFaith;
    g.state.pendingEvent = null; g.state.candidates = []; g.state.candidateResolved = true;
    g.state.dailyObjective = { id: 'herbs', metric: 'herbs', target: 9999, done: false };
    g.endDay();
    const faithAfterRank = g.state.sectFaith;
    // spend faith on each boon
    g.state.sectFaith = 30;
    const buy = {};
    for (const id of ['vein', 'pool', 'array', 'talisman']) {
      const r = g.spendFaith(id);
      buy[id] = { ok: r.ok, level: r.level };
    }
    const levels = { vein: g.faithBoonLevel('vein'), pool: g.faithBoonLevel('pool'), array: g.faithBoonLevel('array'), talisman: g.faithBoonLevel('talisman') };
    // refusal when broke
    g.state.sectFaith = 0;
    const broke = g.spendFaith('vein');
    // pool passive: cultivate gain includes +0.5/level
    const d = g.state.disciples.find((x) => x.id === 'gu');
    d.assignment = 'cultivate'; d.mood = 60; d.injury = 0;
    const c0 = d.cultivation;
    g.state.pendingEvent = null; g.state.candidates = []; g.state.candidateResolved = true;
    g.state.dailyObjective = { id: 'herbs', metric: 'herbs', target: 9999, done: false };
    g.endDay();
    return { faithAfterObjective, beforeRank, faithAfterRank, buy, levels, broke, poolGain: +(d.cultivation - c0).toFixed(1) };
  });
  check('faith: +1 per objective, +2 per rank-up', faithCheck.faithAfterObjective >= 1 && faithCheck.faithAfterRank >= faithCheck.beforeRank + 2, JSON.stringify(faithCheck));
  check('faith: spend buys all 4 boons, refusal when broke', Object.values(faithCheck.buy).every((b) => b.ok) && !faithCheck.broke.ok && faithCheck.levels.vein === 1 && faithCheck.levels.pool === 1 && faithCheck.levels.array === 1 && faithCheck.levels.talisman === 1, JSON.stringify(faithCheck));

  // ── Demon-sect mainline (魔道仇敌) ────────────────────────────────────────
  const demonCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.state.ending = { rank: 'hold', title: 't', subtitle: '', text: '', epilogues: [], score: 50 };
    g.enterFreeMode();
    g.state.sectMerits = 160; // unlock demon_1
    const picked = [];
    for (let i = 0; i < 4; i++) {
      g.endDay();
      const main = g.state.candidateMain;
      const ev = main ? g.getEventById(main) : null;
      const option = ev?.options.find((o) => !o.requires || o.requires(g.state));
      if (!main || !ev || !option) break;
      if (!g.chooseCandidate(main)) break;
      g.choose(main, option.id);
      picked.push(main);
    }
    return { picked, chain: g.state.flags.demonChain, merits: g.state.sectMerits };
  });
  check('demon: 4-scene chain advances', demonCheck.picked.length === 4 && demonCheck.picked.every((id) => id.startsWith('demon_')) && demonCheck.chain === 4, JSON.stringify(demonCheck));

  // ── Master artifacts (法宝) ────────────────────────────────────────────────
  const artifactCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.onTrialWin(); g.onTrialWin(); g.onTrialWin();
    const seal = g.state.player.artifacts.includes('trial_seal');
    const sealCount = g.state.player.artifacts.filter((x) => x === 'trial_seal').length;
    const demon3 = g.getEventById('demon_3');
    const tasselWired = demon3.options.some((o) => o.effects.some((e) => e.artifact === 'demon_tassel'));
    const sanctum = g.getEventById('era_sanctum');
    const sanctumWired = sanctum.options.some((o) => o.effects.some((e) => e.artifact === 'sanctum_seal'));
    g.newGamePlus(); g.newGamePlus(); // reach cycle 2
    const locket = g.state.player.artifacts.includes('vein_locket');
    return { seal, sealCount, tasselWired, sanctumWired, locket, cycle: g.state.cycle };
  });
  check('artifact: trial_seal via 3 wins, no dup', artifactCheck.seal && artifactCheck.sealCount === 1, JSON.stringify(artifactCheck));
  check('artifact: demon_tassel/sanctum_seal/vein_locket wired', artifactCheck.tasselWired && artifactCheck.sanctumWired && artifactCheck.locket, JSON.stringify(artifactCheck));

  // ── Technique tree (功法研习) ──────────────────────────────────────────────
  const techCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.state.resources.insight = 30;
    const teach = g.teachTechnique('su', 'herb');
    const dup = g.teachTechnique('su', 'herb');
    const lv = g.state.disciples.find((x) => x.id === 'su').technique;
    const insightLeft = g.state.resources.insight;
    // resolveTask gather bonus applies (herb +2.5)
    const d = g.state.disciples.find((x) => x.id === 'su');
    d.assignment = 'gather'; d.mood = 60; d.injury = 0;
    const before = g.state.resources.herbs;
    g.state.pendingEvent = null; g.state.candidates = []; g.state.candidateResolved = true;
    g.state.dailyObjective = { id: 'herbs', metric: 'herbs', target: 9999, done: false };
    g.endDay();
    const herbGain = g.state.resources.herbs - before;
    // broke refusal
    g.state.resources.insight = 0;
    const broke = g.teachTechnique('gu', 'dao');
    return { teachOk: teach.ok, dupOk: dup.ok, lv, insightLeft, herbGain, brokeOk: broke.ok };
  });
  check('technique: teach costs insight, sets technique, no dup', techCheck.teachOk && !techCheck.dupOk && techCheck.lv === 'herb' && techCheck.insightLeft === 22, JSON.stringify(techCheck));
  check('technique: herb task boosted, broke refused', techCheck.herbGain >= 2.5 && !techCheck.brokeOk, JSON.stringify(techCheck));

  // ── Tribulation 3D boss gate ─────────────────────────────────────────────
  const tribCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    const p = g.state.player;
    p.realmIndex = 8; // next realm 9 → tribulation
    p.bottleneck = true;
    p.pills = 1;
    const info = g.breakthroughInfo();
    const started = g.beginTribulation('sword');
    const pending = g.state.pendingTribulation;
    const win = g.resolveTribulation(true);
    const realmAfter = p.realmIndex;
    p.realmIndex = 8;
    p.bottleneck = true;
    p.pills = 1;
    g.beginTribulation('steady');
    const lose = g.resolveTribulation(false);
    return {
      tribulation: info.tribulation,
      started: started.ok && pending === 'sword',
      win: win.success && realmAfter === 9,
      lose: !lose.success && p.realmIndex === 8,
      cleared: g.state.pendingTribulation === null,
    };
  });
  check('tribulation: 3D gate forces breakthrough on win', tribCheck.tribulation && tribCheck.started && tribCheck.win && tribCheck.lose && tribCheck.cleared, JSON.stringify(tribCheck));

  const bossCheck = await page.evaluate(() => {
    const c = window.__sect.combat;
    c.enemy.setBoss(1.35, '#9fd7ff', 0.6);
    const hp = c.enemy.hp;
    c.enemy.clearBoss();
    const restored = c.enemy.hp;
    return { hp, restored };
  });
  check('tribulation: boss scaled HP', bossCheck.hp === 1215, JSON.stringify(bossCheck));
  check('tribulation: boss clear restores base HP', bossCheck.restored === 900, JSON.stringify(bossCheck));

  const forfeitCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    const p = g.state.player;
    p.realmIndex = 8; p.bottleneck = true; p.pills = 1;
    g.beginTribulation('steady');
    const hadPending = g.state.pendingTribulation === 'steady';
    const msg = g.cancelTribulation();
    return { hadPending, cleared: g.state.pendingTribulation === null, hasMsg: !!msg };
  });
  check('tribulation: forfeit clears pending state', forfeitCheck.hadPending && forfeitCheck.cleared && forfeitCheck.hasMsg, JSON.stringify(forfeitCheck));

  // ── Seasons, age, and lifespan ending ────────────────────────────────────
  const seasonCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    for (const d of g.state.disciples) { d.assignment = 'rest'; d.injury = 0; d.mood = 60; }
    g.state.day = 3;
    const r = g.endDay();
    return { day: g.state.day, season: g.state.season, hasSeasonLine: r.report.lines.some((l) => l.text.includes('节气')) };
  });
  check('season: spring → summer at day 4', seasonCheck.day === 4 && seasonCheck.season === 1 && seasonCheck.hasSeasonLine, JSON.stringify(seasonCheck));

  const ageCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    for (const d of g.state.disciples) { d.assignment = 'rest'; d.injury = 0; d.mood = 60; }
    g.state.freeMode = true;
    g.state.day = 12;
    g.endDay();
    return { day: g.state.day, age: g.state.player.age };
  });
  check('age: +1 after a full year', ageCheck.day === 13 && ageCheck.age === 20, JSON.stringify(ageCheck));

  const lifeCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    for (const d of g.state.disciples) { d.assignment = 'rest'; d.injury = 0; d.mood = 60; }
    g.state.freeMode = true;
    g.state.day = 12;
    g.state.player.age = g.state.player.lifespan - 1;
    const r = g.endDay();
    return { age: g.state.player.age, rank: r.ending?.rank, title: r.ending?.title };
  });
  check('lifespan: death ends the run at lifespan', lifeCheck.age >= lifeCheck.age && lifeCheck.rank === 'lifespan' && !!lifeCheck.title, JSON.stringify(lifeCheck));

  // ── Balance: objectives persist until done; merits move the ending score ──
  const persistCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.state.freeMode = true;
    g.state.day = 5;
    g.state.dailyObjective = { id: 'herbs', metric: 'herbs', target: 9999, done: false };
    for (const d of g.state.disciples) { d.assignment = 'rest'; d.injury = 0; d.mood = 60; }
    g.endDay();
    const kept = g.state.dailyObjective?.id === 'herbs' && g.state.dailyObjective?.target === 9999;
    g.state.dailyObjective = { id: 'herbs', metric: 'herbs', target: 1, done: false };
    g.endDay();
    const rerolled = g.state.dailyObjective?.id !== 'herbs' || g.state.dailyObjective?.done === false;
    return { kept, rerolled };
  });
  check('balance: unmet objective persists, done one rerolls', persistCheck.kept && persistCheck.rerolled, JSON.stringify(persistCheck));

  const scoreCheck = await page.evaluate(() => {
    const g = window.__sect.game;
    g.reset();
    g.state.freeMode = true;
    g.state.day = 12;
    const base = (m) => {
      g.state.sectMerits = m;
      const r = g.choose('tournament', 'fight');
      return r.ending?.score;
    };
    g.state.pendingEvent = 'tournament';
    const low = base(0);
    g.state.pendingEvent = 'tournament'; g.state.ending = null;
    const high = base(120);
    g.state.ending = null;
    return { low, high };
  });
  check('balance: merits move ending score', (scoreCheck.high ?? 0) > (scoreCheck.low ?? 0), JSON.stringify(scoreCheck));

  // ── Combat stays under budget ────────────────────────────────────────────
  await page.evaluate(() => window.__sect.gameUi?.forceClose());
  await page.evaluate(() => window.__sect.combat.start());
  await page.waitForTimeout(450);
  const combat = await page.evaluate(() => ({
    active: window.__sect.combat.inCombat,
    calls: window.__sect.engine.info.render.calls,
    triangles: window.__sect.engine.info.render.triangles,
  }));
  check('combat: entered', combat.active);
  check('combat: draw calls under 300', combat.calls < 300, String(combat.calls));
  check('combat: triangles under 500k', combat.triangles < 500_000, String(combat.triangles));

  check('runtime: no page/console errors', errors.length === 0, errors.join(' | '));

  await browser.close();
} finally {
  server.kill();
}

for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed.`);
  process.exit(1);
}
console.log(`\nSmoke regression passed: ${checks.length} checks.`);
