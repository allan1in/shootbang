# Shootbang 可观测性与用户反馈系统总结

> 文档日期：2026-07-22  
> 技术栈：Next.js 16、React 19、Sentry、Cloudflare Turnstile、Resend、Vercel  
> 用途：记录工程设计、实现边界、测试方案、上线流程，并为简历和面试准备提供事实依据。

## 1. 项目背景

Shootbang 是一个浏览器端 FPS 热身训练工具。项目上线后需要解决两个不同但相关的问题：

1. 用户遇到浏览器、React 或服务端异常时，开发者需要知道问题发生在哪个版本、环境和设备上。
2. 用户有建议或遇到无法由自动监控解释的问题时，需要一个低摩擦的反馈入口，同时避免机器人滥用邮件额度。

最终形成两条互补链路：

```text
应用异常
  → Sentry SDK 采集
  → Sentry Event
  → 按 fingerprint 聚合成 Issue
  → 开发者结合版本和环境分析

用户文字反馈
  → Turnstile 浏览器验证
  → Next.js 服务端二次验证
  → Resend 幂等发送
  → 指定邮箱收件
  → 服务异常再由 Sentry 记录
```

三项服务的职责严格分离：

| 服务 | 主要职责 | 不负责什么 |
|---|---|---|
| Sentry | 捕获异常、聚合事件、关联 release/environment | 不负责发送反馈邮件，也不能代替本地调试直接修复错误 |
| Cloudflare Turnstile | 判断反馈提交是否可信，签发一次性验证 token | 不保存反馈正文，不负责邮件发送 |
| Resend | 在服务端发送验证通过的反馈邮件，并提供幂等发送能力 | 不判断请求是不是机器人 |

## 2. 总体架构

```text
┌──────────────────────────── Browser ────────────────────────────┐
│                                                                 │
│ React ErrorBoundary / global-error                              │
│          └─────────────── Sentry error event ───────────────┐   │
│                                                            │   │
│ FeedbackDialog → Turnstile Managed Widget                  │   │
│          └── token + content + UUID → POST /api/feedback   │   │
└────────────────────────────────────────────────────────────┼───┘
                                                             │
┌────────────────────── Next.js / Vercel ─────────────────────┼───┐
│                                                            │   │
│ /monitoring ──────────────── Sentry tunnel ─────────────────┘   │
│                                                                 │
│ POST /api/feedback                                               │
│   1. HTTP 与字段校验                                             │
│   2. Cloudflare Siteverify                                      │
│   3. success + action + hostname 三重检查                        │
│   4. Resend 幂等发送                                             │
│   5. 配置或服务异常 → Sentry                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Sentry：轻量错误监控

### 3.1 为什么接入 Sentry

浏览器端错误通常只发生在用户设备上。没有远程错误监控时，开发者只能依赖用户截图或口述，很难知道：

- 哪个部署版本发生了错误；
- 是 Preview 还是 Production；
- 浏览器、操作系统和页面路径是什么；
- React 组件栈和 JavaScript 堆栈指向哪里；
- 同类错误影响了多少次访问。

Sentry 的价值不是保证应用不出错，而是在错误发生后保留足够的诊断上下文，并把相同问题聚合起来。

### 3.2 当前启用范围

当前采用轻量配置：

- 启用浏览器、Node.js 和 Edge Runtime 的错误采集；
- 启用 React Error Boundary 和 Next.js 全局错误捕获；
- 上传 Source Map，使生产环境压缩后的堆栈映射回源码；
- 使用 release 关联 Git Commit SHA；
- 使用 environment 区分 Preview、Production 等部署环境；
- 保留 Sentry SDK 自动产生的必要 Breadcrumbs。

当前明确关闭：

- Tracing：`tracesSampleRate: 0`；
- Session Replay；
- Logs：`enableLogs: false`；
- Profiling；
- Sentry User Feedback。

这样做的原因是第一阶段优先控制客户端体积、网络开销、额度和数据收集范围。只有真实事件证明现有信息不足时，再按问题增量开启更重的能力。

### 3.3 三个 Runtime 的初始化

项目分别初始化三个运行位置：

- `instrumentation-client.ts`：浏览器 SDK；
- `sentry.server.config.ts`：Node.js 服务端；
- `sentry.edge.config.ts`：Edge Runtime；
- `instrumentation.ts`：根据 `NEXT_RUNTIME` 加载对应服务端配置，并导出 Next.js 请求错误捕获函数。

所有环境均设置：

```ts
sendDefaultPii: false
tracesSampleRate: 0
enableLogs: false
```

SDK 仅在 `NODE_ENV === "production"` 且存在 DSN 时启用，因此本地开发和自动化测试不会向真实 Sentry 项目发送事件。

### 3.4 React 与 Next.js 错误边界

错误覆盖分为两层：

1. `components/ErrorBoundary.tsx` 捕获 React 子树渲染错误，调用 `Sentry.captureException`，并附加 React component stack。
2. `app/global-error.tsx` 捕获 App Router 无法由普通边界恢复的全局错误，同时给用户展示可重试的错误页面。

这让“用户看到友好降级界面”和“开发者收到真实异常记录”同时成立。

### 3.5 Source Map、Release 与 Environment

生产代码经过压缩和拆包，线上堆栈中的文件名和行号通常不能直接对应源码。项目通过 `withSentryConfig` 在构建阶段上传 Source Map：

- `SENTRY_AUTH_TOKEN` 仅用于构建阶段上传，必须作为 Vercel 服务端秘密变量保存；
- `SENTRY_ORG` 和 `SENTRY_PROJECT` 指定上传目标；
- 上传成功后删除部署产物中的 Source Map，避免公开暴露源码映射；
- release 优先使用显式 Sentry 配置，否则使用 `VERCEL_GIT_COMMIT_SHA`；
- environment 优先使用显式配置，否则使用 `VERCEL_ENV`。

因此 Sentry 中的事件可以回答“哪个提交在 Preview 或 Production 出现了问题”。

需要区分两种看起来相似的值：

- `NEXT_PUBLIC_SENTRY_DSN` 是事件接收地址，需要进入浏览器代码，本身不是管理密钥；
- `SENTRY_AUTH_TOKEN` 拥有上传 Source Map 等权限，必须保密，不能提交到仓库。

### 3.6 Sentry Tunnel

`next.config.ts` 设置了：

```ts
tunnelRoute: "/monitoring"
```

浏览器先把 Sentry Envelope 发到本站 `/monitoring`，再由 Next.js 转发到 Sentry。这样可以降低广告拦截器直接拦截 Sentry 域名造成的数据丢失。

代价是监控请求会经过自己的 Vercel 服务，增加少量函数流量和成本，所以不能把高频逐帧数据直接发给 Sentry。

### 3.7 Breadcrumb、Event 与 Issue

三个概念的关系：

- Breadcrumb（面包屑）：事件发生前的上下文轨迹，例如导航、点击、Fetch 和 Console；它本身通常不是一条 Issue。
- Event（事件）：一次具体的错误或 warning 上报。
- Issue（问题）：Sentry 根据堆栈、消息和 fingerprint，把多个相似 Event 聚合后的问题集合。

同一 Issue 只有一个标题不代表只收到一次事件。查看 Issue 内的 Event 数量和时间线，才能判断出现频率。

游戏运行期间的掉帧检测、warning Event、fingerprint 和定位流程已独立记录在 [`stutter.md`](./stutter.md)，本文不重复维护这些实现细节。

## 4. Turnstile：反馈接口的反滥用入口

### 4.1 为什么选择 Turnstile

反馈接口会触发付费或有额度的邮件发送。如果完全公开，脚本可以批量调用接口消耗 Resend 额度。仅在前端禁用按钮或做防抖无法阻止直接请求 API。

Turnstile 在请求进入邮件链路前增加一次可信度验证：正常用户通常无感，可疑流量才显示交互挑战。

第一版没有引入数据库、IP 限流和账号系统，原因是希望用较低复杂度先挡住普通自动化滥用；如果上线后出现能持续通过 Turnstile 的攻击，再增加持久化限流。

### 4.2 浏览器端 Managed Widget

项目没有额外安装 React Turnstile 包，而是通过 `next/script` 加载 Cloudflare 官方脚本，并自行封装 `TurnstileWidget`。

关键配置：

```ts
{
  action: "feedback_submit",
  appearance: "interaction-only",
  execution: "execute",
  size: "flexible"
}
```

- `interaction-only`：只有需要用户交互时才显示 Widget；
- `execute`：用户点击“发送”时才开始验证，避免填写时间过长导致 token 提前过期；
- `action`：给 token 标记明确业务用途，服务端必须再次核对；
- `size: flexible`：适应反馈 Dialog 宽度。

封装处理成功、失败、过期、超时和交互显示状态；组件卸载时拒绝尚未完成的 Promise，并移除 Widget，避免异步回调作用于已经关闭的 Dialog。

### 4.3 Site Key 与 Secret Key

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 会进入浏览器，是公开标识；
- `TURNSTILE_SECRET_KEY` 只存在于服务端，用来向 Siteverify 验证 token，必须保密。

只在浏览器端拿到 token 并不等于验证完成。攻击者可以伪造前端请求，因此服务端必须拿 Secret Key 调用 Cloudflare Siteverify。

### 4.4 服务端三重校验

服务端仅在以下条件全部成立时允许发信：

```text
success === true
action === "feedback_submit"
hostname ∈ FEEDBACK_ALLOWED_HOSTNAMES
```

三层检查分别证明：

1. Cloudflare 接受了这次验证；
2. token 确实用于反馈提交，而不是项目内其他动作；
3. token 来自允许的正式或预览域名。

Siteverify 请求设置 5 秒超时。Cloudflare 不可用、token 缺失、过期、重复使用、action 错误或 hostname 不匹配时全部 fail-closed，不会降级发送邮件。

Production 同时拒绝 Cloudflare 官方测试 Secret Key，避免错误配置让生产验证永久放行。

### 4.5 Preview 与 Production

Turnstile Widget 可以由 Preview 与 Production 共用，只要：

- Cloudflare Widget 配置包含两个稳定 hostname；
- Vercel 对两个环境分别配置正确变量；
- 服务端 `FEEDBACK_ALLOWED_HOSTNAMES` 只允许预期域名；
- Sentry environment 和邮件主题能够区分 `preview` 与 `production`。

项目较小时，共用 Widget 能减少配置维护；业务扩大、团队权限复杂或需要独立统计时，再拆分成两个 Widget。

## 5. Resend：服务端邮件交付

### 5.1 Resend 在链路中的位置

Resend 相当于服务端邮件发送基础设施：应用把收件人、发件人、主题和纯文本正文交给 Resend，由它负责与邮件系统通信和记录发送结果。

完整流程：

```text
用户填写反馈
  → Turnstile 获取 token
  → POST /api/feedback
  → 服务端验证输入
  → Siteverify 验证 token
  → 构造纯文本邮件
  → Resend API
  → 用户配置的收件邮箱
```

浏览器永远拿不到 `RESEND_API_KEY`，也不能自行指定收件人或发件人。

### 5.2 发件域名与地址

`FEEDBACK_FROM_EMAIL` 必须使用 Resend 已验证域名，例如：

```text
Shootbang <feedback@send.example.com>
```

其中 `feedback@` 是发件地址的本地部分，不要求真实存在一个可以登录的邮箱；它表示通过已验证域名授权发送。是否能够接收回信是另一套 MX/邮箱托管配置。

`FEEDBACK_TO_EMAIL` 可以先使用个人邮箱，以后随时在 Vercel 环境变量中更换，不需要修改代码。

### 5.3 幂等发送

每次新内容生成一个浏览器 UUID，Resend 幂等键为：

```text
feedback/<submissionId>
```

网络超时、响应丢失或失败重试时，相同内容复用同一个 `submissionId`；内容变化后才生成新 ID。

这保证一次逻辑提交即使重复到达 Resend，也不会产生多封重复邮件。这里的“幂等”指同一个操作执行一次或多次，最终业务效果保持一致。

### 5.4 邮件内容

邮件使用纯文本而不是用户可控 HTML，避免把反馈正文作为 HTML 执行。正文包含：

- 用户反馈正文；
- 服务端提交时间；
- 页面路径；
- User-Agent；
- release；
- environment。

不包含：

- IP；
- Turnstile token；
- Sentry/Resend 密钥；
- 鼠标、射击、灵敏度和音量数据；
- 用户身份信息。

环境、release 和 User-Agent 会先移除换行并限制长度，避免诊断字段破坏邮件结构。

## 6. 反馈 API 的服务端安全边界

`POST /api/feedback` 采用 Node.js Runtime，并在调用任何外部服务前完成基础拒绝：

- 只接受 JSON；
- 请求体最多 16KB，同时检查 Header 和真实 UTF-8 字节数；
- 反馈正文 trim 后必须为 1～2000 字；
- Turnstile token 最多 2048 字符；
- `submissionId` 必须是合法 UUID；
- 页面路径最多 200 字符、必须以 `/` 开头且不能包含换行；
- 环境变量缺失时返回 `503 service_unavailable`；
- 响应设置 `Cache-Control: no-store`。

对外只暴露固定错误码：

| HTTP 状态 | code | 含义 |
|---|---|---|
| 400 | `invalid_input` | 输入格式或长度错误 |
| 403 | `verification_failed` | Turnstile 验证未通过 |
| 503 | `service_unavailable` | 配置缺失、Turnstile 网络异常等服务不可用 |
| 502 | `send_failed` | Resend 发送失败 |

外部服务的原始错误和密钥不会返回给浏览器。

### 6.1 Sentry 与反馈 API 的联动

以下情况写入 Sentry：

- 服务端环境变量缺失；
- Cloudflare Siteverify 网络或服务异常；
- Resend 调用异常。

事件使用 `component=feedback-api` 和 `provider=turnstile|resend|configuration` 标签分类。

普通 Turnstile 拒绝不写 Sentry，因为这是正常防护结果，不应制造告警噪声。Sentry 事件也不附加反馈正文和 token。

## 7. 反馈 Dialog 的产品与并发设计

开始、暂停和结算页面都提供反馈入口，但 `GameBoard` 只维护一个 `FeedbackDialog` 实例，避免三套状态和验证组件同时存在。

主要交互规则：

- 打开时输入为空；
- 前端限制 1～2000 字并显示字数；
- 发送期间禁用输入、取消、叉号和 Esc 关闭，避免用户误以为请求被取消；
- 发送按钮显示 loading，并阻止并发点击；
- 成功后清空、关闭并显示 toast；
- 失败时保留正文、重置 Turnstile，允许重试；
- 相同内容重试复用 submission ID，修改内容后生成新 ID；
- Turnstile 仅在需要交互时占据 Dialog 布局空间，避免覆盖 Textarea；
- 暂停页面打开或关闭反馈不会恢复游戏或请求 Pointer Lock。

组件使用 `AbortController`、打开状态引用和递增 generation 防止过期异步回调更新已经失效的提交状态。

## 8. 隐私与数据最小化

当前采取的数据最小化原则：

- Sentry 设置 `sendDefaultPii: false`；
- 反馈 API 不记录 IP；
- 邮件只包含反馈正文和最小诊断字段；
- 反馈正文与 Turnstile token不会写入 Sentry；
- 测试和开发环境不向真实 Sentry 发事件；
- 密钥只保存在本地 `.env.local` 或 Vercel Environment Variables。

仍需诚实说明：Sentry SDK 的自动 Breadcrumbs 可能包含页面导航、Fetch URL、Console 信息和 UI 元素选择器；Turnstile 会由 Cloudflare 执行浏览器可信度判断；反馈正文会经过 Resend 并进入收件邮箱。正式大范围推广前适合增加一份简洁隐私说明。

## 9. 环境变量清单

### Sentry

| 变量 | 可见范围 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | 浏览器可见 | 客户端、服务端与 Edge 的事件接收地址 |
| `SENTRY_DSN` | 服务端可选 | 服务端 DSN 覆盖值 |
| `SENTRY_ORG` | 构建环境 | Source Map 上传目标组织 |
| `SENTRY_PROJECT` | 构建环境 | Source Map 上传目标项目 |
| `SENTRY_AUTH_TOKEN` | 严格保密 | 构建阶段上传 Source Map |
| `SENTRY_ENVIRONMENT` | 服务端 | 显式环境名，可回退到 `VERCEL_ENV` |
| `SENTRY_RELEASE` | 服务端 | 显式 release，可回退到 Git Commit SHA |

### Turnstile 与 Resend

| 变量 | 可见范围 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 浏览器可见 | 渲染 Turnstile Widget |
| `TURNSTILE_SECRET_KEY` | 严格保密 | 服务端 Siteverify |
| `FEEDBACK_ALLOWED_HOSTNAMES` | 服务端 | 允许的 Preview/Production hostname 列表 |
| `RESEND_API_KEY` | 严格保密 | 服务端调用 Resend |
| `FEEDBACK_FROM_EMAIL` | 服务端 | 已验证域名下的发件地址 |
| `FEEDBACK_TO_EMAIL` | 服务端 | 接收反馈的邮箱 |

原则：带 `NEXT_PUBLIC_` 的变量会进入浏览器包；所有 Secret 和 Auth Token 只能配置在 Vercel 服务端。

## 10. 测试与上线验证

### 10.1 自动化测试

反馈专项测试覆盖：

- 输入、UUID、token 和路径的边界校验；
- action、hostname 和验证失败时禁止发信；
- Resend 幂等键与最小邮件内容；
- 诊断字段换行清理；
- Turnstile 交互布局；
- 双击防重、发送期间锁定 Dialog；
- 失败保留草稿并复用 submission ID；
- 取消、Esc、叉号和遮罩行为；
- 暂停与结算入口不改变游戏状态；
- Route Handler 在外部调用前拒绝非法请求。

PR #6 合并前的验证快照：

- TypeScript：通过；
- ESLint：0 error，1 个与本功能无关的既有 warning；
- Playwright：完整回归套件通过；
- Vercel Preview：构建通过；
- Production：Turnstile 验证成功、Resend 发送成功、真实邮箱收件成功。

### 10.2 手动验收链路

```text
打开 Production
  → 从开始/暂停/结算页打开反馈
  → 输入测试文本并发送
  → 确认成功 toast
  → Cloudflare Analytics 出现验证
  → Resend Logs 出现发送记录
  → 目标邮箱收到邮件
  → 确认 environment=production、release 正确
```

## 11. 关键工程取舍

### 11.1 为什么没有开启全部 Sentry 能力

Tracing、Replay、Logs 和 Profiling 会增加包体积、事件量、额度消耗和隐私范围。第一版只解决“知道发生了应用错误”这一核心问题，不为了可能永远用不到的信息长期付费。

### 11.2 为什么 Turnstile 前后端都要做事

前端负责获得良好的验证体验和 token，后端负责作最终信任判断。任何只存在于浏览器的规则都可以被绕过，因此 Secret Key、Siteverify、action 和 hostname 校验必须在服务端。

### 11.3 为什么第一版不做 IP 限流

持久化 IP 限流通常需要 Redis/KV、代理 IP 解析、窗口算法和额外隐私考虑。Turnstile 已能以较低成本挡住普通机器人；等真实滥用证明有需要时再增加限流，避免过度设计。

## 12. 当前限制与未来演进

当前限制：

- Turnstile 不是绝对防刷，能通过验证的滥用仍可能消耗 Resend 额度；
- 没有数据库、反馈编号、截图附件、联系方式或处理状态；
- 邮件反馈量大后，个人邮箱不适合充当工单系统；
- Sentry tunnel 会消耗少量 Vercel 流量。

按真实问题演进，而不是一次性全部接入：

1. 出现持续邮件滥用：增加基于 KV/Redis 的限流和全局配额闸门。
2. 普通错误事件缺少调用链信息：按问题和流量比例开启 Tracing。
3. 反馈量超过邮箱处理能力：迁移 Featurebase、Canny 或正式工单系统。
4. 大范围推广：增加隐私说明和数据保留策略。

## 13. 简历写法

### 13.1 一句话项目描述

开发并上线基于 Next.js 16、React Three Fiber 的浏览器 FPS 热身训练工具，完成 Sentry 错误监控、可信邮件反馈链路与 Vercel 部署。

### 13.2 可直接使用的项目亮点

版本 A，偏前端与全栈：

- 为 React Three Fiber FPS 训练应用搭建轻量可观测性体系，使用 Sentry 覆盖浏览器、Node.js、Edge 和 React Error Boundary，并通过 Source Map、release 与 environment 实现线上错误到源码和部署版本的关联。
- 设计 Cloudflare Turnstile → Next.js Route Handler → Resend 的安全反馈链路，实施服务端 action/hostname 校验、16KB 请求限制、2000 字输入校验、纯文本邮件与 UUID 幂等发送。
- 使用依赖注入拆分反馈业务逻辑与外部服务调用，完成异常分类、敏感数据最小化和可离线测试设计；合并前通过完整 Playwright 回归套件并完成 Production 真实收件验收。

版本 B，偏安全与稳定性：

- 为公开反馈 API 建立 fail-closed 防护：Turnstile 服务端二次验证、action 与 hostname 白名单、生产测试密钥拦截、固定错误码和外部异常脱敏，防止前端绕过直接消耗邮件额度。
- 使用 Resend idempotency key 解决双击、网络重试和响应丢失导致的重复邮件问题，并通过服务端固定收发地址阻止客户端篡改邮件目标。
- 采用最小权限和数据最小化策略，隔离公开 Site Key/DSN 与服务端 Secret/Auth Token，不向 Sentry 发送反馈正文、验证 token、IP 或游戏操作轨迹。

### 13.3 不建议写的夸张表述

除非以后有真实数据，否则不要写：

- “100% 防止机器人攻击”；
- “实现完整 APM/全链路追踪”；
- “支持海量反馈并发”；
- “显著降低故障率 XX%”。

当前可以证明的是：系统已在 Production 完成真实 Turnstile 验证，并通过 Resend 成功送达反馈邮件；Sentry 错误监控已经接入浏览器、Node.js、Edge 和 React Error Boundary。

## 14. 面试讲解模板

### 14.1 两分钟版本

项目上线前，我发现单靠本地测试无法知道真实用户是否遇到应用异常，同时公开反馈接口又可能被机器人刷邮件额度。因此我把问题拆成错误监控和可信反馈两条链路。

错误监控部分使用 Sentry 覆盖浏览器、Node.js、Edge 和 React 错误边界，通过 Source Map、Git Commit release 和 Vercel environment 定位线上版本。第一阶段关闭全量 Tracing、Replay、Logs 和 Profiling，以控制客户端体积、事件量和隐私范围。

反馈部分在开始、暂停、结算界面共用一个 Dialog。用户点击发送时执行 Turnstile，服务端再检查 success、action 和 hostname，验证通过才调用 Resend。请求有大小和字段限制，邮件使用纯文本，收发地址只来自服务端环境变量，并用 UUID 作为幂等键避免重复邮件。配置或供应商异常会安全地进入 Sentry，但不会携带反馈正文和 token。

最终通过完整 Playwright 回归套件、Vercel Preview 和 Production 真实收件完成验收。这个方案的重点不是堆监控功能，而是以较小成本形成“发现问题—收集反馈—定位版本—验证修复”的闭环。

### 14.2 常见追问

**为什么不用 Session Replay？**  
当前核心需求是错误信号。Replay 会增加包体积、额度和隐私范围，真实数据证明现有信息不足时再开启更合理。

**为什么不能只在前端验证 Turnstile？**  
前端代码和请求都可以伪造，只有持有 Secret Key 的服务端调用 Siteverify 并检查 action/hostname 才能建立信任。

**为什么还需要幂等键？按钮不是已经禁用了吗？**  
禁用按钮只能防普通双击，不能解决代理重试、网络响应丢失或客户端重复请求。服务端供应商的幂等能力才是最终防线。

**为什么没有一开始就做 Redis 限流？**  
先用 Turnstile 覆盖最常见自动化滥用，避免提前引入存储和分布式限流复杂度；上线后如果出现能持续通过 Turnstile 的攻击，再基于数据增加限流。

## 15. 代码索引

| 模块 | 文件 |
|---|---|
| Sentry 浏览器初始化 | `instrumentation-client.ts` |
| Sentry Runtime 注册 | `instrumentation.ts` |
| Node.js / Edge 初始化 | `sentry.server.config.ts`、`sentry.edge.config.ts` |
| Source Map、release、tunnel | `next.config.ts` |
| React / 全局错误边界 | `components/ErrorBoundary.tsx`、`app/global-error.tsx` |
| 反馈 UI | `components/FeedbackDialog.tsx` |
| Turnstile 封装 | `components/TurnstileWidget.tsx` |
| 反馈 Route Handler | `app/api/feedback/route.ts` |
| 反馈验证与邮件构建 | `lib/feedback.ts` |
| 反馈测试 | `tests/feedback.spec.ts` |
| 环境变量示例 | `.env.example` |
