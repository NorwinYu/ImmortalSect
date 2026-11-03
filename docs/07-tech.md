# 07 · 技术架构（three.js / 纯 Web）

> 目标：在浏览器里稳定跑出「山门 + 200 修士 + 体积雾 + 电影感」。
> 原则：**能降级、能测量、能替换**。任何单点技术都不许绑死项目。

---

## 7.1 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 渲染 | **three.js**（`WebGPURenderer` 优先，`WebGLRenderer` 回退） | 生态最大、TSL 可写自定义材质、可控 |
| 语言 | TypeScript（strict） | 大型项目必需 |
| 构建 | Vite + pnpm workspace | 快、ESM、易分包 |
| UI | React + Zustand | 复杂面板/关系图/事件 UI |
| 物理 | Rapier（WASM） | 性能好、Rust 生态、角色控制器可用 |
| ECS | 自研 SoA + 可选 bitecs | 模拟数据导向，避免 GC |
| 动画 | three `AnimationMixer` + 自定义 IK/VAT | 英雄全骨骼，群像 VAT |
| 音频 | Web Audio API（自研总线） | 空间音、动态音乐、无第三方依赖 |
| 数据 | JSON/TS + zod | 编译期校验、可热更 |
| 存档 | IndexedDB + gzip | 大存档、离线 |
| 测试 | Vitest + Playwright | 逻辑单测 + 端到端 |
| 监控 | 自研 Frame Graph + stats.js | 性能预算可视化 |

> 不选 Babylon/PlayCanvas 的原因：three.js 的 TSL/WebGPU 路线更贴近「自定义渲染」，且社区资产/人才最多。代价是要自己搭更多基础设施。

---

## 7.2 架构分层

```
┌──────────────────────────────────────────────────────┐
│ apps/web        React Shell · 路由 · 加载 · 设置      │
├──────────────────────────────────────────────────────┤
│ packages/engine  渲染 · 输入 · 相机 · 音频 · 资源      │
│   ├─ render/     WebGPU/WebGL 抽象、材质、后处理       │
│   ├─ scene/      地形、天气、植被、流式加载            │
│   └─ input/      键鼠/手柄、镜头控制                   │
├──────────────────────────────────────────────────────┤
│ packages/sim     ECS · 世界状态 · AI · 战斗 · 经济     │
│   ├─ world/      实体、组件、系统、调度                │
│   ├─ ai/         Utility/GOAP/HTN/BT、导演             │
│   └─ rules/      修炼、战斗、宗门、事件                │
├──────────────────────────────────────────────────────┤
│ packages/content 数据表 · Schema · 本地化 · 平衡参数   │
├──────────────────────────────────────────────────────┤
│ packages/tools   资产管线 · 编辑器 · 平衡模拟器        │
└──────────────────────────────────────────────────────┘
```

**依赖方向**：`web → engine/sim/content`；`engine` 不依赖 `sim`；`sim` 不依赖 three.js（可在 Node 里跑测试）。

---

## 7.3 渲染管线

### 后端选择

```ts
const useWebGPU = !!navigator.gpu && !isForcedWebGL;
const renderer = useWebGPU
  ? new WebGPURenderer({ antialias: true, alpha: false })
  : new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
```

- WebGPU：TAA、计算着色器（粒子/草）、更好的后处理。
- WebGL2：FXAA、简化后处理、减少实例数。
- **同一套 TSL 材质**尽量双后端；不支持的节点走 fallback 材质。
- 启动时跑 3 秒 benchmark，自动选画质档。

### 每帧顺序

```
输入 → 相机 → 视锥/遮挡剔除 → 阴影 → 不透明 → 天空/雾
→ 透明 → 粒子 → 后处理 → UI
```

### 关键特性

| 特性 | 方案 | 预算 |
|------|------|------|
| PBR | MeshStandardMaterial / TSL PBR | 基础 |
| 大气 | 自定义 sky shader（Preetham/Hosek 简化） | 0.3 ms |
| 体积雾 | 屏幕空间 raymarch（半分辨率） | 0.8 ms |
| 云 | 2D 层云 + 近处 raymarch | 0.5 ms |
| 水 | 平面反射（小水面）+ 法线/泡沫 | 0.4 ms |
| 阴影 | 1 张 2048 CSM（2 级）+ NPC blob shadow | 1.2 ms |
| 后处理 | Bloom + ACES + LUT + 暗角 + FXAA/TAA | 1.0 ms |
| 粒子 | GPU instancing + 软粒子 | 0.6 ms |

> 所有「重」特性都有**画质档**：高/中/低/极低，自动降级优先保帧率。

### 材质与风格化

- 角色/建筑：PBR + 手绘风贴图 + 边缘光（fresnel）。
- 远景：渐变 + 雾 + 剪影，减少细节。
- 法术：Unlit + 噪声 + 叠加混合，避免过曝。
- 统一 LUT：所有场景过同一张调色 LUT，保证「同一款游戏」。

---

## 7.4 性能预算与降级

### 帧预算（16.6 ms，60fps）

| 项 | 预算 |
|----|------|
| 渲染 | 9.0 ms |
| 模拟（Worker，主线程仅同步快照） | 0.5 ms |
| 动画/骨骼更新 | 1.5 ms |
| UI | 1.0 ms |
| 音频 | 0.5 ms |
| 余量 | 4.1 ms |

### 降级顺序（自动）

1. 关闭体积雾/云 raymarch。
2. 降低阴影分辨率/级数。
3. 降低后处理（关 TAA/SSAO）。
4. 减少同屏 NPC（LOD/剔除）。
5. 降低渲染分辨率（0.75x → 0.5x）。
6. 降到 30fps 目标。

> 降级必须**平滑**（不闪屏），且 UI 提示「已自动调整画质」。

### 关键指标

- Draw calls：主场景 < 300，宗门战 < 800。
- 三角面：< 3M（独显）/ 1.2M（核显）。
- 纹理：< 1.5 GB 显存；流式加载，超出预算卸载。
- Shader 编译：启动预编译常见材质，避免首战卡顿。

---

## 7.5 大规模角色

### 三档角色

| 档 | 三角面 | 骨骼 | 纹理 | 用途 |
|----|--------|------|------|------|
| 英雄 | 4-8 万 | 60-100 | 2K | 掌门/长老/Boss |
| 精模 | 1-2 万 | 30-50 | 1K | 真传/近处弟子 |
| 群像 | 2-5 千 | 15-30 | 512 | 远处弟子/宗门战 |

### 渲染方式

- **英雄**：`SkinnedMesh` + `AnimationMixer`，全骨骼。
- **群像（近）**：`InstancedMesh` + 自定义 GPU skinning（或 `BatchedMesh`）。
- **群像（远）**：VAT（顶点动画贴图）或 Impostor（8 方向 billboard）。
- **宗门战**：编队级 LOD，远处整队用一张 Instanced 网格。

> three.js 原生 `InstancedMesh` 不直接支持骨骼动画；需要自定义 shader 或 VAT。这是 G1 技术验证的重点之一。

### 动画

- 英雄：状态机 + 混合树（idle/walk/run/attack/hit/death），上半身/下半身分层。
- IK：脚部贴地、手部持物（法宝/剑）。
- 群像：共享动画片段，随机相位偏移，避免「广播体操」。
- 根运动：英雄用 root motion；群像用位移驱动。

---

## 7.6 地形、植被与流式加载

### 地形

- 高度图 1024×1024，四层 splat（草/岩/土/雪）。
- Clipmap 4 环，近处 1m 精度，远处 16m。
- 法线贴图 + 细节贴图；远处用低模 + 雾。
- 山门区域手工雕刻，外部程序化。

### 植被

- 分 cell（64m）管理；每 cell 预生成 instance 列表。
- 3 级 LOD：全模 / 简模 / billboard。
- 风：顶点着色器 + 全局风向/强度。
- 交互：角色经过时草被压弯（GPU 或 CPU 局部）。

### 流式

- 玩家周围 3×3 cell 常驻；预取 5×5。
- 资源按需加载（GLTF/KTX2），LRU 卸载。
- 加载不阻塞主线程：`fetch` + `createImageBitmap` + Worker 解码。
- 过场用「雾/云海」遮住加载。

---

## 7.7 物理与角色控制

- **Rapier**：刚体/碰撞/射线；角色用 capsule + 自定义移动（不用动力学角色）。
- 移动：加速度/摩擦/重力/斜坡/台阶；空中控制受限。
- 战斗：hitbox 用球/胶囊 + 帧数据，不用物理引擎（可预测、可调）。
- 布娃娃：仅 Boss/处决，限制数量。
- 200 NPC 不做完整物理：只用导航网格 + 简单避障。

---

## 7.8 模拟 Worker

```
Main Thread                     Sim Worker
  │  input/commands  ──────────→  │
  │                              │  fixed 20Hz tick
  │  ←──────────  snapshot (SAB) │
  │  interpolate + render        │
```

- `SharedArrayBuffer` 需要 COOP/COEP 头；静态托管要配置。
- 无 SAB 时回退 `postMessage`（结构化克隆，降频到 10Hz）。
- 双缓冲：worker 写 A，主线程读 B，`Atomics` 交换。
- 快照只含「渲染需要」的字段（位置/朝向/动画状态/血量），不含 AI 内部状态。
- 主线程保留 100ms 插值缓冲，避免抖动。

---

## 7.9 数据驱动与内容管线

- 所有数值/文案/事件在 `packages/content`，JSON + zod schema。
- 构建时校验：引用完整性、数值范围、本地化 key。
- 开发时热重载；发布时打包成二进制/压缩 JSON。
- 平衡模拟器：Node 里跑 10,000 场战斗/100 年模拟，输出 CSV。
- 事件编辑器（后期）：可视化编辑事件树，导出 JSON。

---

## 7.10 存档

- IndexedDB（`idb` 封装），分槽位。
- 内容：世界状态 + 弟子 + 建筑 + 关系 + 事件旗标 + 统计。
- 压缩：`CompressionStream('gzip')`。
- 版本迁移：`migrations: Record<version, (save) => save>`。
- 自动存档：每季/重大事件后；手动存档 3 槽 + 快速存档。
- 导出/导入：JSON 文件，便于测试与社区分享。
- 云存档：后期，可选。

> 存档兼容是长期运营的命门：**每个版本都要能读旧档**，否则玩家流失。

---

## 7.11 音频

- Web Audio API：总线（music/sfx/ambience/voice）→ compressor → destination。
- 空间音：`PannerNode`（HRTF 可选），只对近处声源。
- 混响：`ConvolverNode`，按区域切换（山洞/大殿/室外）。
- 动态音乐：分层（基础/紧张/战斗/天劫），按张力交叉淡化。
- 环境：风声/鸟鸣/流水/钟声，按时间/天气变化。
- 性能：同时发声源 < 32；远处声源降级为 2D。

---

## 7.12 UI

- React 独立 root，覆盖在 canvas 上；`pointer-events` 精细控制。
- 不在每帧 re-render：用 Zustand selector + ref 更新数值。
- 复杂界面：关系图（Canvas/WebGL）、宗门志（虚拟列表）、事件卡（动画）。
- 字体：中文子集化（按章节加载），避免 10MB 字体。
- 设计：水墨/卷轴/印章，但保证可读性（对比度、字号）。

---

## 7.13 资产管线

```
Blender → glTF 2.0 → 优化（meshopt/draco） → KTX2 纹理
→ LOD 生成 → 动画压缩 → 资产清单 → CDN
```

- 命名规范：`chr_/env_/prop_/vfx_` + 变体。
- 纹理：BC7/ASTC（KTX2），2 的幂，mipmap。
- 模型：合并材质、减少 draw call；静态物件用 `BatchedMesh`。
- LOD：Blender 减面或 meshoptimizer；距离阈值按屏幕占比。
- 自动化：CI 检查单资产大小/面数，超标报警。
- 外包：提供 Blender 模板 + 导出脚本 + 验收清单。

---

## 7.14 工程与部署

- pnpm workspace；`apps/web` + `packages/*`。
- ESLint + Prettier + strict TS；提交前 hook。
- CI：typecheck → unit → build → bundle size → Playwright smoke。
- 部署：静态 CDN（Cloudflare Pages / Vercel / Netlify）。
- 必需响应头：

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

- 缓存：HTML 不缓存，assets 长缓存 + hash。
- 离线：Service Worker 缓存首包与常用资源。
- 监控：Sentry（错误）+ 自研性能上报（可选、匿名）。

---

## 7.15 测试

| 层 | 工具 | 内容 |
|----|------|------|
| 逻辑 | Vitest | 修炼/战斗/经济/事件规则 |
| 模拟 | Node 脚本 | 100 年世界模拟、10,000 场战斗 |
| 端到端 | Playwright | 启动、存档、关键流程 |
| 性能 | 自研 harness | 帧时间、draw calls、内存 |
| 视觉 | 截图对比 | 关键场景回归 |

---

## 7.16 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Safari WebGPU 不完善 | 部分用户无法高画质 | WebGL2 回退 + 画质档 |
| SAB 需要 COOP/COEP | 托管配置错误 → Worker 降级 | 构建时校验响应头；回退 postMessage |
| Shader 编译卡顿 | 首次战斗掉帧 | 预编译/预热、材质变体收敛 |
| 显存不足 | 崩溃/掉帧 | 纹理流式 + 预算 + 自动降级 |
| 长时间运行内存泄漏 | 越玩越卡 | 对象池、定期快照、泄漏检测 |
| three.js API 变动 | 升级成本 | 锁定版本、封装渲染层 |
| 移动端性能 | 无法覆盖 | 后置，先桌面 |

---

## 7.17 目录结构（目标）

```
ImmortalSect/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── game/          # 启动、循环、场景切换
│       │   ├── ui/            # React 面板
│       │   └── workers/       # sim worker 入口
│       └── public/
├── packages/
│   ├── engine/
│   │   ├── src/render/        # renderer、材质、后处理
│   │   ├── src/scene/         # 地形、天气、流式
│   │   ├── src/input/
│   │   └── src/audio/
│   ├── sim/
│   │   ├── src/ecs/
│   │   ├── src/ai/            # utility/goap/htn/bt/director
│   │   ├── src/rules/         # 修炼/战斗/宗门/事件
│   │   └── src/world/
│   ├── content/
│   │   ├── data/              # 建筑/功法/事件/弟子
│   │   └── schema/
│   └── tools/
│       ├── pipeline/          # 资产优化
│       └── balance/           # 模拟器
├── docs/
└── prototype/                 # G1 技术验证
```

---

## 7.18 一句话总结

> **渲染追 three.js 的上限，模拟守住 Worker 的预算，内容全部数据驱动，任何特性都能降级。**
