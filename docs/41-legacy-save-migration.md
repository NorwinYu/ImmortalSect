# 41 · 旧存档迁移修复（线上崩溃排查）

> 线上反馈：`Uncaught TypeError: Cannot read properties of undefined (reading 'length')`。本文记录根因、修法与回归，避免同类问题再发生。

---

## 41.1 现象

打开游戏（浏览器里已有旧版本存档）即报错，并被全局错误兜底弹成「运行时错误」：

```
Uncaught TypeError: Cannot read properties of undefined (reading 'length')
```

## 41.2 根因

`SaveManager.read()` 直接把 `localStorage` 里的 slot **原样**放回内存：

```ts
return { version: 2, slots: parsed.slots ?? {}, settings: ... };
```

而字段迁移 `normalizeState()` 只在两个地方被调用：**导入 JSON** 与 **v1 旧档迁移**。于是「正常读取自己的存档」这条最常走的路径**从不迁移**。

0.25.0 给 `GameState` 加了 `achievements: string[]`，HUD 每 0.25 秒调用一次：

```ts
hud.setAchievements(game.state.achievements.length, ACHIEVEMENTS.length);
```

旧档没有这个字段 → `undefined.length` → 崩。

> 更早的字段（`sectFaith`、`technique` 等）没暴露问题，是因为它们只参与算术（`undefined + 1 = NaN`）或用 `== null` 判断，不会抛错；而 `.length` / `.includes` 会直接抛。

## 41.3 修法

**主修：读取时就迁移。** `read()` 里对每个 slot 走一遍 `asMeta()`（内含 `normalizeState`），并顺带丢弃结构损坏的 slot（打 `console.warn`，不再静默）。

**补强：`normalizeState` 补齐全部后加字段。**

| 字段 | 缺省 |
|---|---|
| `achievements` | `[]` |
| `flags` / `upgrades` | `{}` |
| `buildings.*` | 缺失的 id 用 `initialBuildings()` 补（如后加的 `array` 护山大阵） |
| `player.artifacts` | `[]`（**只被 `.includes()`/`.length` 读，最危险**） |
| `player` 其它数值（realm/qiMax/pills/age/lifespan/daoHeart/karma/injury/techniques/root/bottleneck） | 逐项给默认值 |
| `resources.*` | 逐项给默认值（120/40/8/12/12） |

**兜底：** `syncGameHud`、成就面板、`newlyUnlocked`、成就判定都改成 `Array.isArray(...)` / `?.length ?? 0`，任何一条路径拿到脏数据都不会再抛。

## 41.4 回归

新增两条冒烟检查（**专门构造旧档**）：

1. 先正常开局写一份存档 → 手动删掉 `achievements / sectFaith / faithBought / faithRankIndex / cycle / upgrades / buildings.array / player.artifacts / disciple.technique` → 重新加载（**去掉 `fresh=1`**）；
2. 断言：`achievements` 是数组、`sectFaith === 0`、`faithBought` 是对象、`technique === null`、`artifacts` 是数组、`buildings.array.level` 是数字、`upgrades` 是对象，并且 **`game.meditate()` 能正常执行**（它内部读 `player.artifacts.includes`，正是崩溃点）；
3. 断言整个加载过程**零 pageerror / 零 console.error**。

> 这一条比修 bug 本身更重要：此前所有回归都从 `fresh=1` 开始，永远不会加载旧档，所以这类问题**测不出来**。

## 41.5 验收

- 冒烟 **65 → 67 项**全绿；
- 版本 0.28.1。
