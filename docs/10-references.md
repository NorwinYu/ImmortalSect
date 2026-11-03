# 10 · 参考拆解与阅读清单

> 不是「玩过」，而是「拆过」。每个参考都要写清楚：**学什么、不学什么、怎么落地**。

---

## 10.1 顶级世界引擎：借思想，不借实现

| 引擎/技术 | 代表能力 | 我们借什么 | 我们不做什么 |
|-----------|----------|------------|--------------|
| **Unreal 5**（Nanite / Lumen / Niagara） | 虚拟化几何、全局光照、粒子 | 「自动 LOD + 几何预算」思想；Niagara 式粒子分层 | Web 端不做 Nanite/Lumen 级 GI |
| **Unity DOTS** | 数据导向、ECS、Burst | SoA、Archetype、批量系统调度 | 不引入完整 DOTS |
| **Frostbite** | 大规模破坏、流式 | 地形/资产分块流式 | 不做全破坏 |
| **Decima**（地平线） | 大气、云、地形、植被 | 大气散射、体积云、植被 LOD | 不做 4K 级资产 |
| **RAGE**（GTA/RDR） | 动画、细节密度、世界事件 | 细节道具密度、动态事件 | 不做无缝大城市 |
| **Snowdrop** | 动态天气、材质混合 | 天气系统、湿滑/积雪 | 不做全局材质混合 |
| **原神（Unity 定制）** | 风格化 + 移动端优化 | 卡通渲染、分区色彩、LOD | 不做抽卡/体力 |

### 落地映射

| 引擎思想 | 我们的实现 |
|----------|------------|
| 虚拟化几何 | 3 级 LOD + Impostor + 分块流式 |
| 全局光照 | 烘焙 lightmap + 屏幕空间 AO + 一盏主光 |
| 大规模粒子 | GPU Instancing + 软粒子 + 预算 |
| 数据导向 | TypedArray SoA + Worker |
| 动态天气 | 参数化天气状态机 + 材质参数 |

---

## 10.2 游戏拆解

| 作品 | 学什么 | 不学什么 |
|------|--------|----------|
| **Crusader Kings III** | 人物目标/关系/记忆、事件叙事、传承、地图模式 | UI 过载、DLC 堆叠、后期卡顿 |
| **RimWorld** | Storyteller、殖民地经营、涌现故事、模组 | 2D 俯视、战斗表现 |
| **Total War: Three Kingdoms** | 战役/战场双尺度、士气、武将 | 历史写实、回合制节奏 |
| **Genshin Impact** | 风格化渲染、元素反应、角色演出、移动优化 | 抽卡、体力、内容消耗 |
| **Ghost of Tsushima** | 引导风、极简 HUD、色彩分区、电影构图 | 纯动作、线性 |
| **Black Myth: Wukong** | 东方材质、Boss 演出、打击感 | 线性关卡、无经营 |
| **Elden Ring** | 探索感、地标引导、未知 | 高难度、弱叙事 |
| **鬼谷八荒** | 修仙成长、随机事件、Build | 2D 立绘、重复刷、数值膨胀 |
| **了不起的修仙模拟器** | 修仙经营、风水灵气、弟子生态 | 像素 2D、UI 门槛、引导 |
| **太吾绘卷** | 关系网、世代传承 | UI/引导、系统耦合 |
| **Slay the Spire** | 构筑、决策密度 | 纯卡牌、无世界 |
| **密教模拟器** | 叙事卡牌、氛围 | 纯文本、无 3D |
| **弈仙牌** | 修仙题材 + 构筑 | 纯卡牌 |

---

## 10.3 策略引擎 / AI 阅读

### 书

- *Game AI Pro* 系列（免费在线）：<http://www.gameaipro.com/>
- *Artificial Intelligence for Games*（Millington & Funge）
- *Programming Game AI by Example*（Buckland）
- *Designing Games*（Tynan Sylvester，RimWorld 作者）

### 论文/演讲

- **F.E.A.R. GOAP**：Jeff Orkin, “Three States and a Plan”.
- **Halo Utility AI**：Damián Isla, “Handling Complexity in the Halo 2 AI”.
- **Left 4 Dead AI Director**：Michael Booth, GDC 2009.
- **CK3 AI**：Paradox 开发日志（[中文翻译](https://www.bilibili.com/opus/698327730746294294)）。
- **RimWorld Storyteller**：Tynan Sylvester 的 GDC 分享与博客。

### 关键概念

| 概念 | 用途 | 本作落点 |
|------|------|----------|
| Utility AI | 多目标权衡 | 弟子日常 |
| GOAP | 长序列计划 | 复仇/阴谋 |
| HTN | 战略分解 | 门派战略 |
| Behavior Tree | 可读流程 | 战斗 |
| Sim LOD | 规模控制 | 世界模拟 |
| AI Director | 节奏 | 事件投放 |
| Blackboard | 共享状态 | 小队/Boss |
| Influence Map | 空间决策 | 宗门战/阵法 |

---

## 10.4 修仙文化与竞品

### 文化参考

- 还珠楼主《蜀山剑侠传》：仙侠世界观、剑仙、洞府。
- 忘语《凡人修仙传》：凡人流、资源驱动、谨慎生存。
- 辰东《遮天》：大帝、禁区、宏大叙事。
- 《山海经》：妖兽/地理/异闻。
- 道教内丹/经络/符箓：术语与仪式感（做简化，不做科普）。

### 竞品速览

| 作品 | 强项 | 短板 | 我们的差异 |
|------|------|------|------------|
| 鬼谷八荒 | 成长爽感、事件多 | 后期重复、2D | 3D 山门 + 经营深度 |
| 了不起的修仙模拟器 | 经营深度、风水 | 门槛高、2D | 3D 表现 + 引导 |
| 觅长生 | 叙事、选择 | 体量小 | 更大世界 + 战斗 |
| 太吾绘卷 | 关系/传承 | 系统复杂 | 更聚焦宗门 |
| 弈仙牌 | 构筑 | 无世界 | 经营 + 构筑 |
| 凡人修仙传（游戏） | IP | 商业化 | 原创世界观 |

> 差异点一句话：**「3D 山门 + 会自己运转的世界 + 可控掌门」**，目前没有直接竞品。

---

## 10.5 技术资料

### three.js / WebGPU

- three.js 文档：<https://threejs.org/docs/>
- three.js GitHub Wiki（TSL/WebGPU）：<https://github.com/mrdoob/three.js/wiki>
- WebGPU API（MDN）：<https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API>
- WebGPU 规范：<https://www.w3.org/TR/webgpu/>
- three.js WebGPU 渲染器社区文档：<https://three.ws/docs/webgpu-renderer>

### 性能与资产

- meshoptimizer：<https://github.com/zeux/meshoptimizer>
- KTX2 / Basis Universal：<https://github.com/KhronosGroup/KTX-Software>
- Draco：<https://github.com/google/draco>
- Rapier：<https://rapier.rs/docs/>
- bitecs：<https://github.com/NateTheGreatt/bitECS>

### 浏览器能力

- SharedArrayBuffer / COOP-COEP：<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer>
- Web Audio API：<https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API>
- IndexedDB：<https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API>
- Compression Streams：<https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API>

---

## 10.6 本套文档的参考来源

- 《了不起的修仙模拟器》评测（网易）：<https://play.163.com/article/148994>
- 《十字军之王 3》AI 开发日志（中文）：<https://www.bilibili.com/opus/698327730746294294>
- three.js WebGPU 渲染器文档：<https://three.ws/docs/webgpu-renderer>
- Game AI Pro：<http://www.gameaipro.com/>

> 外部资料仅作参考；所有设计决策以本项目文档与实测数据为准。

---

## 10.7 一页纸书单（按优先级）

1. *Designing Games* — 先想清楚「为什么好玩」。
2. *Game AI Pro*（选读 Utility/GOAP/HTN/Director 章节）。
3. three.js 官方示例（WebGPU/TSL/Instancing/LOD）。
4. *The Art of Game Design*（Schell）— 透镜清单。
5. 《千里江山图》/宋画选集 — 美术方向。
