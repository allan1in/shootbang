# 产品行为分析（PostHog）

## 目标与决策方式

目的：了解用户能否顺利完成训练、是否愿意重复使用，以及哪些功能值得继续投入。
第一版通过显式事件记录关键行为。每一项统计都对应可采取的产品行动，不以收集更多数据为目标。

| 产品问题 | 观察指标 | 可能的改进方向 |
| --- | --- | --- |
| 推广是否带来可使用产品的人？ | 来源 → 访问 → 移动端提示 / 电脑端可用 | 移动访问多时，在推广中说明需 PC；比较渠道带来的真实训练人数 |
| 电脑用户为什么没开始？ | 设备通过 → Renderer 就绪 → 点击开始 → 开始成功 | 加载阶段流失优先查 Sentry；就绪后不点击开始检查文案；点击后失败检查 Pointer Lock |
| 训练是否符合预期？ | 完成率、主动中途退出、连续训练次数 | 按训练时长、目标大小、网格和主题分组，检查难度或时长是否不合适 |
| 新功能是否被发现、被使用？ | 设置打开、分类查看、实际保存、训练时配置 | 分类很少被查看时优化入口；查看但未保存时检查交互；保存后实际使用才算采用 |
| 用户反馈是否受阻？ | 打开 → 提交 → 成功 / 失败，发送耗时 | 失败多检查服务；耗时高再评估等待体验优化 |
| 产品有长期价值吗？ | 首次有效完成训练后，再次训练的周留存 | 推广带来的用户会用但不回访时，优先访谈和检查使用场景，而不是盲目继续引流 |

所有正式报表筛选 `environment = production`。先累计 3～4 周，展示人数和比例；未结束的周期不与完整周期直接比较。分组差异只能提示关联，不能证明某个主题或功能导致留存变化。

## 已实现的事件

| 事件 | 准确触发时机 | 特有字段 |
| --- | --- | --- |
| `$pageview` | 每次文档初始化一次，React 重渲染不重复 | 无 |
| `mobile prompt shown` | 设备识别完成并显示 PC 提示，一次/页面 | 无 |
| `desktop visit eligible` | 通过现有设备拦截，一次/页面 | 无 |
| `renderer ready` | Renderer 创建成功，一次/页面 | `elapsed_ms`：导航开始到就绪的墙上时间，含后台停留 |
| `renderer slow` | 已有启动监控认定慢加载，一次/阶段/页面 | `stage`，仍可随后 ready |
| `renderer failed` | WebGL 检测或初始化明确异常，一次/页面 | `stage`；详细异常仍在 Sentry |
| `training start requested` | 点击开始或重新开始 | `source`：`idle` / `playing` / `finished` |
| `training start failed` | 原始和普通 Pointer Lock 均失败 | `source`、`reason=pointer_lock` |
| `training started` | Pointer Lock 成功，新一轮进入 playing（含准备倒计时） | 训练配置、`run_id`、`pointer_input_mode` |
| `training completed` | 计时归零且最终成绩已写入 | 同轮训练配置和 ID、`hits`、`total_shots`、`accuracy`、`average_reaction_ms` |
| `training abandoned` | 未完成的一轮回首页，或成功开始另一轮 | 同轮训练配置和 ID、`reason=home/restart`、`active_seconds` |
| `settings opened` | 点击设置入口 | 无 |
| `settings tab viewed` | 用户切换设置分类 | `tab=training/crosshair/experience`；初始默认训练页不单独记录 |
| `settings saved` | 主设置保存，全部正式设置写入完成 | 保存后的训练配置、`changed_fields` |
| `settings dismissed` | 主设置取消、Esc 或叉号关闭 | 无；颜色子页面的取消不算关闭设置 |
| `feedback opened` | 从首页、暂停或结算页打开反馈 | `source`：对应游戏状态 |
| `feedback submitted` | 合法内容开始一次请求 | 随机 `attempt_id`；每次重试独立 |
| `feedback sent` | 客户端收到接口成功响应 | 同一次 `attempt_id`、`elapsed_ms` |
| `feedback failed` | 收到拒绝响应、网络错误或响应解析失败 | 同一次 `attempt_id`、`elapsed_ms`、`reason` |

说明：

- 暂停/继续不产生新的 `training started`，不改变 `run_id`。
- 重新开始成功后才结束上一轮；如果指针锁定失败，旧一轮还可恢复。
- `active_seconds` 不包含暂停及准备倒计时。
- `accuracy` 为 0～100 的整数百分比。`average_reaction_ms` 沿用项目现有平均命中间隔算法，不代表实验室意义的视觉反应时。
- `feedback sent` 代表接口接受发送，不代表邮件进入收件箱或被阅读。
- 关闭标签页、崩溃、断网不保证可以上报，所以不在卸载时伪造确定的 abandoned。已开始但未完成只能标为“未观察到完成”，不能全部解释成用户主动放弃。
- 不记录每次射击、鼠标移动、目标刷新、逐帧 FPS、滑块拖动和颜色选择过程。

## 数据字段

每个事件包含：

- PostHog 匿名 `distinct_id`（同浏览器持久化）、会话 ID、事件时间。
- `page_id`：每次打开/刷新生成，用于保持一次访问内的漏斗。
- `environment`、`release`：由 Vercel 构建时注入环境及提交 SHA；本地为 development/local。
- `schema_version=1`：区分埋点口径的版本。
- 路径和主机名、浏览器/系统名称及版本、设备类别、屏幕/视口大小。
- `referrer_host`：来源域名，不含来源页面路径和参数；直接访问可能为空。
- `utm_source` / `utm_medium` / `utm_campaign`：仅接受 1～80 位英文字母、数字、下划线、连字符。只表示本次落地来源，不在无来源的回访中虚构归因。

训练配置只包含：

| 字段 | 示例 | 用途 |
| --- | --- | --- |
| `duration` | 15 / 30 / 60 / 120 | 不同时长的使用、完成情况 |
| `theme` | default / thunderstorm / blizzard | 主题实际使用 |
| `sensitivity_mode` | cs2 / valorant / delta | 玩家群体和灵敏度模式采用情况 |
| `grid_size` | 3～6 | 网格难度偏好 |
| `target_size` | tiny / small / default / large / huge | 目标大小偏好 |
| `crosshair_customized` | true / false | 是否使用非默认准星 |
| `sound_enabled` | true / false | 声音是否开启 |

`changed_fields` 只记录发生变化的字段名称：sensitivity_mode、sensitivity、duration、grid_size、target_size、crosshair、theme、volume。没改直接保存时为 `[]`，不能算成功采用了新功能。

不发送灵敏度具体数值、准星具体颜色/尺寸、反馈正文、邮箱、完整 UA、错误堆栈、任意 URL 查询参数或片段。不调用 identify，不创建用户画像。使用 `before_send` 白名单过滤额外 SDK 字段，并禁用位置推断。网络连接本身仍会到达服务端，IP 是否存储必须在 PostHog 项目设置中关闭。

## 推荐的六张报表

### 1. 首次训练漏斗

`$pageview → desktop visit eligible → renderer ready → training start requested → training started → training completed`

在 Funnels 中创建，筛选 production，选择按独立用户或会话查看，保持 `page_id` 相同，转换窗口可先设 30 分钟。这个漏斗显示一次访问内的转化；用户数转化率不是每一轮训练的完成率。

另建移动端提示人数/访问人数趋势。不要把手机提示当成初始化异常。

### 2. 每轮训练完成与退出

开始数按 `training started` 的唯一 `run_id`；完成数按 `training completed` 的唯一 `run_id`。以开始时间建立一组 run，在足够完成的时间之后匹配结果，避免直接用两个时间范围内的总数相除造成跨界误差。

完成率 = 该组 run 中已完成的数量 / 该组开始数量。
主动退出比例按 `training abandoned` 的 home/restart 分组；剩余为未观察到完成或退出。当天尚在进行的轮次暂不作失败处理。

再看“有效完成”：`total_shots > 0`。只有等时间结束、从未射击的轮次不算有效体验。

### 3. 功能采用

用 `training started` 按 theme / sensitivity_mode / crosshair_customized 分组。默认先统计独立用户，另看轮次，避免少数重度用户淹没其他人的偏好。

将设置打开 → 查看分类 → 保存且 changed_fields 包含对应字段，与后续训练采用结合起来看。用户未打开设置但沿用以前保存值也算使用，不能只统计本次设置保存。

### 4. 周留存

Retention 设置：

- Start：`training completed`，过滤 `total_shots > 0`。
- Return：`training started`。
- Cohort：`First ever occurrence`；Interval：Week。
- Reference：Period 0；Returning criteria：On。
- 全局过滤 production。

它衡量“首次有效完成训练的人，之后每周是否回来”。匿名 ID 只在同浏览器/同站点存储内稳定；无痕、清空存储、换设备会形成新用户。接入前的历史训练无法恢复。

### 5. 反馈体验

`feedback opened → feedback submitted → feedback sent` 按同一 page_id 看用户漏斗。
请求级成功率使用 attempt_id 关联 submitted 与 sent/failed；按 reason 看限流、服务拒绝和网络/响应异常。对 sent 与 failed 分别观察 elapsed_ms 的 P50/P90，避免只看平均值。

### 6. 推广渠道质量

按 utm_source / utm_campaign 比较独立访问者、通过设备检查的人、开始训练的人和有效完成的人。相同曝光量下，更多有效完成者的渠道更值得投入。

例如发布网址：

```text
https://shootbang.allan1in.top/?utm_source=douyin&utm_medium=social&utm_campaign=demo_04
```

抖音内跳转、复制链接、手动输入网址可能丢失来源。这时不能确定是哪个视频带来的访问。查看渠道留存应建立“从该活动首次有效完成”的用户队列，再观察他们后续回访，不要求回访事件继续携带同一个 UTM。

## 接入配置：你需要操作的部分

1. 在 PostHog Cloud 创建 Shootbang 项目，选择 Product Analytics。复制项目安装页的 **Project token** 和 **API/ingestion host**。不要使用个人 API Key；也不要把 dashboard 地址当 ingestion host。
2. 在项目设置查找 IP data capture / Privacy，开启 **Discard client IP data**。不要另外启用 Replay、Autocapture、Heatmaps、Surveys、Logs 或 Error Tracking；异常继续由 Sentry 处理。
3. 在 Vercel → Shootbang → Settings → Environment Variables 添加下面两个变量，分别勾选 Preview 和 Production（可使用同一 PostHog 项目）：

   ```dotenv
   NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=项目安装页的值
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
   ```

   EU 项目使用安装页给出的 EU ingestion host。host 必须与项目所在区域匹配。
4. 先部署 Preview。在配置环境变量后必须重新构建部署；NEXT_PUBLIC 变量是构建时注入，旧部署不会自动改变。
5. 到 PostHog 的 Events/Activity 中筛选 `environment=preview`，执行下文验收。通过后再发布 Production；所有正式图表固定 production 筛选。
6. 在 Billing/Usage 中查看该账户当前的免费额度和支出限制；如果账户支持，设置不接受付费超额的上限。不要仅凭“事件种类少”判断总量。
7. 按上面六项创建 Dashboard。先积累数据，再每周选一个有数据支持的问题进行改进，记录改动前后同口径的样本和转化。

Vercel 自动注入环境与 SHA，无需手填环境/版本变量。没有 PostHog token 或 host 时完全停用采集，游戏照常运行。

## 验收步骤

1. 打开 Preview，观察 `$pageview → desktop visit eligible → renderer ready` 各一次。
2. 设置中选一个游戏、改变训练时长或准星，再保存；检查 settings saved 的 changed_fields 和保存后的配置。另一次修改后取消，不应产生 saved。
3. 开始训练，暂停再继续，确认只有一次 started；完成后 completed 的 run_id 与 started 相同。
4. 新一轮中回首页，观察 abandoned reason=home；重新开始时旧轮 reason=restart，新轮 ID 不同。
5. 发送一条测试反馈，观察 submitted 与 sent，attempt_id 一致且没有反馈正文。成功不是邮箱投递保证。
6. 刷新页面重复训练，PostHog distinct_id 应相同，page_id/run_id 应变化。这是将来计算留存的基础。
7. 手机打开应该只有 pageview + mobile prompt shown，不应有 renderer ready 或 training started。
8. 在浏览器 Network 中阻止 PostHog 域名并刷新，检查训练仍可正常进行；这种情况下事件缺失是预期行为。
9. 检查生产 event 中没有 feedback content、精确灵敏度、完整 URL 参数、个人资料，也没有 Preview 数据混入正式报表。

开发测试采用只在 development 启用的内存收集器，不发送真实 PostHog 事件；反馈接口由 Playwright 拦截，不发送邮件。

## 成本和性能

SDK 独立异步加载，不阻塞页面 hydration 或 Renderer。早期事件保留原时间，在最多 100 条的内存队列中等待 SDK；失败则放弃统计。正常上传使用 SDK 批量队列，保留其重试行为。

一次电脑访问完成一轮约 6 个事件（pageview、eligible、ready、request、started、completed），之后每轮通常再加 3 个；设置、反馈和异常才产生额外事件。100 次访问/天、每次 5 轮、均无额外交互，约为 54,000 事件/30 天；这是估算，不是额度保证。

当前客户端直接向 PostHog ingestion host 发送，不消耗额外 Vercel 函数执行；仍有 SDK 静态资源传输。大陆网络或拦截器可能漏报，需用真实网络验收。漏报不应阻止用户训练。

完整 SDK 配置关闭自动点击、页面离开、录像、热力图、性能指标、异常、调查、引导、外部扩展与功能开关请求；仅发送事件白名单。现有 Vercel Analytics 和 Sentry 配置保留。

## 参考

- [PostHog Next.js integration](https://posthog.com/docs/libraries/next-js)
- [PostHog JavaScript configuration](https://posthog.com/docs/libraries/js/config)
- [PostHog Retention](https://posthog.com/docs/product-analytics/retention)
- [PostHog IP data configuration](https://posthog.com/docs/privacy/gdpr-compliance)
