@AGENTS.md

## 测试流程

每次修改代码后必须执行完整检查：
```bash
npm run check
```

该命令依次运行：TypeScript 类型检查 → ESLint → Playwright E2E 测试（18 个用例，~20s）。
任何步骤失败都必须修复后才能继续。

### 运行单个测试

```bash
npx playwright test -g "用例名称"
```

### 添加新功能的测试（强制）

实现新功能时，必须同步完成以下步骤：
1. 在 `tests/game.spec.ts` 中添加对应的 `test.describe` 块
2. 覆盖正常流程和至少一个边界情况
3. 运行 `npx playwright test` 确认新测试通过
4. 运行 `npm run check` 确认无回归

如果新功能无法自动化测试（如视觉效果、音效），需在 CLAUDE.md 中说明原因。

### 测试辅助 API

GameBoard 组件通过 `window.__shootbang_test` 暴露了测试接口：
- `startGame()` — 直接启动游戏（跳过 Pointer Lock）
- `startCountdown()` — 启动倒计时
- `setGameState(state)` — 设置游戏状态 ("idle" | "playing" | "finished")
- `getGameState()` — 获取当前游戏状态
