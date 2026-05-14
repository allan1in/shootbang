# ShootBang

FPS 热身瞄准训练工具，帮助玩家在对局前快速进入状态。

在浏览器中进入 3D 射击场，锁定鼠标，射击随机出现的目标球。游戏结束后查看命中率、命中数和平均反应时间，用数据量化你的瞄准水平。

## 功能特性

- **Pointer Lock 射击** — 锁定鼠标后自由转动视角，左键射击，操作逻辑与主流 FPS 一致
- **3D 射击场** — Three.js 渲染的封闭房间，3 个目标球在墙面网格上随机刷新
- **可配置训练参数**
  - 灵敏度：0.01 ~ 10.0
  - 训练时长：15s / 30s / 60s / 120s
  - 网格密度：3x3 ~ 6x6
  - 目标大小：tiny / small / default / large / huge
- **统计数据** — 命中率、命中数、平均反应时间，设置持久化到 localStorage
- **音效反馈** — Web Audio API 合成音效（命中 / 未命中 / 倒计时）
- **计时进度条** — 顶部丝滑动画进度条，`requestAnimationFrame` 驱动
- **暂停 / 恢复** — 按 Esc 暂停，弹出菜单支持继续、重开、返回首页
- **FPS 计数器** — 右下角实时显示帧率
- **移动端检测** — 触屏或窄屏设备引导用户使用 PC 访问

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript |
| 3D 渲染 | Three.js |
| UI 组件 | shadcn/ui (base-nova) + Lucide React |
| 样式 | Tailwind CSS v4 + tw-animate-css |
| 测试 | Playwright (24 个 E2E 用例) |
| 部署 | Vercel |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 即可体验。

### 其他命令

```bash
npm run build    # 生产构建
npm run start    # 启动生产服务器
npm run lint     # ESLint 检查
npm run test     # Playwright E2E 测试
npm run check    # 完整检查（类型检查 + Lint + 测试）
```

## 项目结构

```
app/
  page.tsx                 # 入口页
  layout.tsx               # 根布局（字体、暗色主题、ErrorBoundary）
  globals.css              # 全局样式 + Tailwind 主题变量
components/
  GameBoard.tsx            # 游戏主控组件
  IdleScreen.tsx           # 开始界面 + 设置面板
  TimerBar.tsx             # 顶部计时进度条
  FpsCounter.tsx           # FPS 计数器
  Crosshair.tsx            # 准心覆盖层
  CountdownOverlay.tsx     # 3-2-1 倒计时
  ResultStats.tsx          # 结算统计面板
  PauseOverlay.tsx         # 暂停菜单
  TargetSizeSettings.tsx   # 目标大小选择器
  MobileGate.tsx           # 移动端检测网关
  ui/                      # shadcn/ui 组件
hooks/
  useGameLogic.ts          # 游戏状态机、射击、计分、计时
  useThreeScene.ts         # Three.js 场景初始化、3D 房间、目标池
  useSettings.ts           # 设置管理（localStorage 持久化）
lib/
  grid.ts                  # 网格位置生成、目标刷新逻辑
  sounds.ts                # Web Audio API 音效
tests/
  game.spec.ts             # Playwright E2E 测试（24 个用例）
```

## 测试

项目使用 Playwright 进行端到端测试，覆盖完整游戏流程：

```bash
npm run test          # 运行全部测试
npx playwright test -g "用例名称"  # 运行单个测试
```

### 测试辅助 API

开发环境下，GameBoard 通过 `window.__shootbang_test` 暴露测试接口：

| 方法 | 说明 |
|------|------|
| `startGame()` | 直接启动游戏（跳过 Pointer Lock） |
| `startCountdown()` | 启动倒计时 |
| `setGameState(state)` | 设置游戏状态 (`"idle"` / `"playing"` / `"finished"`) |
| `getGameState()` | 获取当前游戏状态 |
