# 05 · 世界模拟与 AI 策略引擎

> 这一章回答：**世界如何自己运转？NPC 如何做决定？故事从哪来？**
> 参考对象：CK3 的人物模拟、RimWorld 的 Storyteller、F.E.A.R. 的 GOAP、Halo 的 Utility AI、Left 4 Dead 的 AI Director。

---

## 5.1 目标与约束

| 目标 | 指标 |
|------|------|
| 世界可信 | 门派会自己结盟/开战/覆灭，不需要玩家触发 |
| 人物可信 | 弟子会根据自己的欲望/关系/性格行动 |
| 故事涌现 | 玩家能讲出「我没写过的故事」 |
| 性能可控 | 1000 名有名字的 NPC，模拟预算 ≤ 3 ms/帧 |
| 可调试 | 任何 NPC 的决策都能在 3 秒内解释清楚 |

**约束**：纯浏览器、单线程渲染 + Worker 模拟、不能依赖运行时 LLM（延迟/成本/不确定性）。

> 「1000 名有名字的 NPC」= L0-L2 的具名角色；L3 是抽象人口，不参与具名模拟。

---

## 5.2 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                        World State (SoA)                     │
│  entities · needs · relations · memories · factions · events │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
        ┌───────▼────────┐            ┌───────▼────────┐
        │  Perception    │            │   Director     │
        │  (每 5 tick)    │            │  (张力/事件)    │
        └───────┬────────┘            └───────┬────────┘
                │                             │
        ┌───────▼────────┐            ┌───────▼────────┐
        │  Decision      │            │  Event Queue   │
        │  Utility/GOAP  │            │  (剧本/模板)    │
        │  /HTN/BT       │            └───────┬────────┘
        └───────┬────────┘                    │
                │                             │
        ┌───────▼─────────────────────────────▼────────┐
        │              Action / Effect System           │
        │   move · work · fight · build · social · ...  │
        └───────┬───────────────────────────────────────┘
                │
        ┌───────▼────────┐
        │  Presentation  │  渲染插值 / 动画 / 演出 / UI
        └────────────────┘
```

**原则**：模拟与渲染彻底分离。模拟在 Worker 里以固定步长跑，渲染只读快照 + 插值。

---

## 5.3 分层模拟（Sim LOD）

不是所有 NPC 都值得每帧模拟。

| 层级 | 范围 | 更新频率 | 精度 | 数量上限 |
|------|------|----------|------|----------|
| **L0 活跃** | 当前场景/战斗 | 20 Hz | 全模拟（移动/战斗/动画） | 50 |
| **L1 区域** | 山门/附近地图 | 1 Hz | 简化（位置/任务/状态） | 300 |
| **L2 世界** | 其他门派/远方 | 1 游戏日 | 统计（资源/关系/计划） | 5,000 |
| **L3 背景** | 天下大势 | 1 游戏月 | 抽象（数字/事件） | 100,000 |

### 升降级规则

```
升级（L2→L1→L0）：
  - 玩家进入区域
  - 事件涉及该 NPC（被点名/被攻击/被拜访）
  - NPC 成为任务目标
降级（L0→L1→L2）：
  - 离开玩家视野 30 秒
  - 战斗结束
  - 任务完成
```

- 升级时「实体化」：从统计数据生成具体状态（位置、血量、装备）。
- 降级时「抽象化」：把具体状态压缩成统计值（修为、伤势、关系），**不能丢失重要记忆**。

> 关键：玩家回来后，NPC 不能「重置」。他应该记得你、记得上次的任务、伤还没好。

---

## 5.4 决策架构选型

没有银弹。不同场景用不同方案：

| 架构 | 适合 | 不适合 | 本作用途 |
|------|------|--------|----------|
| **FSM** | 简单状态、动画 | 复杂目标 | 门/机关/UI 状态 |
| **Behavior Tree** | 战斗、可控流程 | 开放式目标 | 战斗单位、Boss |
| **Utility AI** | 多目标权衡、日常 | 长序列计划 | 弟子日常、门派态度 |
| **GOAP** | 动态目标、长序列 | 实时性、调试 | 复仇/阴谋/个人目标 |
| **HTN** | 结构化战略、可读 | 高度动态 | 门派战略、宗门计划 |
| **ML/LLM** | 语言/生成 | 确定性/性能 | 离线内容生成（可选） |

### 分工

- **弟子**：Utility 选目标 → 小 GOAP 做计划 → BT 执行动作。
- **门派**：HTN 做战略 → 经济 solver 分配资源 → Utility 选具体行动。
- **Boss**：BT + 阶段状态机。
- **世界**：事件驱动 + 导演系统。

---

## 5.5 Utility AI：弟子今天做什么

### 公式

```
U(a) = Σ wᵢ · fᵢ(state) − risk(a) + ε
P(a) = exp(U(a)/τ) / Σⱼ exp(U(j)/τ)
```

- `fᵢ` 归一化到 0-1。
- `τ` 是「温度」：τ 小 → 总是选最优；τ 大 → 更随机、更像人。
- `ε` 是小噪声，避免所有弟子行为完全一致。

### 权重（示例）

| 维度 | 权重 | 说明 |
|------|------|------|
| 需求满足 | 0.35 | 修炼/休息/安全/社交 |
| 性格倾向 | 0.20 | 勤奋/懒散/痴情… |
| 关系 | 0.15 | 想见谁/躲谁 |
| 机会 | 0.20 | 秘境开了/丹药炼好了 |
| 长期目标 | 0.10 | 突破/复仇/夺权 |
| 风险 | 负项 | 受伤/死亡/道心 |

### 示例：弟子「林小满」

> 17 岁，木灵根 62，炼气七层，性格「勤奋 + 痴情」，暗恋师兄顾青，道心 62，寿元充足。

| 行动 | 需求 | 性格 | 关系 | 机会 | 长期 | 风险 | **U** |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 修炼 | 0.9 | 0.8 | 0 | 0.6 | 0.9 | 0 | **0.69** |
| 陪师兄采药 | 0.7 | 0.5 | 1.0 | 0.8 | 0.2 | -0.05 | **0.63** |
| 闭关冲境 | 0.5 | 0.9 | 0 | 0.3 | 1.0 | -0.15 | **0.37** |
| 下山历练 | 0.6 | 0.6 | 0.2 | 0.7 | 0.6 | -0.2 | **0.36** |
| 偷懒 | 0.8 | 0.2 | 0 | 0 | 0 | 0 | **0.32** |

→ 她大概率去修炼；但如果玩家把「陪师兄采药」设为目标，或师兄受伤，权重会翻转。

### 让 AI 像人的三个技巧

1. **惯性（hysteresis）**：当前行动 +0.12，避免反复横跳。
2. **软最大化**：用 softmax 而不是 argmax；弟子偶尔会「犯傻」。
3. **情绪修正**：道心低/受伤/恋爱时，权重整体偏移（不是简单加减）。

### 伪代码

```ts
function decide(agent: Agent, world: World): Action {
  const actions = getAvailableActions(agent, world);
  let best = null, bestScore = -Infinity;
  for (const a of actions) {
    let u = 0;
    for (const [key, w] of WEIGHTS) u += w * feature(key, agent, a, world);
    u -= risk(a, agent, world);
    u += a === agent.currentAction ? 0.12 : 0;
    u += noise(agent.id, world.tick) * 0.05;
    if (u > bestScore) { best = a; bestScore = u; }
  }
  return best ?? idle(agent);
}
```

> 每 5 tick 决策一次（L0），预算 0.02 ms/人。

---

## 5.6 GOAP：复仇计划

Utility 适合「现在做什么」，GOAP 适合「为了一个目标，分几步走」。

### 状态与动作

```
State: knows_enemy, power_gt_enemy, has_artifact, enemy_in_range, enemy_dead
Actions:
  investigate  pre: -                eff: knows_enemy        cost 1
  train        pre: knows_enemy      eff: power_gt_enemy     cost 3
  craft        pre: knows_enemy      eff: has_artifact       cost 2
  travel       pre: knows_enemy      eff: enemy_in_range     cost 1
  attack       pre: enemy_in_range & power_gt_enemy & has_artifact
                                     eff: enemy_dead         cost 1
  recover      pre: injured          eff: -injured           cost 1
```

### 计划

A* 搜索，启发式 = 未满足目标数。得到：

```
investigate → craft → train → train → travel → attack
```

### 什么时候重规划

- 世界状态变化（敌人变强/移动/死亡）。
- 计划执行失败（被拦截/受伤）。
- 每 30 天强制重规划一次（避免过时计划）。

> GOAP 只用于「有执念的 NPC」：复仇、夺权、寻宝、报恩。普通弟子用 Utility 就够了——全員 GOAP 是性能自杀。

---

## 5.7 HTN：门派战略

HTN 把「门派该干什么」拆成可读的层级任务。

```
Compound: ExpandSect
  Method A (power < threshold):
    → IncreasePower
        → TrainDisciples
        → RecruitDisciples
        → AcquireResources
  Method B (relations < 0):
    → ImproveDiplomacy
        → SendEnvoy
        → OfferMarriage
  Method C (power >= threshold & has border):
    → MilitaryCampaign
        → BuildArmy
        → DeclareWar
        → Siege
  Method D (weak enemy):
    → Vassalize
```

- 每个 Method 有**前提条件**和**代价**，选择用 Utility 打分。
- 原始任务（primitive）落到具体行动：训练、招募、送礼、出兵。
- HTN 计划是「可读的」：玩家可以通过情报系统看到「青云宗正在备战」。

> 门派 AI 的目标不是「赢」，而是「像一个人/组织那样行动」：有性格、有恐惧、有短期利益。

---

## 5.8 行为树：战斗

战斗单位用 BT，保证可预测、可调试、可打断。

```
Root (Selector)
├── Sequence: 濒死 → 逃跑/求饶
├── Sequence: 有目标 & 在射程 → 攻击循环
│   ├── 选择技能（Utility）
│   ├── 面向目标
│   └── 播放技能
├── Sequence: 有目标 & 不在射程 → 接近
└── Idle: 巡逻/警戒
```

- Boss 用「阶段状态机 + BT」：阶段切换时打断当前 BT，播放演出。
- 所有技能有 telegraph（前摇），保证可读。

---

## 5.9 记忆、关系与传闻

### 记忆

```
Memory {
  subjectId, eventType, valence (-1..1), intensity (0..1),
  tick, decay, witnessedBy[]
}
```

- 记忆按 `decay` 衰减；仇恨/恩情衰减慢。
- 弟子会「记住」：你救过他、你偏心、你杀了他师父。
- 记忆影响 Utility 的「关系」维度。

### 关系传播

```
A 对 B 的态度 = 直接关系 + Σ(间接路径 × 衰减)
```

- 最多 3 跳，防止全图强耦合。
- 用于：门派立场、弟子站队、传闻扩散。

### 传闻

- 事件 → 传闻（可失真）→ 传播（3 跳）→ 影响声望/态度。
- 玩家可以「辟谣/操纵舆论」，但需要证据/声望。
- 传闻是**低成本叙事**：一个弟子叛逃，三天后整个正道都在议论你的宗门。

---

## 5.10 导演系统（Drama Manager）

参考 Left 4 Dead 的 AI Director + RimWorld 的 Storyteller。

### 张力（Tension）

- 0-100，由近期事件、玩家实力、威胁等级计算。
- 每个章节有一条「目标张力曲线」：平静 → 铺垫 → 危机 → 高潮 → 释放。

### 事件卡

```
EventCard {
  id, tags, tensionDelta, weight, cooldown,
  preconditions, options, consequences
}
```

### 选择算法

```
score = w1 * fit(targetTension - currentTension)
      + w2 * variety(tags)
      + w3 * playerStateFit
      + w4 * random
```

### 硬规则

- 同一 tag 7 天内不重复。
- 高潮后 3 天「安静期」，只放低张力事件。
- 15 分钟无事件 → 强制放一个钩子。
- 连续两个高张力事件 → 禁止。
- 关键主线事件不受随机影响，按章节触发。

> 导演系统的目标不是「随机」，而是**节奏**。

---

## 5.11 世界模拟

### 灵气潮汐

```
A(t) = 1.0 + 0.4 * sin(2π * t / 100年) + 0.15 * noise(t)
```

- 影响修炼速度、妖兽强度、秘境开启。
- 玩家可以建「望星台」预报。

### 门派兴衰

每个门派（L2）每日结算：

```
power += 修炼产出 + 招募 - 战争损失 - 腐败
resources += 收入 - 支出
relations += 外交 - 冲突
```

- 门派有「目标」：扩张/自保/复仇/求道。
- 门派会主动发起：结盟、贸易、宣战、联姻、渗透。
- 门派可以被灭、被附庸、分裂。

### 秘境

- 按周期开启（灵气潮汐 + 随机）。
- 每次进入程序化重组（房间/敌人/宝物）。
- 有限时间，超时被困/关闭。

### 魔潮

- 每 30-50 年一次，魔道/妖兽大举入侵。
- 全图事件：所有门派被迫合作或灭亡。
- 是中期最大的「世界级危机」。

---

## 5.12 事件生成

### 模板 + 参数

```json
{
  "id": "disciple_betrayal",
  "tags": ["internal", "high_tension"],
  "trigger": {
    "minDay": 30,
    "requires": ["disciple.ambition > 70", "disciple.loyalty < 30"]
  },
  "roles": { "traitor": "disciple", "victim": "elder" },
  "options": [
    { "id": "execute", "effects": ["loyalty+10", "karma-50", "fear+20"] },
    { "id": "exile",   "effects": ["loyalty+5", "karma-10", "reputation-5"] },
    { "id": "forgive", "effects": ["loyalty-5", "karma+20", "mercy+1"] }
  ],
  "followUp": "revenge_arc"
}
```

- 角色由世界状态**绑定**（谁野心高、谁忠诚低），不是写死名字。
- 后果可以是即时、延迟、连锁。
- 事件文本用模板 + 变量，支持本地化。

> 目标：60 个模板 → 300+ 可玩事件；靠角色/关系/因果组合出差异。

---

## 5.13 调度与性能预算

### 固定步长

- 模拟 20 Hz（50 ms/tick），渲染插值。
- L1 每 20 tick（1 s）更新一次。
- L2 每 1 游戏日更新一次。

### 预算（每 tick，50 ms）

| 项 | 预算 |
|----|------|
| L0 决策（50 人 × 0.02 ms） | 1.0 ms |
| L0 移动/战斗 | 0.8 ms |
| L1 更新（300 人） | 0.5 ms |
| 事件/导演 | 0.2 ms |
| 总计 | ≤ 2.5 ms |

- 用**时间片**：超预算的任务排队到下一 tick。
- 决策错峰：`hash(id + tick) % 5`，避免同一帧全员决策。
- Worker + SharedArrayBuffer；无 SAB 时回退 postMessage（降频）。

### 数据结构

- SoA（Structure of Arrays）：位置、血量、需求各一个 TypedArray。
- 关系用稀疏图（只存强关系，弱关系用派系/声望近似）。
- 记忆用环形缓冲，每人最多 32 条。

---

## 5.14 可调试性（必须有）

- **AI 检查器**：选中 NPC，显示当前目标、Utility 分数、记忆、关系、计划。
- **事件日志**：谁触发了什么、为什么。
- **导演面板**：当前张力、目标张力、事件池权重。
- **时间回溯**：最近 30 秒状态环形快照，复现 bug。
- **种子**：世界生成/随机事件用种子，可复现。

> 没有调试工具的模拟系统，三个月后没人敢改。

---

## 5.15 数据 Schema（节选）

```ts
type Agent = {
  id: number;
  name: string;
  realm: Realm;
  roots: Root[];
  traits: Trait[];
  needs: { cultivation: number; rest: number; safety: number; social: number };
  relations: Map<AgentId, number>;
  memories: Memory[];
  goal: Goal | null;
  currentAction: Action | null;
};
```

- 内容表用 JSON/TS + zod 校验。
- 运行时用 TypedArray + 对象池。
- 存档只存「差异」和「重要记忆」，不存全量每帧状态。

---

## 5.16 反模式（不要做）

- ❌ 所有 NPC 都跑 GOAP/全模拟 → 性能崩溃。
- ❌ 事件纯随机 → 玩家感觉被针对/无因果。
- ❌ 运行时调用 LLM 生成剧情 → 延迟、成本、不可复现、审核风险。
- ❌ 关系网全连接 → O(n²) 爆炸。
- ❌ 导演系统只加难度，不调节奏。
- ❌ 没有调试工具，靠 console.log 猜 AI 为什么这么做。
