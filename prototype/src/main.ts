import * as THREE from 'three';
import './style.css';
import { Engine } from './core/engine';
import { Input } from './core/input';
import { TouchControls } from './core/touch';
import { Ambience } from './core/audio';
import { buildTerrain } from './world/terrain';
import { SkySystem } from './world/sky';
import { buildMountains } from './world/mountains';
import { Clouds } from './world/clouds';
import { Vegetation } from './world/vegetation';
import { Sect } from './world/sect';
import { Regions } from './world/regions';
import { Particles } from './world/particles';
import { Player } from './characters/player';
import { Disciples } from './characters/npcs';
import { NamedDisciples } from './characters/named';
import { Hud } from './ui/hud';
import { CombatSystem } from './combat/combat';
import { CombatHud } from './combat/combat-hud';
import { Game } from './game/game';
import { GameUI } from './ui/game-ui';
import { MenuUI } from './ui/menu-ui';
import { RegionUI } from './ui/region-ui';
import { BuildingSystem } from './world/buildings';
import { BuildingUI } from './ui/building-ui';
import { SLOT_LABEL, type SlotId } from './game/saves';
import { regionById, type RegionId } from './game/scenes';
import { playerRealmName } from './game/state';

type Quality = 'high' | 'medium' | 'low';

const stage = document.getElementById('stage');
const fatalEl = document.getElementById('fatal');
const fatalText = document.getElementById('fatal-text');

function fatal(message: string): void {
  fatalEl?.classList.remove('is-hidden');
  if (fatalText) fatalText.textContent = message;
  document.getElementById('loading')?.classList.add('is-hidden');
}

if (!stage) {
  throw new Error('missing #stage');
}

const canvasProbe = document.createElement('canvas');
if (!canvasProbe.getContext('webgl2')) {
  fatal('当前浏览器未启用 WebGL2。请使用最新版 Chrome / Edge / Safari，并确认已开启硬件加速。');
}

const params = new URLSearchParams(window.location.search);
const demo = params.has('demo');
const shot = params.has('shot');
const fight = params.has('fight');
const storySkip = params.get('story') === '0';
const skipIntro = params.get('intro') === '0' || shot || fight;
const hourParam = params.get('t');

if (shot) document.body.classList.add('shot-mode');

window.addEventListener('error', (event) => {
  if (event.message) fatal(`运行时错误：${event.message}`);
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  fatal(`未处理的异常：${reason}`);
});

const hud = new Hud();
if (params.has('perf')) hud.togglePerf();
const autoQuality = params.get('auto') !== '0';
let engine: Engine;
try {
  engine = new Engine(stage);
} catch (err) {
  fatal(`渲染器初始化失败：${err instanceof Error ? err.message : String(err)}`);
  throw err;
}
engine.renderer.info.autoReset = false;

const input = new Input(engine.renderer.domElement);
const audio = new Ambience();

let started = false;
let introDone = false;
let timePaused = false;
let hour = hourParam ? Number.parseFloat(hourParam) : 17.35;
if (!Number.isFinite(hour)) hour = 17.35;
let quality: Quality = 'high';

let sky: SkySystem;
let clouds: Clouds;
let vegetation: Vegetation;
let sect: Sect;
let regions: Regions;
let particles: Particles;
let player: Player;
let disciples: Disciples;
let named: NamedDisciples;
let buildingSystem: BuildingSystem;
let buildingUI: BuildingUI | null = null;
let overviewMode = false;
let combat: CombatSystem;
let game: Game;
let gameUi: GameUI | null = null;
let menuUI: MenuUI | null = null;
let regionUI: RegionUI | null = null;
let touchControls: TouchControls | null = null;
let playSeconds = 0;
let combatHidden = false;

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      window.setTimeout(resolve, 0);
    });
  });

async function boot(): Promise<void> {
  hud.setProgress(0.05, '正在铺开山势…');
  await nextFrame();
  buildTerrain(engine.scene);

  hud.setProgress(0.18, '正在引云入谷…');
  await nextFrame();
  sky = new SkySystem(engine.scene, engine.renderer);
  buildMountains(engine.scene);
  clouds = new Clouds(engine.scene);

  hud.setProgress(0.34, '正在种松…');
  await nextFrame();
  vegetation = new Vegetation(engine.scene);

  hud.setProgress(0.55, '正在起山门…');
  await nextFrame();
  sect = new Sect(engine.scene);
  regions = new Regions(engine.scene, sect.colliders);

  hud.setProgress(0.7, '正在唤弟子…');
  await nextFrame();
  player = new Player(engine.scene, engine.camera, [vegetation.trees]);
  disciples = new Disciples(engine.scene);

  hud.setProgress(0.83, '正在铸试剑傀儡…');
  await nextFrame();
  const combatHud = new CombatHud(engine.camera);
  combat = new CombatSystem(engine.scene, input, player, combatHud, audio, (m, d) => hud.toast(m, d), (on) => {
    combatHidden = on;
    refreshWorldVisibility();
  });

  game = new Game(params.has('fresh'));
  named = new NamedDisciples(engine.scene, game.state.disciples, sect.colliders);
  buildingSystem = new BuildingSystem(engine.scene, sect.colliders, game.state);
  gameUi = new GameUI(game, {
    onDayAdvanced: (day) => {
      hour = 7;
      timePaused = false;
      hud.toast(`第 ${day} 日 · 晨`, 2200);
      named.sync(game.state.disciples);
      buildingSystem?.refresh(game.state);
      syncGameHud();
    },
    onTrial: () => {
      player.teleport(0, 10.5);
      combat.start();
    },
    onTribulation: (method) => {
      player.teleport(0, 10.5);
      const base = method === 'sword' ? 1.2 : method === 'pill' ? 1.28 : 1.35;
      const talisman = game.faithBoonLevel('talisman') * 0.05; // 渡劫护符
      const tassel = game.state.player.artifacts.includes('demon_tassel') ? 0.04 : 0; // 破煞剑穗
      combat.start({ boss: true, bossScale: Math.max(1.0, base - talisman - tassel) });
    },
    onToast: (message) => hud.toast(message),
    onStateChange: () => {
      named.sync(game.state.disciples);
      buildingSystem?.refresh(game.state);
      buildingUI?.render();
      syncGameHud();
    },
  });
  combat.onVictory = () => {
    if (game.state.pendingTribulation) {
      const r = game.resolveTribulation(true);
      hud.toast(r.success ? `渡劫成功 · 入${r.realm}` : r.text, 3200);
      gameUi?.sync();
    } else {
      const message = game.onTrialWin();
      hud.toast(message, 2600);
      gameUi?.sync();
    }
  };
  combat.onDefeat = () => {
    if (game.state.pendingTribulation) {
      const r = game.resolveTribulation(false);
      hud.toast(r.success ? r.text : '渡劫失败 · 修为跌回，道心受损', 3200);
      gameUi?.sync();
    }
  };
  combat.onForfeit = () => {
    const message = game.cancelTribulation();
    if (message) hud.toast(message, 2400);
    gameUi?.sync();
  };

  buildingUI = new BuildingUI(game, {
    onToast: (message) => hud.toast(message),
    onChanged: () => {
      buildingSystem.refresh(game.state);
      syncGameHud();
    },
  });

  regionUI = new RegionUI({
    onTravel: (id) => travelToRegion(id),
  });

  menuUI = new MenuUI(game, {
    onStartContinue: () => {
      if (!game.loadLatest()) return;
      playSeconds = game.playSeconds;
      startGame();
    },
    onStartNew: () => {
      game.reset();
      playSeconds = 0;
      startGame();
    },
    onLoadSlot: (slot) => {
      const wasStarted = started;
      if (!game.loadSlot(slot)) {
        hud.toast('载入失败');
        return;
      }
      playSeconds = game.playSeconds;
      if (!wasStarted) {
        startGame();
      } else {
        applyLoadedSlot(slot);
      }
    },
    onSaveSlot: (slot) => {
      game.saveTo(slot);
      hud.toast(`已保存至${SLOT_LABEL[slot]}`, 2200);
    },
    onDeleteSlot: (slot) => {
      game.deleteSlot(slot);
      hud.toast(`已删除${SLOT_LABEL[slot]}`, 1800);
    },
    onTitleBack: () => {
      window.location.reload();
    },
    onQuality: () => cycleQuality(),
    onAudio: () => toggleAudio(),
    onToast: (message) => hud.toast(message),
  });

  touchControls = new TouchControls(
    input,
    {
      onInteract: () => {
        tryInteract();
      },
      onCombat: (code) => combat.handleKey(code),
    },
    engine.renderer.domElement,
  );

  hud.setProgress(0.9, '正在点灯…');
  await nextFrame();
  particles = new Particles(engine.scene);

  quality = game.getSettings().quality;
  applyQuality(quality);
  audio.setMuted(game.getSettings().muted);
  hud.setAudio(game.getSettings().muted);
  menuUI?.updateSettings();

  sky.update(hour, 0, player.position);

  hud.setProgress(0.96, '正在点亮灯火…');
  await nextFrame();
  // Warm the shader cache under the loading screen instead of on the first frame.
  engine.renderer.compile(engine.scene, engine.camera);
  engine.render(0.016);

  hud.setProgress(1, '山门已开');
  hud.ready();

  if (demo) startGame();
  await nextFrame();

  (window as unknown as { __sect: unknown }).__sect = {
    player,
    engine,
    disciples,
    sect,
    input,
    sky,
    combat,
    game,
    gameUi,
    named,
    regions,
    regionUI,
    buildingSystem,
    buildingUI,
    getHour: () => hour,
    isOverview: () => overviewMode,
    getFrame: () => frameCount,
  };
}

function syncGameHud(): void {
  if (!game) return;
  hud.setGameInfo(
    game.state.day,
    game.state.maxDay,
    game.state.resources,
    Boolean(game.state.ending),
    game.state.freeMode,
    game.state.actionPoints,
    game.objectiveDesc(),
    game.maxActionPoints,
  );
  const p = game.state.player;
  hud.setPlayerCultivation(playerRealmName(p.realmIndex), p.cultivation, p.bottleneck);
  player?.setMaxQi(p.qiMax, false);
}

function refreshWorldVisibility(): void {
  const sectVisible = regions?.current === 'sect' && !combatHidden;
  disciples?.setVisible(sectVisible);
  named?.setVisible(sectVisible);
  buildingSystem?.setVisible(sectVisible);
}

function travelToRegion(id: RegionId): void {
  if (!started || combat.inCombat || game.state.ending) return;
  if (gameUi?.isBlocking || menuUI?.isBlocking) return;
  if (regions.current === id) {
    regionUI?.close();
    return;
  }
  game.travel(id);
  regions.enter(id, player);
  hour = (hour + 2) % 24;
  hud.setTime(hour);
  regionUI?.close();
  combatHidden = false;
  refreshWorldVisibility();
  hud.setRegion(regionById(id).name);
  hud.setTime(hour);
  syncGameHud();
  hud.setWorldPrompt(null);
  hud.toast(`来到${regionById(id).name} · 路上用了两个时辰`, 2600);
}

function applyLoadedSlot(slot: SlotId): void {
  player.restore();
  player.setMaxQi(game.state.player.qiMax, true);
  regions.enter(game.state.region, player);
  combatHidden = false;
  refreshWorldVisibility();
  named.sync(game.state.disciples);
  buildingSystem.refresh(game.state);
  buildingUI?.close();
  buildingUI?.setOverviewList(false);
  overviewMode = false;
  hud.setOverview(false);
  hour = 7;
  timePaused = false;
  menuUI?.closeAll();
  gameUi?.forceClose();
  syncGameHud();
  hud.setTime(hour);
  hud.setWorldPrompt(null);
  hud.setCombatHints(false);
  hud.setLetterbox(false);
  hud.setRegion(regionById(game.state.region).name);
  playSeconds = game.playSeconds;
  hud.toast(`已载入${SLOT_LABEL[slot]}`, 2200);

  if (game.ending) {
    gameUi?.showEnding(game.ending);
  } else if (game.prologuePending) {
    gameUi?.showPrologue();
  } else if (gameUi?.showDailyFlow()) {
    // candidates or an old pending event
  } else {
    gameUi?.openPanel();
  }
}

function cycleQuality(): void {
  const next: Quality = quality === 'high' ? 'medium' : quality === 'medium' ? 'low' : 'high';
  applyQuality(next);
  game?.setSettings({ quality: next });
  menuUI?.updateSettings();
  hud.toast(`画质 · ${next === 'high' ? '高' : next === 'medium' ? '中' : '低'}`);
}

function toggleAudio(): void {
  const muted = audio.toggle();
  game?.setSettings({ muted });
  hud.setAudio(muted);
  menuUI?.updateSettings();
}

function startGame(): void {
  if (started) return;
  started = true;
  playSeconds = game.playSeconds;
  menuUI?.closeAll();

  hud.hideStart();
  hud.hideLoading();
  hud.showHud();
  const uiFirst = !fight && Boolean(game.prologuePending || game.state.pendingEvent || game.state.ending || game.isLoaded || params.has('panel'));
  const noIntro = skipIntro || uiFirst || params.has('panel');
  hud.setLetterbox(!noIntro);
  hud.setQuality(quality);
  audio.start();
  audio.setMuted(game.getSettings().muted);
  hud.setAudio(audio.isMuted);

  if (noIntro) {
    player.skipIntro();
    player.update(0.016, input, sect.colliders, false);
    introDone = true;
    input.setEnabled(true);
    if (fight) {
      player.teleport(0, 10.5);
      combat.start();
    }
  } else {
    player.beginIntro();
    input.setEnabled(false);
  }

  if (fight) {
    game.state.region = 'sect';
    regions.current = 'sect';
  } else if (noIntro) {
    regions.enter(game.state.region, player);
  } else {
    regions.current = game.state.region;
  }
  refreshWorldVisibility();
  buildingSystem.refresh(game.state);
  hud.setRegion(regionById(game.state.region).name);
  hud.setOverview(false);
  buildingUI?.setOverviewList(false);

  player.setMaxQi(game.state.player.qiMax, true);
  hud.setTime(hour);
  hud.setCombatHints(false);
  hud.setWorldPrompt(null);
  syncGameHud();
  hud.toast(noIntro ? '青云山 · 黄昏' : '青云山 · 天元三百一十二年', 2600);

  if (!fight) {
    if (game.isLoaded) hour = 7;
    if (game.state.ending) {
      gameUi?.showEnding(game.state.ending);
    } else if (game.prologuePending && !storySkip) {
      gameUi?.showPrologue();
    } else if (gameUi?.showDailyFlow()) {
      // candidates or an old pending event
    } else if ((game.isLoaded && !storySkip) || params.has('panel')) {
      gameUi?.openPanel();
    }
  }
}

function finishIntro(): void {
  introDone = true;
  input.setEnabled(true);
  hud.setLetterbox(false);
  hud.toast(input.touch ? '左摇杆行走 · 右屏环视 · 双指缩放' : 'WASD 行走 · 拖拽环视 · 1-4 观时', 3200);
}

function applyQuality(q: Quality): void {
  quality = q;
  vegetation.setQuality(q);
  disciples.setQuality(q);
  sky.setShadowQuality(2048);
  engine.bloom.enabled = q !== 'low';
  engine.bloom.strength = q === 'high' ? 0.36 : q === 'medium' ? 0.24 : 0;
  hud.setQuality(q);
}

hud.onStart = (): void => {
  if (started) return;
  hud.hideStart();
  hud.hideLoading();
  hud.setLetterbox(false);
  audio.start();
  audio.setMuted(game.getSettings().muted);
  hud.setAudio(audio.isMuted);
  menuUI?.openTitle();
};
hud.onQuality = (): void => cycleQuality();
hud.onAudio = (): void => toggleAudio();
hud.onSect = (): void => {
  if (!started || player.introActive) return;
  if (combat.inCombat) {
    hud.toast('斗法中无法打开宗门簿');
    return;
  }
  gameUi?.toggle();
};
hud.onMap = (): void => {
  if (!started || combat.inCombat || player.introActive) return;
  if (gameUi?.isBlocking || menuUI?.isBlocking || buildingUI?.isBlocking) return;
  regionUI?.toggle(game.state.region, game.state.regionActions);
};
hud.onOverview = (): void => toggleOverview();

function toggleOverview(): void {
  if (!started || combat.inCombat || player.introActive) return;
  if (gameUi?.isBlocking || menuUI?.isBlocking || regionUI?.isBlocking || buildingUI?.isBlocking) return;
  overviewMode = !overviewMode;
  hud.setOverview(overviewMode);
  buildingUI?.setOverviewList(overviewMode);
  hud.toast(overviewMode ? '俯瞰 · 点击建筑查看' : '返回行走', 2000);
}

/** World interaction (talk / region action) — shared by the F key and the touch button. */
function tryInteract(): boolean {
  if (!started || combat.inCombat || player.introActive || hud.helpOpen) return false;
  if (gameUi?.isBlocking || menuUI?.isBlocking || regionUI?.isBlocking || buildingUI?.isBlocking) return false;
  if (regions.current === 'sect') {
    const near = named?.nearest(player.position, 3.6);
    if (near) {
      gameUi?.showDialogue(near.id);
      return true;
    }
  } else {
    const action = regions.nearestAction(player.position, 3.8);
    if (action) {
      if (action.id === 'market') {
        hour = (hour + 4) % 24;
        hud.setTime(hour);
        gameUi?.showMarket();
      } else {
        const result = game.regionAction(action.id);
        if (!result.ok) {
          hud.toast(result.text, 2400);
        } else {
          hour = (hour + 4) % 24;
          hud.setTime(hour);
          gameUi?.showRegionResult(result.title, result.text);
        }
      }
      return true;
    }
  }
  return false;
}

let pointerStartX = 0;
let pointerStartY = 0;
const buildingRay = new THREE.Raycaster();
const ndc = new THREE.Vector2();

engine.renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  if (started && player.introActive) player.skipIntro();
});

engine.renderer.domElement.addEventListener('pointerup', (event) => {
  if (!started || !introDone || combat.inCombat || player.introActive) return;
  if (gameUi?.isBlocking || menuUI?.isBlocking || regionUI?.isBlocking || buildingUI?.isBlocking) return;
  if (Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) > 6) return;
  if (regions.current !== 'sect') return;
  const rect = engine.renderer.domElement.getBoundingClientRect();
  ndc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  buildingRay.setFromCamera(ndc, engine.camera);
  const id = buildingSystem.pick(buildingRay);
  if (id) {
    buildingUI?.open(id);
    hud.setWorldPrompt(null);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'F1') {
    e.preventDefault();
    hud.togglePerf();
    return;
  }
  if (e.code === 'Escape') {
    if (buildingUI?.handleEscape()) return;
    if (gameUi?.handleEscape()) return;
    if (hud.helpOpen) {
      hud.closeHelp();
      return;
    }
    if (menuUI?.handleEscape()) return;
    if (regionUI?.handleEscape()) return;
    if (overviewMode) {
      overviewMode = false;
      hud.setOverview(false);
      buildingUI?.setOverviewList(false);
      return;
    }
    if (!started) return;
    if (gameUi?.isBlocking) return;
    if (combat.inCombat) {
      hud.toast('斗法中无法暂停');
      return;
    }
    menuUI?.openPause();
    return;
  }
  if (!started) return;

  if (e.code === 'KeyC' && !combat.inCombat && !gameUi?.isBlocking && !menuUI?.isBlocking && !regionUI?.isBlocking) {
    toggleOverview();
    return;
  }

  if (e.code === 'KeyV' && !combat.inCombat && !gameUi?.isBlocking && !menuUI?.isBlocking) {
    regionUI?.toggle(game.state.region, game.state.regionActions);
    return;
  }

  if (gameUi?.isBlocking || menuUI?.isBlocking || regionUI?.isBlocking || buildingUI?.isBlocking) return;

  if (e.code === 'KeyB' && !combat.inCombat) {
    gameUi?.toggle();
    return;
  }

  if (e.code === 'KeyH') hud.toggleUi();
  if (e.code === 'KeyM') toggleAudio();
  if (e.code === 'KeyT') {
    timePaused = !timePaused;
    hud.toast(timePaused ? '时间已暂停' : '时间继续');
  }
  if (e.code === 'Digit1') { hour = 6.2; hud.toast('晨'); }
  if (e.code === 'Digit2') { hour = 12; hud.toast('午'); }
  if (e.code === 'Digit3') { hour = 17.35; hud.toast('暮'); }
  if (e.code === 'Digit4') { hour = 21; hud.toast('夜'); }

  if (player.introActive && (e.code === 'Space' || e.code === 'Enter')) {
    player.skipIntro();
  }

  if (e.code === 'KeyF' && !combat.inCombat && !hud.helpOpen) {
    if (tryInteract()) return;
  }

  if ((e.code === 'Tab' || e.code === 'KeyQ' || e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'KeyR') && !hud.helpOpen) {
    if (e.code === 'Tab') e.preventDefault();
    combat.handleKey(e.code);
  }
});

let last = performance.now();
let elapsed = 0;
let frames = 0;
let fpsAccum = 0;
let fps = 60;
let frameMs = 16.6;
let hudAccum = 0;
let markerAccum = 0;
let autoCheck = 0;
let frameCount = 0;

function loop(now: number): void {
  frameCount++;
  const rawDt = (now - last) / 1000;
  const dt = Math.min(rawDt, 0.05);
  last = now;
  elapsed += dt;

  const helpOpen = hud.helpOpen;
  const uiBlocking = (gameUi?.isBlocking ?? false) || (menuUI?.isBlocking ?? false) || (regionUI?.isBlocking ?? false) || (buildingUI?.isBlocking ?? false);
  const allowControl = started && introDone && !helpOpen && !uiBlocking && !overviewMode;
  input.setEnabled(allowControl);

  if (started && !timePaused && !uiBlocking) {
    hour = (hour + dt / 60) % 24;
  }

  if (started) {
    const paused = helpOpen || uiBlocking;
    if (!paused) {
      playSeconds += dt;
      game.playSeconds = playSeconds;
    }
    combat.beforeUpdate(paused ? 0 : rawDt, allowControl);
    const simDt = paused ? 0 : dt * combat.timeScale;
    player.update(simDt, input, sect.colliders, allowControl);
    if (overviewMode) {
      engine.camera.position.set(0, 62, 70);
      engine.camera.lookAt(0, 2, -18);
      engine.camera.fov = 55;
      engine.camera.updateProjectionMatrix();
    }
    combat.afterUpdate(simDt);
    regions.update(paused ? 0 : dt, elapsed);
    named.update(paused ? 0 : dt, elapsed, player.position);
    let prompt: string | null = null;
    if (!paused && !combat.inCombat && introDone && !overviewMode) {
      if (regions.current === 'sect') {
        const near = named.nearest(player.position, 3.6);
        if (near) prompt = `与 <b>${near.name}</b> 交谈`;
      } else {
        const action = regions.nearestAction(player.position, 3.8);
        if (action) {
          prompt = game.state.regionActions.includes(action.id)
            ? `<b>${action.label}</b> · 今日已做`
            : `<b>${action.label}</b> · ${action.description}`;
        }
      }
    }
    hud.setWorldPrompt(prompt);
    hud.setCombatHints(combat.inCombat);
    touchControls?.setInteract(prompt);
    touchControls?.setCombat(combat.inCombat);
    touchControls?.setBlocked(uiBlocking || helpOpen);
    document.documentElement.classList.toggle('is-combat', combat.inCombat);

    if (!player.introActive && !introDone) {
      finishIntro();
    }

    sky.update(hour, dt, player.position);
    clouds.update(dt, elapsed);
    vegetation.update(elapsed);
    disciples.update(dt, [...named.obstacles(player.position), ...buildingSystem.obstacles()]);
    particles.update(dt, elapsed, player.position, sky.night);
    sect.update(sky.night, elapsed);
    audio.update(dt, sky.night);
  } else {
    sky.update(hour, dt, new THREE.Vector3(0, 0, -18));
    clouds.update(dt, elapsed);
    vegetation.update(elapsed);
  }

  if (shot) {
    engine.camera.fov = 46;
    engine.camera.updateProjectionMatrix();
    engine.camera.position.set(-24, 14, 36);
    engine.camera.lookAt(0, 7, -38);
  }

  engine.renderer.info.reset();
  engine.render(dt);

  frames++;
  fpsAccum += rawDt;
  frameMs = frameMs * 0.92 + rawDt * 1000 * 0.08;

  if (fpsAccum >= 0.5) {
    fps = frames / fpsAccum;
    frames = 0;
    fpsAccum = 0;
  }

  markerAccum += dt;
  if (markerAccum > 0.1) {
    markerAccum = 0;
    const markerVisible =
      started &&
      introDone &&
      regions.current === 'sect' &&
      !uiBlocking &&
      !combat.inCombat &&
      !player.introActive;
    buildingUI?.updateMarkers(engine.camera, overviewMode, markerVisible);
  }

  hudAccum += dt;
  if (hudAccum > 0.25) {
    hudAccum = 0;
    hud.setTime(hour);
    syncGameHud();
    hud.setPerf({
      fps,
      ms: frameMs,
      calls: engine.info.render.calls,
      tris: engine.info.render.triangles,
      quality,
    });
  }

  if (autoQuality && started && introDone) {
    autoCheck += dt;
    if (autoCheck > 2.5) {
      autoCheck = 0;
      if (fps < 32 && quality !== 'low') {
        applyQuality(quality === 'high' ? 'medium' : 'low');
        hud.toast('帧率偏低 · 已自动降低画质', 3000);
      } else if (fps < 44 && quality === 'high') {
        applyQuality('medium');
        hud.toast('帧率偏低 · 已自动降低画质', 3000);
      }
    }
  }

  requestAnimationFrame(loop);
}

boot()
  .then(() => {
    requestAnimationFrame(loop);
  })
  .catch((err: unknown) => {
    fatal(`世界生成失败：${err instanceof Error ? err.message : String(err)}`);
    console.error(err);
  });
