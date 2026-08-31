# Shootbang 游戏掉帧监控与 Sentry 上报

> 文档日期：2026-07-22  
> 技术栈：Next.js 16、React 19、React Three Fiber、Three.js、Drei `PerformanceMonitor`、Sentry、Playwright  
> 监控版本：`drei-simple-v1`  
> 用途：集中记录游戏运行期间的卡顿/掉帧检测、Sentry 上报、测试、定位流程和简历表达。

## 1. 监控目标

Shootbang 是一个浏览器端 FPS 热身工具，游戏运行在 React Three Fiber 的真实渲染循环中。不同设备、刷新率、DPR、主题特效和浏览器环境可能产生不同帧率表现。

第一阶段的目标不是保证所有设备达到固定 FPS，也不是直接找出 CPU/GPU 根因，而是先建立低成本的异常发现闭环：

```
真实 R3F 渲染循环
  → Drei PerformanceMonitor 判断持续性能下降
  → 生成最小诊断报告
  → Preview / Production 交给 Sentry
  → 同类事件聚合到一个 Issue
  → 开发者根据环境和版本线索本地复现
  → Chrome Performance / Spector.js 深度定位
```

监控能够回答“是否、哪里、哪个版本、什么环境发生了下降”，不能仅凭一条事件保证回答“具体哪一行代码导致了下降”。

## 2. 方案演进

曾经考虑过自研帧间隔分析器：刷新率校准、5 秒窗口、p95、最大帧时间、Long Task、多阈值、客户端队列和 Breadcrumb。那套方案信息丰富，但在没有真实事件分布前规则过于复杂，维护和误报成本都较高。

当前改用 Drei `PerformanceMonitor`，只监听持续的相对性能下降，并上报最小环境上下文。后续是否增加 LoAF、Tracing、Profiling 或 GPU 诊断，由真实事件决定。

当前明确不做：

- 自研 p95、最大帧时间和 Long Task 分析；
- 单帧固定毫秒阈值；
- 自定义性能 Breadcrumb；
- 原始逐帧数据上报；
- 自动降画质；
- Tracing、Replay、Profiling 和 Logs。

## 3. 模块职责

| 模块 | 职责 |
|---|---|
| `SceneCanvas` | 在 R3F Canvas 中挂载监控，并传入本局编号和有效时间引用 |
| `FramePerformanceMonitor` | 管理 Drei 组件生命周期、页面状态、WebGL Context、Sentry 和测试接口 |
| `lib/performanceMonitoring.ts` | 纯函数：边界计算、资格判断、报告生成、每局门控和 Event 构造 |
| Drei `PerformanceMonitor` | 采样 FPS，并在相对性能下降时触发 `onDecline` |
| Sentry | 接收 Preview / Production warning Event 并按 fingerprint 聚合 |
| Playwright | 使用同一套纯逻辑验证报告和生命周期 |

主要文件：

```
components/r3f/SceneCanvas.tsx
components/r3f/FramePerformanceMonitor.tsx
lib/performanceMonitoring.ts
tests/performance.spec.ts
```

## 4. Drei 配置与判断方式

当前配置：

```ts
export const PERFORMANCE_MONITOR_CONFIG = {
  ms: 250,
  iterations: 10,
  threshold: 0.75,
  lowerBoundRatio: 0.8,
  upperBoundRatio: 0.9,
  version: "drei-simple-v1",
} as const;
```

含义：

- 每约 250ms 形成一次采样；
- 10 次采样组成一次判断，约 2.5 秒；
- 使用当前观测峰值生成 80%～90% 的动态边界；
- 只监听 `onDecline`，不调用性能因子、不自动改变画质；
- 不额外创建 `requestAnimationFrame`，采样来自真实 Canvas 渲染循环。

`threshold: 0.75` 交给 Drei 使用，项目不复制 Drei 的内部下降算法。项目只负责提供 `bounds` 和接收 `onDecline`，因此不会声称当前规则是“至少 N 次采样低于阈值”。

### 4.1 动态边界

```ts
getPerformanceBounds(observedPeakFps) {
  return [observedPeakFps * 0.8, observedPeakFps * 0.9];
}
```

| 观测峰值 | 80% 下界 | 90% 上界 |
|---:|---:|---:|
| 60 FPS | 48 FPS | 54 FPS |
| 144 FPS | 115.2 FPS | 129.6 FPS |
| 100 FPS | 80 FPS | 90 FPS |

“观测峰值”是当前有效训练片段内看到的最高 FPS，不宣称等于显示器物理刷新率或设备理论最大性能。

### 4.2 为什么检测持续相对下降

第一版没有采用“任意一帧超过 100ms 就告警”，因为单个慢帧可能来自浏览器调度、窗口切换或偶发 GC；60Hz 和 144Hz 的帧时间也不同。持续相对下降更适合第一阶段跨设备收集信号。

这种方案的限制是：如果设备从第一帧开始就一直很慢，低 FPS 可能被当成当前基准。真实数据证明有需要后，再增加固定最低下限或稳定期。

## 5. 有效训练过滤

`shouldMonitorPerformance` 只有在以下条件全部满足时返回 `true`：

```
gameState === "playing"
isPaused === false
countdown === null
isLocked === true
isPageVisible === true
isWindowFocused === true
isContextAvailable === true
```

| 条件 | 排除的误报场景 |
|---|---|
| playing | idle、暂停页和结算页 |
| 未暂停 | 用户主动暂停 |
| countdown 为 null | 开始或恢复前倒计时 |
| Pointer Lock 已锁定 | 尚未真正进入训练操作 |
| 页面可见 | 浏览器后台节流 |
| 窗口有焦点 | 用户切换到其他应用 |
| WebGL Context 正常 | Context 丢失或恢复过程 |

资格无效时监控组件返回 `null`，采样停止；恢复有效训练后重新挂载采样器。

## 6. 生命周期与重置

### 6.1 暂停、失焦和 Pointer Lock

暂停、页面隐藏、窗口失焦、退出 Pointer Lock、倒计时开始或 WebGL Context 丢失，都会停止采样。恢复后重新建立采样状态，不把暂停等待时间算入有效训练时间。

### 6.2 resize 与 DPR

组件监听 `window.resize` 和 `devicePixelRatio` 的 `matchMedia` 变化。变化时递增 `samplingGeneration`，并使用：

```tsx
key={`${gameSessionId}:${samplingGeneration}`}
```

这会重建当前采样基准，但不会解除本局的“只上报一次”门控。

### 6.3 WebGL Context

`webglcontextlost` 会使 `isContextAvailable` 变为 `false`；`webglcontextrestored` 恢复资格判断。Context 恢复不会让同一局重复上报已经发送过的 Event。

### 6.4 新游戏

每局有递增的 `gameSessionId`：

- 新局重新允许一次性能 Event；
- 新局有效训练时间从 0 开始；
- Event 消息包含新的本地游戏编号；
- Sentry fingerprint 保持相同，便于聚合同类问题。

## 7. 有效训练时间

报告复用游戏倒计时的有效时间基准，不使用 `Date.now()`：

```ts
activeTrainingTimeMs = Math.min(
  duration * 1000,
  Math.max(0, (duration - timeLeftRef.current) * 1000),
);
```

它保证暂停和恢复倒计时不计入性能报告，并与平均反应时间使用同一训练时间语义。训练结束后时间也不会继续增长。

## 8. 报告生成

输入快照：

```ts
interface PerformanceSampleSnapshot {
  observedPeakFps: number;
  latestFps: number;
  averages: readonly number[];
}
```

输出字段：

| 字段 | 含义 |
|---|---|
| `monitorVersion` | 规则版本，目前为 `drei-simple-v1` |
| `gameSessionId` | 本地训练局编号 |
| `observedPeakFps` | 观测峰值 FPS |
| `averageFps` | 本次采样平均 FPS |
| `latestFps` | 最近一次 FPS |
| `declineRatio` | `(峰值 - 平均值) / 峰值`，限制在 0～1 |
| `declineThresholdFps` | 观测峰值的 80% 下界 |
| `sampleDurationMs` | `sampleCount × 250` |
| `sampleCount` | 有效平均样本数 |
| `context.theme` | 当前主题 |
| `context.dpr` | 当前像素比 |
| `context.viewportWidth/Height` | 视口尺寸 |
| `context.trainingDurationSeconds` | 当前训练设置时长 |
| `context.activeTrainingTimeMs` | 本局有效训练累计时间 |

示例输入：

```ts
observedPeakFps: 100
latestFps: 78
averages: [70, 72, 74, 76, 78, 70, 72, 74, 76, 78]
```

得到：

```
observedPeakFps: 100
averageFps: 74
latestFps: 78
declineRatio: 0.26
declineThresholdFps: 80
sampleDurationMs: 2500
sampleCount: 10
```

输入数组只参与平均值计算，报告不会保留 `averages`、逐帧数据、p95 或 Long Task 字段。

## 9. 每局一次门控

`gatePerformanceDecline` 使用 `reportedGameSessionId` 判断当前局是否已经报告：

```
当前局未报告 + 资格有效 + 发生 decline
  → 生成报告，并记录当前 gameSessionId

当前局已报告
  → 返回 null，不生成第二个报告

资格无效
  → 返回 null，不改变门控状态

新的 gameSessionId
  → 允许生成下一局报告
```

这不是页面会话级的三次限流，而是每局一次。暂停、恢复、resize 和 DPR 变化都不会解除同一局的门控。

## 10. Sentry Event

Preview 和 Production 触发报告后调用 `Sentry.captureEvent`，事件立即交给 Sentry SDK transport 异步发送；项目没有自定义性能队列，也没有自定义性能 Breadcrumb。

开发环境和自动化测试不会向真实 Sentry 发送，而是把报告和 Event 保存到内存测试接口。

固定消息前缀：

```
Game performance decline detected
```

实际消息带游戏编号：

```
Game performance decline detected [game 1]
```

固定 fingerprint：

```
shootbang-performance-decline-v1
```

消息编号区分不同训练局，固定 fingerprint 让同类 Event 聚合到一个 Sentry Issue。

### 10.1 Tags

```json
{
  "monitor_version": "drei-simple-v1",
  "theme": "default",
  "component": "game-render-loop"
}
```

### 10.2 Contexts

`game_performance`：

```json
{
  "game_number": 1,
  "observed_peak_fps": 100,
  "average_fps": 74,
  "latest_fps": 78,
  "decline_ratio": 0.26,
  "decline_threshold_fps": 80,
  "sample_duration_ms": 2500,
  "sample_count": 10,
  "active_training_time_ms": 1234
}
```

`game_environment`：

```json
{
  "theme": "default",
  "dpr": 1,
  "viewport_width": 1280,
  "viewport_height": 720,
  "training_duration_seconds": 30
}
```

Sentry 继续自动附加浏览器、操作系统、release 和 environment。

### 10.3 数据最小化

不发送：

- 原始 FPS 数组和逐帧时间；
- 鼠标 movementX/movementY；
- Pointer Lock 轨迹；
- 点击位置、目标位置和射击轨迹；
- 灵敏度、音量和用户身份；
- 反馈正文和邮件服务密钥。

## 11. Breadcrumb、Event 与 Issue

| 概念 | 中文理解 | 当前性能监控中的作用 |
|---|---|---|
| Breadcrumb | 面包屑/上下文轨迹 | 不创建自定义性能 Breadcrumb；Sentry 自动 Breadcrumb 仍可能存在 |
| Event | 一次具体事件 | 每局首次性能下降生成一条 warning Event |
| Issue | 聚合后的问题 | 相同 fingerprint 的多个 Event 聚合到同一 Issue |

因此 Sentry 中只有一个 Issue，不代表只收到一次 Event。需要进入 Issue 查看 Event 数量、时间线、release 和 environment。

## 12. 开发测试接口

仅在 `NODE_ENV !== "production"` 时注册：

```
window.__shootbang_performance_test
```

Preview 和 Production 构建不会注册该接口。

| 方法 | 用途 |
|---|---|
| `reset()` | 清空测试状态和内存报告 |
| `startGame()` | 开始新的模拟局并返回编号 |
| `setActive(boolean)` | 模拟有效/无效训练状态 |
| `advanceActiveTime(ms)` | 推进有效训练时间 |
| `restartSampling()` | 模拟 resize/DPR 造成的采样重建 |
| `simulateDecline(sample)` | 注入 Drei 风格采样快照 |
| `getBounds(fps)` | 读取动态边界 |
| `canMonitor(eligibility)` | 验证生命周期资格过滤 |
| `getState()` | 读取局编号、门控和有效时间 |
| `getRuntimeState()` | 读取真实组件 active/generation |
| `getReports()` | 读取内存报告 |
| `getCapturedEvents()` | 读取构造好的 Event |
| `getMonitorConfig()` | 读取采样配置 |
| `getSentryConfig()` | 读取消息、fingerprint 和 Breadcrumb 配置 |

测试接口调用生产使用的纯函数：

```
shouldMonitorPerformance
getPerformanceBounds
gatePerformanceDecline
createPerformanceDeclineReport
createPerformanceSentryEvent
```

这样测试和线上部署不会维护两套判断规则。

## 13. 自动化测试覆盖

测试文件：`tests/performance.spec.ts`。

覆盖内容：

1. 250ms、10 次采样、`threshold: 0.75` 和版本号；
2. 60 FPS 边界 `[48, 54]`；
3. 144 FPS 边界 `[115.2, 129.6]`；
4. 平均 FPS、下降比例、阈值、采样时长和有效训练时间；
5. 报告排除原始数组、逐帧数据、p95 和 Long Task；
6. 同一局连续下降只报告一次；
7. 暂停期间不报告且不累计暂停时间；
8. 恢复后继续使用同一局门控；
9. 新一局可以产生新的 Event；
10. 不同局使用不同消息但相同 fingerprint；
11. idle、暂停、倒计时、未锁定、失焦、页面隐藏和 Context 丢失期间不接受下降；
12. 真实组件随训练生命周期卸载和恢复；
13. resize/DPR 重建采样但不解除本局门控。

## 14. 手动验收

### 14.1 开发环境验证接口

打开本地开发页面后执行：

```js
const api = window.__shootbang_performance_test;
api.getMonitorConfig();
```

应包含：

```js
{
  ms: 250,
  iterations: 10,
  threshold: 0.75,
  lowerBoundRatio: 0.8,
  upperBoundRatio: 0.9,
  version: "drei-simple-v1"
}
```

模拟下降：

```js
api.reset();
api.startGame();
api.setActive(true);
api.simulateDecline({
  fps: 78,
  refreshrate: 100,
  averages: [70, 72, 74, 76, 78, 70, 72, 74, 76, 78],
});
api.getReports();
api.getCapturedEvents();
```

### 14.2 Preview/Production 真实体验

1. 打开 Preview 或 Production；
2. 开始游戏并完成 Pointer Lock；
3. 保持页面和窗口处于前台；
4. 先让游戏稳定运行，使监控获得观测峰值；
5. 使用 Chrome DevTools CPU Throttling 或制造持续主线程/GPU 负载；
6. 保持下降超过约 2.5 秒；
7. 在 Sentry 搜索 `Game performance decline detected`；
8. 检查 `monitor_version`、`component`、theme、DPR、视口、release 和 environment；
9. 新开一局再次触发，确认同一 Issue 下出现新的 Event。

如果从第一帧开始就被强烈限速，低峰值可能被当成基准；应先稳定采样再制造下降。

## 15. Sentry 事件后的定位流程

```
查看 Issue 与 Event 时间线
  → 按 release/environment 分组
  → 比较浏览器、系统、主题、DPR、视口
  → 检查下降比例和采样时长
  → 找共同条件
  → 在本地复现相同条件
  → Chrome Performance 分析主线程
  → Spector.js 分析 WebGL draw call/shader
  → 修复并观察新版本事件
```

常见线索：

| Sentry 现象 | 初步方向 |
|---|---|
| 只在某主题出现 | 粒子、阴影、后处理或特效成本 |
| 只在高 DPR 出现 | 像素填充量、阴影贴图或分辨率成本 |
| 某个 release 集中出现 | 渲染路径或依赖升级回归 |
| 只在某浏览器出现 | WebGL 实现、调度或浏览器差异 |
| 只有一个 Event | 线索不足，需要复现步骤或更多样本 |

Chrome Performance 用于回答“哪个主线程任务花了时间”：录制稳定帧和卡顿帧，查看 Script、Layout、Paint、Composite 和垃圾回收。Spector.js 用于回答“WebGL 这一帧做了什么”：查看 draw call、shader、纹理、framebuffer 和状态切换。

## 16. 能力与限制

能够回答：

- 是否发生持续相对性能下降；
- 哪个 release/environment 受影响；
- 发生时的主题、DPR、视口和训练时长；
- 观测峰值、平均值、最近值和下降比例；
- 是否在多个训练局或用户中重复。

不能直接回答：

- 哪个 JavaScript 函数阻塞了主线程；
- 是 CPU、GPU、shader、浏览器扩展还是系统调度；
- 某一帧的全部 WebGL 调用；
- 用户完整鼠标轨迹或操作回放；
- 仅凭一条 Event 在本地 100% 复现。

性能 Event 是“发现和缩小范围”的工具，不是完整 APM 或自动根因分析系统。

## 17. 成本与隐私边界

监控成本控制：

- 直接使用 R3F 真实循环，不创建额外 RAF；
- 不在每帧更新 React state；
- 不保存已完成窗口的原始样本；
- 每局最多创建一条自定义 Event；
- 开发和自动化测试只使用内存接口；
- 不启用 Tracing、Replay、Profiling 和 Logs。

Event 不包含用户身份、鼠标轨迹、射击轨迹、灵敏度、音量或反馈正文。Preview / Production Event 仍会产生 Sentry 网络发送和事件额度消耗；这是一条经过持续下降判断和每局门控后的低频诊断链路。

## 18. 工程取舍

### 为什么不保证固定 60 FPS

60 FPS 对 60Hz 设备可能合理，但高刷新率设备、浏览器环境和显示器条件不同。第一版先观察相对下降，等真实数据证明需要统一体验下限后再分档。

### 为什么不使用单帧阈值

一帧变慢可能只是偶发调度噪声。持续判断更接近用户感知的“卡顿”，也减少 Sentry 噪声。

### 为什么不自动降低画质

监控只负责观察和上报，不改变 DPR、主题特效、目标渲染或游戏难度。自动优化是另一项产品策略。

### 为什么固定 fingerprint

固定 fingerprint 把同类 Event 聚合到一个 Issue，便于观察总体分布；消息中的游戏编号保留每局差异。

## 19. 后续演进触发条件

1. 事件集中在某主题或 DPR：先修复对应渲染成本。
2. 事件很多但缺少主线程线索：按比例评估 Tracing 或 LoAF 摘要。
3. 低帧设备从第一帧开始不触发：增加稳定期或固定最低体验下限。
4. 需要连续时间线：设计窗口摘要，不恢复逐帧上报。
5. Event 网络和额度成本过高：增加客户端队列或更严格采样。
6. 用户能稳定复现但本地难以复现：增加复现环境表单，不直接开启全量 Replay。

## 20. 简历写法

### 一句话版本

为 React Three Fiber FPS 热身应用设计轻量级掉帧监控，基于 Drei `PerformanceMonitor` 在有效训练生命周期内检测持续相对性能下降，并以最小环境上下文上报 Sentry。

### 项目亮点

- 在 R3F 真实渲染循环中接入 Drei `PerformanceMonitor`，以 250ms/10 次采样和相对观测峰值边界检测持续性能下降，兼容 60Hz 与高刷新率设备。
- 设计完整生命周期过滤，只在 playing、Pointer Lock、页面可见、窗口聚焦、倒计时结束和 WebGL Context 正常时采样，避免暂停、失焦和后台节流误报。
- 使用纯 TypeScript 函数拆分边界计算、报告生成、每局一次门控和 Sentry Event 构造，开发/生产共用逻辑并通过 Playwright 注入测试快照。
- 以固定 fingerprint 聚合同类 Sentry warning Event，同时保留 release、environment、主题、DPR、视口和训练时间等最小诊断上下文，不发送用户操作轨迹或原始逐帧数组。
- 采用“发现异常 → Sentry 缩小环境范围 → Chrome Performance/Spector.js 本地复现定位”的分层性能分析流程，避免把轻量监控 SDK 变成完整性能分析器。

不建议在没有真实数据时写：

- “保证所有设备 60 FPS”；
- “自动定位 GPU/CPU 根因”；
- “完整 APM 或全量性能追踪”；
- “100% 检测所有卡顿”；
- “性能监控零网络成本”。

## 21. 面试讲解模板

Shootbang 是一个浏览器 FPS 热身工具，游戏使用 React Three Fiber 渲染。上线前我需要知道真实用户是否遇到持续掉帧，但不希望一开始就把 Tracing、Replay、逐帧数组和复杂 Long Task 分析全部加入客户端。

我选择 Drei 的 PerformanceMonitor，在 R3F 的真实 Canvas 渲染循环中每 250ms 采样，10 次形成约 2.5 秒的判断周期，以当前有效训练片段的观测峰值计算 80%/90% 相对边界。监控组件只在 playing、未暂停、倒计时结束、Pointer Lock 锁定、页面可见、窗口聚焦且 WebGL Context 正常时挂载；暂停、失焦、隐藏页面、resize、DPR 变化和 Context 丢失都会清理或重建采样状态。

下降回调触发后，我用纯函数构造最小报告，包含峰值、平均值、最近值、下降比例、采样时长、主题、DPR、视口和有效训练时间。同一局只允许一个报告，Preview / Production 使用 warning 级别和固定 fingerprint 交给 Sentry，开发和测试则保存到内存接口。这样不同用户的同类问题进入一个 Issue，但每局仍有独立 Event。

我没有声称 Sentry 可以直接找出 CPU 或 GPU 根因。它负责发现问题、聚合环境和 release；如果事件显示某个主题或 DPR 相关，我再用相同条件在本地通过 Chrome Performance 分析主线程，必要时用 Spector.js 分析 WebGL draw call 和 shader。

## 22. 常见追问

**为什么不用固定 100ms 慢帧阈值？**  
单帧慢可能只是调度噪声，且不同刷新率设备的自然帧时间不同。第一版目标是持续性能下降，不是记录每个偶发慢帧。

**为什么使用相对峰值而不是显示器刷新率？**  
浏览器不一定提供统一可靠的有效刷新率，Drei 已经提供当前观测峰值。它不是完美基准，但能用较少代码覆盖不同设备。

**同一局为什么只报一次？**  
持续下降可能连续触发回调。每局一次保留最小证据并控制噪声；若需要时间序列，再设计摘要方案。

**Sentry 收到一个 Issue 是不是只发生一次？**  
不是。固定 fingerprint 会聚合同类 Event。消息带本地游戏编号，进入 Issue 后可以查看每个 Event 的时间、release 和环境。

**Sentry 能直接告诉你掉帧原因吗？**  
不能保证。它提供影响范围和复现条件；Chrome Performance 负责主线程任务，Spector.js 负责 WebGL 层，三者职责不同。

**为什么不把每帧 FPS 直接上传？**  
网络请求、事件数量、存储和隐私成本都高，原始数组也不等于根因。先上传聚合指标，只有真实问题证明信息不足时再增加采样诊断。

## 23. 代码索引

| 模块 | 文件 |
|---|---|
| 纯性能逻辑 | `lib/performanceMonitoring.ts` |
| R3F 监控组件 | `components/r3f/FramePerformanceMonitor.tsx` |
| Canvas 挂载位置 | `components/r3f/SceneCanvas.tsx` |
| Playwright 用例 | `tests/performance.spec.ts` |
| Sentry 浏览器初始化 | `instrumentation-client.ts` |
| Sentry 构建与 tunnel | `next.config.ts` |
| 错误监控与用户反馈记录 | `docs/feedback.md` |
