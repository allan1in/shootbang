# Shootbang 可观测性与用户反馈系统

> 更新日期：2026-08-31
> 技术栈：Next.js 16、React 19、Sentry、Vercel Firewall、Resend
> 用途：记录当前线上架构、设计边界、测试方式及简历表述。

## 1. 目标

Shootbang 使用两条互补链路处理线上问题：

1. Sentry 自动记录浏览器、React、服务端和游戏渲染异常。
2. 用户通过反馈 Dialog 主动提交文字，由 Resend 发送到维护者邮箱。

```text
应用异常
  → Sentry Event
  → 按 fingerprint 聚合为 Issue
  → 结合 release、environment 和设备信息分析

用户反馈
  → POST /api/feedback
  → Vercel Firewall 按 IP 限流
  → Next.js 校验同源、请求大小和字段
  → Resend 幂等发送
  → 指定邮箱收件
```

各服务职责如下：

| 服务 | 职责 | 不负责什么 |
|---|---|---|
| Sentry | 错误采集、事件聚合、版本和环境关联 | 不发送反馈邮件，也不会自动修复问题 |
| Vercel Firewall | 在请求进入应用前限制反馈接口的请求频率 | 不验证反馈内容，不发送邮件 |
| Resend | 从服务端发送反馈邮件，并提供幂等发送 | 不判断请求内容是否有效 |

## 2. Sentry 错误监控

当前启用浏览器、Node.js、Edge Runtime 和 React Error Boundary 的错误采集，并上传 Source Map。事件通过 Git Commit SHA 标记 release，通过 Vercel 环境标记 Preview 或 Production。

当前保持关闭：

- Tracing；
- Session Replay；
- Logs；
- Profiling；
- Sentry User Feedback。

这是有意的轻量配置：先收集能够定位真实错误的最小信息，只有现有信息不足时才增加更重的监控能力。

Sentry 不应收到反馈正文、邮件地址、密钥或用户身份。反馈接口只在配置缺失或 Resend 异常时报告安全的错误分类。

## 3. 反馈界面

开始、暂停和结算界面共用一个 `FeedbackDialog`。主要行为包括：

- 输入长度为 1～2,000 字；
- 打开时草稿为空；
- 发送失败或被限流时保留草稿；
- 发送期间禁用发送、取消、Esc 和关闭按钮，避免请求状态与界面脱节；
- 成功后清空草稿、关闭 Dialog 并显示成功提示；
- 同一内容重试复用 submission ID，内容变化后生成新 ID。

Vercel Firewall 可能直接返回纯文本 `429 Too Many Requests`。客户端在解析 JSON 前先识别状态码，并显示：

```text
提交过于频繁，请稍后重试。
```

## 4. 服务端反馈接口

接口为 `POST /api/feedback`，请求结构固定为：

```ts
interface FeedbackRequest {
  content: string;
  submissionId: string;
  page: string;
}
```

Route Handler 按以下顺序处理：

1. 验证 `Origin` 与当前请求 URL 同源。
2. 只接受 JSON，并限制请求体不超过 16KB。
3. 验证正文长度、UUID 和站内页面路径。
4. 从服务端环境变量读取固定的收件人与发件人。
5. 构建纯文本邮件。
6. 使用 `feedback/<submissionId>` 作为 Resend 幂等键发送。

同源校验用于挡住普通跨站浏览器提交，但它不是身份验证；脚本可以伪造 HTTP Header。真正的请求频率防护由 Vercel Firewall 在应用代码执行前完成。

## 5. Vercel Firewall 限流

推荐在 Vercel 项目中创建一条 Rate Limit 规则：

```text
Method: POST
Path: /api/feedback
Key: IP
Window: 10 minutes
Limit: 5 requests
Action: Rate Limit / 429
```

这条规则只保护反馈接口，不影响首页、静态资源、Sentry tunnel 或其他 API。规则在 Vercel 平台生效，不写入仓库，也不需要重新部署代码。

限流是成本保护而不是绝对防护：共享出口 IP 下的多人可能共用额度，攻击者也可能更换 IP。对于当前流量规模，这比引入数据库、Redis 或账号系统更简单。只有真实滥用证明规则不足时，再增加持久化配额或全局熔断。

## 6. Resend 邮件发送

所需环境变量只有：

| 变量 | 用途 |
|---|---|
| `RESEND_API_KEY` | 服务端调用 Resend |
| `FEEDBACK_FROM_EMAIL` | 已验证域名下的固定发件地址 |
| `FEEDBACK_TO_EMAIL` | 固定收件地址 |

客户端不能指定收件人或发件人。邮件使用纯文本，正文包含：

- 用户主动填写的反馈；
- 服务端提交时间；
- 页面路径；
- User-Agent；
- release；
- environment。

不包含 IP、游戏操作轨迹、灵敏度、音量或用户身份。

Resend 幂等键可以防止双击、网络重试和响应丢失造成重复邮件。按钮禁用只解决界面层面的重复操作，供应商幂等才是发送层的最终保护。

## 7. 错误响应

```ts
type FeedbackResponse =
  | { ok: true }
  | {
      ok: false;
      code:
        | "invalid_input"
        | "rate_limited"
        | "service_unavailable"
        | "send_failed";
    };
```

| 状态 | code | 含义 |
|---|---|---|
| 400 / 403 | `invalid_input` | 请求格式、字段或来源不合法 |
| 429 | `rate_limited` | Vercel Firewall 拒绝高频请求；由客户端根据 HTTP 状态映射 |
| 502 | `send_failed` | Resend 拒绝或发送失败 |
| 503 | `service_unavailable` | 服务端配置缺失或未知服务异常 |

响应不暴露服务商报错详情、密钥或内部堆栈。

## 8. 测试与验收

自动化测试覆盖：

- 1 字、2,000 字和超长输入；
- UUID 与页面路径校验；
- 缺失及伪造 Origin；
- 16KB 请求限制和非 JSON 请求；
- 邮件模板、固定收发地址和幂等键；
- 成功发送、失败重试、重复点击；
- 纯文本 429 响应、明确提示和草稿保留；
- 开始、暂停、结算入口的状态隔离。

Preview 手动验收应确认：

1. Resend 有发送记录，目标邮箱收到邮件。
2. 连续提交超过限额后收到 429，且不产生新邮件。
3. 限流窗口结束后可以再次提交。
4. Sentry 不包含反馈正文或邮件密钥。

## 9. 架构演进记录

早期版本曾在浏览器端使用 Cloudflare Turnstile。由于该服务在中国大陆并非官方支持区域，部分用户需要等待数秒或直接验证失败，反馈入口的可用性反而下降。因此当前版本已经删除其浏览器脚本、组件、token 字段、服务端验证、环境变量和相关测试，改由 Vercel Firewall 在边缘层限流。

这个调整的取舍是：不再做浏览器人机挑战，换取更稳定、简单的提交体验；同时保留服务端校验、Resend 幂等和接口限流，控制误用成本。

## 10. 简历表述

可以使用以下事实描述：

- 为 React Three Fiber FPS 训练应用搭建轻量可观测性体系，使用 Sentry 覆盖浏览器、Node.js、Edge 和 React Error Boundary，并通过 Source Map、release 与 environment 关联线上错误和部署版本。
- 设计 Vercel Firewall → Next.js Route Handler → Resend 的反馈链路，实现接口级 IP 限流、同源与 16KB 请求校验、2,000 字输入限制、固定收发地址、纯文本邮件和 UUID 幂等发送。
- 根据中国大陆真实网络可用性移除浏览器人机验证依赖，使用边缘限流降低反馈延迟和失败率，并通过 Playwright 覆盖 429 非 JSON 响应和失败重试。

不要写“完全防止机器人攻击”或“支持海量并发”。当前方案的目标是在个人项目规模下，以较低复杂度获得稳定的反馈通道和合理的额度保护。

## 11. 代码索引

| 模块 | 文件 |
|---|---|
| Sentry 浏览器初始化 | `instrumentation-client.ts` |
| Sentry Runtime 注册 | `instrumentation.ts` |
| Node.js / Edge 初始化 | `sentry.server.config.ts`、`sentry.edge.config.ts` |
| Source Map、release、tunnel | `next.config.ts` |
| React / 全局错误边界 | `components/ErrorBoundary.tsx`、`app/global-error.tsx` |
| 反馈 UI | `components/FeedbackDialog.tsx` |
| 反馈 Route Handler | `app/api/feedback/route.ts` |
| 反馈校验与邮件构建 | `lib/feedback.ts` |
| 反馈测试 | `tests/feedback.spec.ts` |
| 环境变量示例 | `.env.example` |
