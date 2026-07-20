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
pnpm install

# 启动开发服务器
pnpm dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 即可体验。

### Sentry 错误监控

本地开发默认不向 Sentry 发送事件。部署环境需要配置：

| 环境变量 | 用途 |
|------|------|
| `NEXT_PUBLIC_SENTRY_DSN` | 客户端、服务端与 Edge Runtime 的事件接收地址 |
| `SENTRY_ORG` | Sentry Organization slug |
| `SENTRY_PROJECT` | Sentry Project slug |
| `SENTRY_AUTH_TOKEN` | 构建时上传 Source Maps，仅配置在 Vercel 服务端 |

Vercel Preview 与 Production 会根据 `VERCEL_ENV` 自动区分环境，Release 使用对应的 Git Commit SHA。当前仅启用错误监控，不启用 Replay、Tracing、Profiling、Logs 或 User Feedback。

### 反馈邮件配置

反馈表单使用 Cloudflare Turnstile 完成人机验证，并通过 Resend 从服务端发送邮件。复制 `.env.example` 为 `.env.local` 后配置以下变量：

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`：Turnstile Widget 的公开 Site Key，会在构建时进入浏览器代码。
- `TURNSTILE_SECRET_KEY`：Turnstile 服务端 Secret Key。
- `FEEDBACK_ALLOWED_HOSTNAMES`：Siteverify 允许的 hostname，多个值用英文逗号分隔；包含正式域名和稳定的 Vercel Preview 分支别名。
- `RESEND_API_KEY`：Resend API Key。
- `FEEDBACK_FROM_EMAIL`：使用 Resend 已验证域名的发件地址。
- `FEEDBACK_TO_EMAIL`：接收反馈的邮箱。

本地开发和自动化测试可使用 Cloudflare 官方测试密钥；不要将测试密钥配置到 Production。Preview 和 Production 应在 Vercel 中分别设置真实环境变量，并把对应的稳定 hostname 加入 Turnstile Widget。

### 其他命令

```bash
pnpm build    # 生产构建
pnpm start    # 启动生产服务器
pnpm lint     # ESLint 检查
pnpm test     # Playwright E2E 测试
pnpm check    # 完整检查（类型检查 + Lint + 测试）
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
pnpm test              # 运行全部测试
pnpm exec playwright test -g "用例名称"  # 运行单个测试
```

### 测试辅助 API

开发环境下，GameBoard 通过 `window.__shootbang_test` 暴露测试接口：

| 方法 | 说明 |
|------|------|
| `startGame()` | 直接启动游戏（跳过 Pointer Lock） |
| `startCountdown()` | 启动倒计时 |
| `setGameState(state)` | 设置游戏状态 (`"idle"` / `"playing"` / `"finished"`) |
| `getGameState()` | 获取当前游戏状态 |
