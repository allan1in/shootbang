# Shootbang 搜索可发现性与 SEO 基础建设总结

> 文档日期：2026-07-22  
> 技术栈：Next.js 16、React 19、Vercel、Google Search Console、百度搜索资源平台、Cloudflare DNS  
> 正式域名：`https://shootbang.allan1in.top/`  
> 用途：记录搜索引擎接入、页面元数据、首次 HTML 渲染、图标调整、工程取舍、验证方法，并为简历和面试准备提供事实依据。

## 1. 项目背景

Shootbang 是一个浏览器端 FPS 热身工具。产品在功能、错误监控和反馈链路完成后，需要解决一个新的问题：

> 正在寻找“FPS 热身”“在线练枪”等工具的用户，即使此前不知道 Shootbang，也应当有机会通过搜索引擎发现并理解它。

搜索可发现性不是单一代码功能，而是一条完整链路：

```text
稳定正式域名
  → 搜索平台验证所有权
  → 主动提交首页 URL
  → 爬虫发现并访问页面
  → 读取标题、描述和正文
  → 搜索引擎决定是否收录
  → 用户产生搜索曝光与点击
```

需要明确：

- 提交 URL 不等于保证收录；
- 收录不等于获得靠前排名；
- metadata 不会自动制造搜索流量；
- SEO 的作用是降低搜索引擎发现、理解和正确展示页面的阻力；
- 最终是否值得继续投入，应由真实曝光、查询词和点击数据判断。

## 2. 第一阶段目标与约束

第一阶段采用“单页产品的最小 SEO”策略，只解决当前真实存在的问题：

1. 建立唯一、稳定的正式域名。
2. 让 Google 与百度知道网站存在，并验证站点所有权。
3. 主动提交首页，建立收录基线。
4. 使用准确的标题和 description 表达产品定位。
5. 让首次 HTML 直接包含真实产品内容，而不是依赖浏览器执行游戏 JavaScript 后才出现。
6. 更新小尺寸图标，提高浏览器标签页和搜索展示辨识度。

明确不在第一阶段实现：

- 为 SEO 创建大量低价值内容；
- 关键词堆砌；
- 结构化数据和富媒体搜索结果；
- 多语言与 `hreflang`；
- 自动提交 API；
- 国内所有搜索引擎的重复配置；
- 仅为形式完整而创建当前没有实际价值的技术文件。

## 3. 搜索引擎工作流程

搜索引擎通常经历三个阶段：

```text
发现 Discovery
  → 知道 URL 存在

抓取 Crawling
  → 向服务器请求 HTML、资源和页面内容

索引 Indexing
  → 分析内容并决定是否存入搜索数据库
```

当用户执行搜索时，搜索引擎再从索引中选择结果并排序。

Shootbang 当前完成的是“帮助发现”和“提高抓取内容质量”，没有也不能通过代码强制搜索引擎收录或排名。

### 3.1 主动提交的真实作用

Google URL Inspection 和百度普通收录都是“主动告诉搜索引擎这个 URL 存在”。它们可以缩短等待自然发现的时间，但搜索引擎仍会自行判断：

- 页面是否能够访问；
- 是否返回 HTTP 200；
- 是否具有可索引内容；
- 是否与其他页面重复；
- 内容是否值得进入索引。

因此主动提交是发现入口，不是排名购买，也不是收录保证。

## 4. 正式域名与环境边界

正式产品地址确定为：

```text
https://shootbang.allan1in.top/
```

使用独立子域名的原因：

- Shootbang 与未来其他个人项目的数据边界清晰；
- Search Console 和百度平台可以只观察当前产品；
- Vercel 部署与产品品牌域名解耦；
- 后续迁移托管平台时，对外地址可以保持不变；
- 用户分享时不会暴露随机 Vercel Deployment URL。

环境职责为：

| 环境 | 用途 | 是否面向搜索引擎 |
|---|---|---|
| Local | 开发与自动化测试 | 否 |
| Preview | 功能验收、Turnstile/Resend 等真实集成测试 | 否，受 Vercel Authentication 保护 |
| Production | 对外正式产品 | 是 |

Preview 的哈希部署地址会随部署变化，因此不能作为搜索平台和外部推广的稳定入口。正式域名始终指向 Production。

## 5. Google Search Console 接入

### 5.1 Property 类型选择

Google Search Console 提供两种资源类型：

| 类型 | 覆盖范围 | 验证方式 |
|---|---|---|
| Domain Property | 指定域名及其协议和下级子域名 | DNS 验证 |
| URL-prefix Property | 指定协议和 URL 前缀 | 支持多种验证方式 |

项目最终选择 Domain Property，并直接填写：

```text
shootbang.allan1in.top
```

这样数据只围绕 Shootbang 子域名，不会把根域名未来的其他产品混在一起。

### 5.2 Cloudflare DNS 验证

域名 DNS 由 Cloudflare 管理。Search Console 提供 TXT 验证记录后，在 Cloudflare DNS 中添加对应记录，Google 查询 DNS 并确认域名所有权。

DNS 验证记录应长期保留。它只用于证明域名控制权，不会改变网站流量转发，也不能替代 Vercel 的域名配置。

### 5.3 URL Inspection 与收录请求

验证完成后，在 URL Inspection 中检查：

```text
https://shootbang.allan1in.top/
```

首次检查时，Google 尚未发现该 URL，页面显示未收录。随后执行“请求编入索引”，把首页加入优先抓取队列。

当时建立的基线为：

```text
日期：2026-07-22
资源：shootbang.allan1in.top
状态：首页尚未被 Google 识别
操作：已请求编入索引
页面 metadata：尚未完成本轮优化
```

保留这个基线的意义是：以后可以区分“提交前完全未发现”和“优化后开始出现抓取、索引或曝光”的状态变化，但不能把所有增长都归因于某一项 SEO 修改。

### 5.4 Search Console 后续关注指标

| 指标 | 能回答的问题 |
|---|---|
| 索引状态 | Google 是否把首页加入索引 |
| 抓取时间 | Googlebot 最近何时访问页面 |
| 展示次数 Impressions | 页面在搜索结果出现了多少次 |
| 点击次数 Clicks | 用户从 Google 进入了多少次 |
| CTR | 搜索结果出现后有多少比例被点击 |
| Query | 用户通过什么搜索词看见网站 |
| Position | 特定查询下的大致平均排名 |

Search Console 本身不会提升排名，它是提交、诊断和测量工具。

## 6. 百度搜索资源平台接入

### 6.1 添加站点

百度站点模型与 Google 不同，需要分别选择协议并填写域名：

```text
协议：https://
域名：shootbang.allan1in.top
```

最终站点为：

```text
https://shootbang.allan1in.top
```

站点领域选择：

- 游戏；
- 工具服务及在线查询。

前者描述使用场景，后者描述产品形态，没有为了覆盖更多关键词而选择不相关分类。

### 6.2 HTML 标签验证

百度生成站点验证 `<meta>` 后，将其加入 `app/layout.tsx` 的 `<head>`：

```html
<meta name="baidu-site-verification" content="..." />
```

部署到 Production 后，百度访问正式首页并读取该标签，从而确认站点所有权。

这类验证值会公开出现在 HTML 中，作用是站点归属证明；它与百度普通收录 API 的私有推送 token 不同。

验证标签应长期保留，否则平台后续重新检查时可能失去验证状态。

### 6.3 普通收录

站点验证后，通过“资源提交 → 普通收录 → 手动提交”提交：

```text
https://shootbang.allan1in.top/
```

三种普通收录方式的区别：

| 方式 | 提交内容 | 适用场景 |
|---|---|---|
| 手动提交 | 在平台粘贴少量 URL | 当前只有一个首页的 Shootbang |
| Sitemap | 提交一份全站 URL 清单 | 页面数量增多后 |
| API 提交 | 发布内容时由服务端自动推送 URL | 持续产生大量新页面的网站 |

当前选择手动提交，因为最简单且与站点规模匹配。

### 6.4 为什么不使用快速收录

快速收录面向高时效、持续产生新内容的站点，例如新闻和频繁更新的内容平台。Shootbang 的首页长期稳定，不依赖分钟级发现，也不持续产生新 URL。

普通收录已经能够主动通知百度首页存在；无论普通还是快速收录，都不能保证最终收录。

### 6.5 推送 token 安全

百度普通收录 API 页面会显示站点推送 token。该 token 不应出现在：

- Git 仓库；
- 文档和简历；
- 公开截图；
- 客户端 JavaScript；
- Issue 或日志。

如果 token 出现在公开截图中，应在百度平台使用“修改推入密钥”重新生成。当前项目没有使用百度 API 提交，因此代码和 Vercel 环境变量中都不需要保存它。

## 7. 标题与 Description 优化

### 7.1 修改前

```text
标题：shootbang
描述：浏览器里的 3D 射击场
```

问题：

- `shootbang` 只能表达品牌名，陌生用户不知道产品用途；
- “3D 射击场”容易被理解为射击小游戏；
- 没有准确表达核心定位“FPS 热身”；
- 搜索结果中缺少“不需要下载”的产品优势。

### 7.2 修改后

```text
标题：Shootbang - FPS 热身训练
描述：无需下载，打开浏览器即可进行 FPS 热身
```

配置位于 `app/layout.tsx`：

```ts
export const metadata: Metadata = {
  title: "Shootbang - FPS 热身训练",
  description: "无需下载，打开浏览器即可进行 FPS 热身",
};
```

### 7.3 影响范围

标题可能用于：

- 浏览器标签页；
- 收藏夹与历史记录；
- 搜索结果标题；
- 部分分享场景的默认标题。

Description 可能用于搜索结果摘要，但搜索引擎会根据用户查询和页面内容决定是否采用，也可能自动改写。

这次优化的目标不是关键词堆砌，而是让品牌名和产品用途在一行内同时成立：

```text
Shootbang            → 品牌
FPS 热身训练 → 产品类别与核心用途
```

## 8. Favicon 精修

原图标使用黑色圆底、白色圆环和十字准星，与产品的 FPS 主题和极简界面一致，因此保留了整体概念，只调整比例：

- 外圆直径保持 `512`；
- 白色圆环半径由 `160` 调整为 `128`，即外圆半径的一半；
- 十字准星总长度调整为外圆直径的三分之二，约 `341.33`；
- 线宽、端点圆角和黑白配色保持不变。

对应文件：`app/icon.svg`。

图标主要改善浏览器标签页、收藏夹和搜索结果中的辨识度，不是搜索排名因素。

## 9. 首次 HTML 与加载体验优化

### 9.1 修改前的加载链路

首页 `app/page.tsx` 只渲染 `MobileGate`：

```text
Next.js 返回 HTML
  → MobileGate 的 ready 初始为 false
  → return null
  → 首次 HTML 没有产品正文
  → 浏览器下载并执行 JavaScript
  → useEffect 检测设备
  → ready=true
  → 动态加载 GameBoard
  → 显示“加载中…”
  → GameBoard 完成后显示首页
```

关键代码原本是：

```tsx
if (!ready) return null;
```

`useMobileDetect` 必须在浏览器中读取 `window`、屏幕宽度和触摸能力；服务端不会执行 `useEffect`，因此首次渲染时 `ready` 必然为 `false`。

`GameBoard` 同时设置了 `ssr: false`，因为 Three.js、WebGL、Pointer Lock 和屏幕信息依赖浏览器环境。禁用游戏主体 SSR 是合理的，问题只是服务端没有提供任何有意义的替代内容。

### 9.2 新的 LoadingScreen

新增 `components/LoadingScreen.tsx`，内容复用正式首页已有信息：

```tsx
<main>
  <h1>Shootbang</h1>
  <p>在限定时间内尽可能多地命中目标</p>
  <div role="status">
    <Spinner />
    <span>加载中…</span>
  </div>
</main>
```

它不访问浏览器 API，可以参与 Next.js 首次预渲染。

`MobileGate` 改为：

```tsx
if (!ready) return <LoadingScreen />;
```

因此首次 HTML 可以直接包含真实的 `<h1>` 和说明文字，而不是空正文。

### 9.3 统一两段加载状态

动态加载同样使用该组件：

```tsx
const GameBoard = dynamic(() => import("@/components/GameBoard"), {
  ssr: false,
  loading: LoadingScreen,
});
```

新流程为：

```text
Next.js 首次 HTML：LoadingScreen
  → 浏览器 hydration
  → 检测设备
  → 移动端：MobilePrompt
  → 桌面端：LoadingScreen 继续占位
  → GameBoard 下载并初始化
  → IdleScreen 正式首页
```

设备检测与游戏代码下载不再分别显示“空白”和“单行加载文字”。

### 9.4 shadcn Spinner

新增 `components/ui/spinner.tsx`，采用 shadcn 官方开放代码风格：

```tsx
<LoaderIcon
  role="status"
  aria-label="Loading"
  className={cn("size-4 animate-spin", className)}
/>
```

项目已经依赖 `lucide-react`，因此没有增加新 npm 依赖。

选择 Spinner 而不是其他组件的原因：

- 游戏代码动态加载没有可靠的百分比，Progress 会产生虚假精度；
- 页面不是卡片、表格或表单结构，Skeleton 没有合适的内容骨架；
- Spinner 能准确表达“正在等待但无法计算进度”。

### 9.5 标题跳动修复

加载完成后曾出现标题垂直跳动。原因是：

- LoadingScreen 的 Spinner 行高度小于正式首页按钮行；
- 两个界面都对整个内容组垂直居中；
- 第三行高度变化导致整体重新定位。

正式按钮高度为 Tailwind `h-8`，即 `32px`。加载状态行同样固定为 `h-8` 后，两组内容总高度一致，标题和说明在切换时保持位置稳定。

### 9.6 SEO 与产品体验价值

这项修改同时改善两方面：

产品体验：

- 慢速网络下不再先看到空白；
- 加载组件与现有 shadcn 视觉体系一致；
- 加载完成时减少布局移动。

搜索可发现性：

- 首次 HTML 包含真实产品名称和说明；
- 不执行完整游戏 JavaScript 的爬虫也能读取基本正文；
- 没有向爬虫提供用户不可见的隐藏关键词，不构成 cloaking；
- Three.js 和 WebGL 仍只在浏览器加载，没有为了 SEO 强行服务端渲染游戏。

## 10. 当前没有实现的项目

### 10.1 Canonical

Canonical 用于告诉搜索引擎多个相似 URL 中哪个是正式版本，例如：

```html
<link rel="canonical" href="https://shootbang.allan1in.top/" />
```

当前暂缓原因：

- 只有一个公开页面；
- Preview 受 Vercel Authentication 保护；
- 对外统一推广正式域名；
- 重复 URL 风险较低。

需要注意：页面少不代表永远不需要 canonical，因为一个页面仍可能通过正式域名、Vercel 域名或带参数 URL 访问。它属于低成本防御项，但目前不是上线阻塞项。

触发条件：出现公开别名、参数 URL 被索引、Search Console 选错规范网址，或新增多个页面时再添加。

### 10.2 robots.txt

`robots.txt` 用于管理爬虫可以访问哪些 URL，不是安全或保密机制。

当前暂缓原因：

- 没有后台、筛选器、站内搜索或大量重复 URL；
- 不配置时正常爬虫默认可以访问公开首页；
- 错误的 `Disallow: /` 反而可能阻止整站抓取。

触发条件：出现不值得抓取的公开 URL、抓取异常，或需要统一声明 Sitemap 地址时再添加。

### 10.3 sitemap.xml

Sitemap 是公开 URL 清单，用于帮助搜索引擎发现站点页面。

当前暂缓原因：

- 只有一个首页；
- Google 和百度均已手动提交该 URL；
- 游戏的开始、暂停、设置和结算只是同一个 URL 内的状态，不是独立页面。

触发条件：新增 `/guide`、`/faq`、`/changelog` 等公开页面时创建，并同时提交给 Google 与百度。

### 10.4 分享预览图

Open Graph 图片影响 Discord、微信、X 等渠道的链接卡片，不直接影响搜索排名。

它仍然具有较高产品价值，但应在图标和品牌视觉确定后单独设计，不与本轮抓取优化混合。

### 10.5 其他暂缓项

- 360、搜狗、神马等国内搜索平台：先观察 Google 与百度是否产生真实数据；
- Bing Webmaster Tools：目标用户和推广渠道证明有需要时再接入；
- 结构化数据：当前没有适合的复杂内容类型；
- SEO 博客与内容矩阵：没有真实查询数据前不批量生产内容；
- 多语言：当前产品和界面以中文用户为主。

## 11. 验证方法

### 11.1 Metadata

部署后检查网页源代码：

```html
<title>Shootbang - FPS 热身训练</title>
<meta
  name="description"
  content="无需下载，打开浏览器即可进行 FPS 热身"
/>
```

浏览器标签页应显示新标题。搜索结果是否立即更新由搜索引擎重新抓取时间决定。

### 11.2 首次 HTML

区分两个概念：

- “查看网页源代码”展示服务器首次返回的 HTML；
- DevTools Elements 展示 JavaScript 执行后的实时 DOM。

部署后在网页源代码中搜索：

```text
Shootbang
在限定时间内尽可能多地命中目标
加载中…
```

这些内容应在首次 HTML 中存在，而不只是运行后的 Elements 面板中出现。

### 11.3 加载体验

使用浏览器 DevTools Network Throttling 模拟较慢网络：

1. 打开页面；
2. 确认立即出现产品标题、说明和 Spinner；
3. 确认不出现空白阶段；
4. GameBoard 完成后确认标题和说明位置不跳动；
5. 确认开始、设置、反馈按钮和游戏行为不变；
6. 移动端仍显示 PC 访问提示。

### 11.4 Google

在 Search Console URL Inspection 中定期检查：

- URL 是否已被 Google 发现；
- 是否允许抓取；
- 抓取到的页面标题和渲染结果；
- 是否已编入索引；
- Google 选择的规范网址；
- Performance 中是否出现 Query、Impression 和 Click。

不需要每天重复请求索引；重复提交不会保证提高优先级。

### 11.5 百度

在百度搜索资源平台关注：

- 索引量；
- 流量与关键词；
- 抓取频次；
- 抓取诊断与抓取异常；
- 普通收录提交反馈。

## 12. 数据归因与效果判断

SEO 结果可以测量，但不能简单证明某一次 metadata 修改单独造成了全部增长。流量还可能来自：

- Discord、社区或社交平台推广；
- 用户直接访问和分享；
- 产品品牌词增长；
- 搜索引擎算法和竞争结果变化；
- 页面速度和产品口碑变化。

合理判断方式是观察搜索渠道自身数据：

1. 是否从未发现变为已抓取、已索引；
2. 是否出现非品牌 Query，例如“FPS 热身工具”；
3. 展示次数和点击是否持续产生；
4. 标题调整后 CTR 是否出现长期变化；
5. 用户进入后是否真正开始训练，而不是立即离开。

当前没有足够流量时，不写“SEO 提升流量 XX%”。可以证明的是：

- 建立了 Google 与百度的站点所有权和提交入口；
- 首页已主动进入抓取队列；
- metadata 明确表达产品定位；
- 首次 HTML 从空正文变为包含真实产品内容；
- 未来能够通过平台数据判断搜索渠道是否值得继续投入。

## 13. 安全与隐私边界

本轮 SEO 配置不收集新的用户身份信息，也没有新增客户端分析 SDK。

需要区分：

| 数据 | 是否公开 | 处理方式 |
|---|---|---|
| Google/Baidu 站点验证记录 | 用于公开证明控制权 | 保留在 DNS 或 HTML |
| 百度普通收录 API token | 私有提交凭证 | 不进入代码、文档和截图 |
| Search Console 数据 | 站点管理数据 | 仅授权账号访问 |
| 搜索 Query 与点击统计 | 聚合平台数据 | 用于判断渠道效果 |

`robots.txt` 不能保护隐私页面；真正的私有环境继续依赖 Vercel Authentication、登录或服务端授权。

## 14. 测试与部署记录

相关提交：

| Commit | 内容 |
|---|---|
| `e94e71d` | `feat: add Baidu site verification` |
| `442f1c4` | `feat: improve site metadata` |
| `1e5fcda` | `feat: refine app icon` |
| `546ed07` | `feat: add server-rendered loading screen` |

已完成检查：

- 百度验证标签修改通过静态差异检查并成功推送；
- metadata 修改通过静态差异检查并成功推送；
- SVG 通过 XML 解析验证并成功推送；
- LoadingScreen、MobileGate 和 Spinner 的 ESLint 检查通过；
- 所有改动使用 Conventional Commit 格式提交；
- Vercel 由 `main` 推送触发 Production 自动部署。

当前本地完整 TypeScript 检查受到既有 `node_modules` 缺少 `resend` 模块影响：

```text
app/api/feedback/route.ts: Cannot find module 'resend'
```

该错误与本轮 SEO/LoadingScreen 改动无关，但仍应在下一次重建本地依赖后执行完整 TypeScript、Playwright 和 Production Build 回归。

最新 LoadingScreen 部署需要在 Vercel 显示 Ready 后进行一次 Production 手动验收，不能仅凭 Git Push 认定线上行为已经验证。

## 15. 关键工程取舍

### 15.1 为什么不一次做完整 SEO 清单

Shootbang 目前是单页工具，没有内容站的大量 URL、重复筛选和内部链接结构。直接照搬大型网站的 SEO 清单会增加配置和维护成本，却无法证明产生实际收益。

因此优先完成低成本、高相关性的发现与理解链路，等真实 Query 和索引问题出现后再扩展。

### 15.2 为什么保留 GameBoard 的 ssr:false

Three.js、WebGL、Pointer Lock 和设备检测依赖浏览器环境。强行让完整游戏参与服务端渲染会增加复杂度和 hydration 风险。

更合理的边界是：

```text
服务端：输出轻量、真实、可读的 LoadingScreen
浏览器：加载并运行完整 GameBoard
```

### 15.3 为什么不能加入只给爬虫看的隐藏文案

隐藏关键词可能让爬虫和用户看到不同内容，容易构成 cloaking，也破坏产品诚实性。

当前方案复用真实首页标题和说明，普通用户在加载阶段同样看得到，搜索引擎和用户获得一致信息。

### 15.4 为什么没有使用虚假进度条

动态 import 没有向 UI 暴露可靠的字节下载和初始化百分比。显示从 0% 到 100% 的模拟进度会给用户错误预期，因此选择表达不确定等待状态的 Spinner。

### 15.5 为什么先测量再扩大投入

SEO 的长期投入只有在搜索渠道真实产生曝光、点击和有效训练时才有意义。Search Console 与百度平台先建立数据入口；如果没有 Query 和自然流量，就不应为了简历或形式盲目建设内容矩阵。

## 16. 简历写法

### 16.1 一句话版本

为 Next.js 浏览器 FPS 热身工具搭建 Google/百度搜索可发现性链路，完成域名验证、主动收录、语义化 metadata 与服务端可读首屏，并保持 Three.js 游戏主体客户端按需加载。

### 16.2 可直接使用的项目亮点

版本 A，偏前端性能与 SEO：

- 优化 Next.js 16 单页 WebGL 应用的首次渲染边界，在保留 Three.js `ssr: false` 和动态拆包的同时，以服务端可渲染 LoadingScreen 替代空 HTML，使爬虫与慢网用户无需等待游戏 Bundle 即可获得真实产品标题和说明。
- 使用 shadcn Spinner 统一设备检测与动态 import 两段加载状态，并通过匹配正式按钮行高度消除加载完成时的标题布局跳动。
- 基于 Next.js Metadata API 重写产品标题与 description，将模糊的“3D 射击场”定位为“FPS 热身训练”，同时保持 UI 文案和游戏逻辑不变。

版本 B，偏上线与增长基础设施：

- 为独立产品子域名接入 Google Search Console Domain Property 与百度搜索资源平台，通过 Cloudflare DNS 和 HTML 标签验证建立站点所有权，并完成双搜索引擎首页主动提交。
- 根据单页产品规模评估 canonical、robots、Sitemap、快速收录和 API 推送的收益与风险，采用按需演进策略，避免将大型内容站方案机械套用到只有一个公开 URL 的工具产品。
- 建立索引、曝光、点击、CTR、Query 和有效训练转化的观测框架，区分搜索平台提交、页面技术优化与外部推广流量，避免对 SEO 效果进行无法验证的因果夸大。

### 16.3 不建议写的表述

在没有真实数据前，不写：

- “显著提升搜索排名”；
- “SEO 流量提升 XX%”；
- “保证 Google 与百度收录”；
- “完成完整搜索增长体系”；
- “实现服务端渲染的 Three.js 游戏”。

当前能够证明的是配置、实现、部署和数据观测入口已经建立；实际增长需要后续平台数据支持。

## 17. 面试讲解模板

### 17.1 两分钟版本

Shootbang 是一个基于 Next.js 和 React Three Fiber 的浏览器 FPS 热身工具。产品功能完成后，我开始解决搜索可发现性问题，但没有直接套用内容站的完整 SEO 清单，而是先建立最小闭环。

平台侧，我为独立子域名接入 Google Search Console Domain Property 和百度搜索资源平台，通过 Cloudflare DNS 与 HTML 标签完成所有权验证，并分别主动提交正式首页。页面侧，我把标题调整为“Shootbang - FPS 热身训练”，description 明确表达浏览器使用和无需下载。

进一步检查代码时，我发现首页虽然最终有 H1 和说明，但 MobileGate 在服务端因为设备检测未完成会返回 null，GameBoard 又设置了 ssr:false，所以首次 HTML 没有产品正文。我没有让 Three.js 服务端渲染，而是增加一个轻量 LoadingScreen：服务端直接输出真实标题和说明，浏览器 hydration 后继续检测设备并动态加载游戏。设备检测和 Bundle 下载共用 shadcn Spinner，加载行高度与正式按钮一致，避免切换时标题跳动。

对于 canonical、robots 和 Sitemap，我根据当前只有一个公开 URL、Preview 已受保护、首页已手动提交的事实选择暂缓。后续通过 Google/百度的索引、Query、曝光、点击和实际训练转化决定是否扩大 SEO 投入。

### 17.2 常见追问

**为什么 Client Component 的首次 HTML 会为空？**  
`"use client"` 本身不等于完全不服务端预渲染。这里真正的原因是 `ready` 初始为 `false`，组件在服务端执行到 `if (!ready) return null`；而设置 `ready=true` 的 `useEffect` 只能在浏览器运行。

**为什么不直接服务端渲染 GameBoard？**  
游戏依赖 WebGL、Pointer Lock、屏幕尺寸和浏览器事件。服务端缺少这些 API，强行 SSR 会增加复杂度。静态 LoadingScreen 与客户端 GameBoard 分工更清晰。

**为什么 Sitemap 和 robots.txt 没做？**  
当前只有一个已手动提交的公开 URL，也没有需要禁止抓取的页面。它们现在不是错误，只是收益很低；新增多个公开页面或出现抓取问题时再做。

**标题和 description 会直接提升排名吗？**  
不能保证。它们帮助搜索引擎和用户理解页面，并可能改善搜索结果点击率；搜索引擎仍可能改写标题或摘要。

**为什么 Search Console 不能证明 SEO 修改一定有效？**  
它可以测量自然搜索曝光、点击和查询词，但流量还会受到外部推广、品牌增长和算法变化影响。低流量阶段更适合观察长期趋势，而不是宣称单项修改具有严格因果关系。

**怎样验证首次 HTML 真的包含内容？**  
查看服务器返回的页面源代码，而不是只看 JavaScript 执行后的 Elements。搜索 `Shootbang`、首页说明和“加载中…”应能在首次响应中找到。

## 18. 代码与平台索引

| 模块 | 位置 |
|---|---|
| 全局 title、description、百度验证标签 | `app/layout.tsx` |
| 首页入口 | `app/page.tsx` |
| 设备检测和 GameBoard 动态加载 | `components/MobileGate.tsx` |
| 服务端可渲染加载界面 | `components/LoadingScreen.tsx` |
| shadcn Spinner | `components/ui/spinner.tsx` |
| 正式首页标题与操作入口 | `components/IdleScreen.tsx` |
| 设备检测逻辑 | `hooks/useMobileDetect.ts` |
| Favicon | `app/icon.svg` |
| Google 站点与索引数据 | Google Search Console |
| 百度站点与收录数据 | 百度搜索资源平台 |
| DNS 所有权记录 | Cloudflare DNS |
| 正式部署与域名 | Vercel Production |

## 19. 后续演进触发条件

只有出现对应证据时再增加能力：

1. 新增多个公开页面：创建 `sitemap.xml`，提交 Google 与百度。
2. 出现重复 URL 或规范网址选择错误：增加 canonical 和必要重定向。
3. 出现大量无意义抓取：增加精确的 `robots.txt` 规则。
4. 搜索结果有曝光但 CTR 低：基于 Query 调整标题和 description。
5. 有自然搜索点击但训练启动率低：检查搜索意图与落地体验是否匹配。
6. 社群分享成为主要获客渠道：制作 Open Graph 分享图。
7. 非中文用户明显增长：评估英文版本和 `hreflang`。
8. 百度/Google 数据证明搜索渠道有效：再考虑指南、FAQ 或高质量训练内容。

这套策略的核心不是“把所有 SEO 功能都做完”，而是让每一次新增复杂度都对应一个已经观察到的问题或机会。
