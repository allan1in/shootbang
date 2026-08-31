# Shootbang

> Shootbang 是一款无需下载，打开浏览器即可使用的 FPS 热身训练工具。

[立即体验 Shootbang](https://shootbang.allan1in.top)

进入浏览器中的 3D 训练场，锁定鼠标后射击随机出现的目标，在正式对局前快速进入状态。训练结束后可以查看命中数、命中率和平均反应时间。

Shootbang 面向 PC 端设计，需要使用鼠标和键盘操作，暂不支持移动设备。

## 功能

- **FPS 操作方式**：通过 Pointer Lock 锁定鼠标，左键射击，优先请求原始鼠标输入并在不支持时静默兼容。
- **3D 瞄准训练**：使用 React Three Fiber 和 Three.js 渲染训练场，3 个目标在墙面网格上随机刷新。
- **训练设置**：支持调整灵敏度、训练时长、网格大小和目标大小。
- **体验设置**：提供默认、雷雨和暴雪三种主题，以及可实时预览并保存的音量控制。
- **训练统计**：记录命中数、命中率和有效训练时间内的平均反应时间。
- **完整训练流程**：支持倒计时、暂停、恢复、重新开始和结算。
- **性能监控**：使用 Drei `PerformanceMonitor` 检测持续性能下降，并通过 Sentry 上报最小诊断信息。
- **用户反馈**：通过 Next.js 服务端和 Resend 将反馈发送到指定邮箱，并由 Vercel Firewall 对公开接口执行 IP 限流。
- **移动端优化**：移动设备只加载访问提示，不下载 3D 场景和主题音频等游戏依赖。

## 技术栈

| 分类 | 技术 |
|---|---|
| 应用框架 | Next.js 16、React 19、TypeScript |
| 3D 渲染 | React Three Fiber、Three.js、Drei |
| 状态管理 | Zustand |
| UI 与样式 | shadcn/ui、Base UI、Tailwind CSS v4、Lucide React |
| 可观测性 | Sentry、Vercel Speed Insights |
| 反馈服务 | Vercel Firewall、Resend |
| 测试 | Playwright、TypeScript、ESLint |
| 部署 | Vercel |

## 本地运行

项目使用 `pnpm@10.28.1` 管理依赖。

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可访问。

游戏主体可以在不配置第三方服务的情况下运行；反馈发送和线上监控需要额外的环境变量。

## 环境变量

复制 `.env.example` 为 `.env.local`，并按需配置：

| 变量 | 用途 |
|---|---|
| `RESEND_API_KEY` | Resend 服务端 API Key |
| `FEEDBACK_FROM_EMAIL` | 已验证域名下的反馈发件地址 |
| `FEEDBACK_TO_EMAIL` | 接收用户反馈的邮箱 |

反馈接口的限流规则在 Vercel Firewall 中配置，不需要环境变量。推荐仅匹配 `POST /api/feedback`，按 IP 在 10 分钟内最多允许 5 次请求。

Sentry 的 DSN、组织、项目和 Source Map 上传凭据通过部署环境配置。密钥不得提交到仓库。

## 常用命令

```bash
pnpm dev      # 启动开发服务器
pnpm build    # 创建生产构建
pnpm start    # 启动生产服务器
pnpm lint     # 运行 ESLint
pnpm test     # 运行 Playwright 测试
pnpm check    # 类型检查、ESLint 和完整 Playwright 测试
```

## 项目结构

```text
app/
  api/feedback/             # 反馈提交接口
  layout.tsx                # 全局 metadata、字体和服务组件
  page.tsx                  # 页面入口
components/
  GameBoard.tsx             # 游戏流程与界面编排
  SettingsDialog.tsx        # 训练和体验设置
  FeedbackDialog.tsx        # 用户反馈界面
  r3f/                      # R3F 场景、主题特效与性能监控
  ui/                       # shadcn 风格基础组件
hooks/
  useGameLogic.ts           # 射击、计时、暂停和统计逻辑
  useSettings.ts            # 设置草稿与保存流程
  useTheme.ts               # 主题状态
lib/
  feedback.ts               # 反馈校验与邮件编排
  performanceMonitoring.ts  # 性能报告与上报门控
  grid.ts                   # 目标网格与刷新逻辑
stores/
  gameStore.ts              # 游戏、设置和主题状态
tests/
  game.spec.ts              # 游戏流程测试
  feedback.spec.ts          # 反馈流程测试
  performance.spec.ts       # 性能监控测试
docs/                       # 工程设计与实现记录
```

## 工程文档

- [首屏加载优化](docs/loading.md)
- [掉帧检测与上报](docs/stutter.md)
- [错误监控与反馈系统](docs/feedback.md)
- [SEO 与搜索可发现性](docs/seo.md)

## 测试说明

Playwright 覆盖 Pointer Lock、倒计时、暂停恢复、有效训练计时、平均反应时间、设置持久化、性能监控和反馈提交等关键流程。

开发环境会注册内部测试接口，供 Playwright 控制游戏状态和第三方服务模拟；生产构建不会暴露这些接口。
