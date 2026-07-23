# 首屏加载性能优化全记录

> 时间:2026-07
> 范围:从零建立性能检测体系,定位并修复移动端多余 JS 下载问题
> 成果:线上 PSI mobile 88→98 分,LCP 3.6s→2.1s(达标),移动端 JS 下载量 -63%

---

## 一、背景与目标

项目是纯客户端渲染的 Next.js 射击游戏:

```
app/page.tsx → MobileGate → GameBoard → SceneCanvas(three.js/r3f)
                    └→ MobilePrompt(移动端拦截提示)
```

全链路 `"use client"`,无 SSR 内容,依赖 three.js / @react-three/fiber / @react-three/drei / tone.js 等重型库。此前没有任何性能监测手段,目标是:先建立检测体系拿到可信数据,再决定是否优化、优化什么。

**核心原则(贯穿全程):先测量 → 再诊断 → 后优化,不凭感觉动手。**

---

## 二、指标选型

### 选了什么

| 指标 | 全称 | 测什么 | 为什么适合本项目 |
|---|---|---|---|
| LCP | Largest Contentful Paint | 视口内最大内容元素完成绘制的时间 | 纯 CSR 项目首屏初始为空,LCP 完整覆盖"下载 JS + hydrate + 渲染"链路 |
| FCP | First Contentful Paint | 第一个 DOM 内容绘制时间 | 与 LCP 做差值:FCP 晚→瓶颈在网络;FCP 早 LCP 晚→瓶颈在 JS 执行 |
| TBT | Total Blocking Time | 主线程长任务(>50ms)超出部分的总和 | three.js 场景初始化是典型长任务来源;TBT 是 INP 在实验室的替身 |
| CLS | Cumulative Layout Shift | 布局偏移累计分数 | 零成本顺带监控 |

### 明确不看什么

- **TTFB**:无后端数据请求,纯静态分发,参考价值低
- **Speed Index**:WebGL 粒子动画持续改变画面,SI 判定"视觉稳定"永远抖动(实测 ±40%),对本项目无参考价值
- **INP**:需要真实用户交互,实验室测不到,留给上线后 RUM

### 关键认知

- `<canvas>` **不是 LCP 候选元素**——本项目 LCP 测的是菜单 UI(`IdleScreen` 的 `<h1>`),不是 WebGL 画面
- TBT/TTI/SI 是 Lighthouse 合成指标(无原生 API,RUM 采不到);LCP/CLS/INP 是浏览器原生上报
- Lab 数据(可复现、用于开发迭代)与 Field/RUM 数据(真实分布、用于最终裁决)不可互相替代

---

## 三、Lab 基线测量

### 方法

```bash
npm run build          # 必须生产构建,dev 模式数字无意义
PORT=3001 npm run start
npx lighthouse http://localhost:3001 --preset=desktop --output=json --output=html
```

**本项目特有的坑**:Lighthouse 默认 mobile 模拟(小视口+触屏)会命中 `useMobileDetect` 的判定(`hasTouch || innerWidth < 768`),测到的是 `MobilePrompt` 提示语而非游戏本体。桌面数据必须显式 `--preset=desktop`。

### 基线结果(localhost, desktop)

| 指标 | 数值 |
|---|---|
| 性能得分 | 96 |
| FCP / LCP | 0.3s / 0.9s |
| TBT / CLS | 140ms / ~0 |

LCP 明细确认命中元素为 `IdleScreen` 的 `<h1>Shootbang</h1>`;LCP 构成中 element render delay 占 543ms(vs TTFB 16ms),印证瓶颈在 JS 执行而非网络。

报告同时给出的诊断线索:最大 chunk 267KB 缺 source map、未使用 JS 约 182KB、渲染阻塞 CSS 约 80ms、legacy polyfill 约 13KB。

---

## 四、走向真实环境:部署 + PSI

localhost 的两大失真:网络零延迟(TTFB 假象)、开发机硬件偏强。部署到 Vercel 后用 PageSpeed Insights(Google 机房发起、真实公网链路)复测。

### 跨环境矛盾及破解

PSI 结果与本机严重不符,且方向相反:

| | PSI(Google 机房) | 本机 Lighthouse |
|---|---|---|
| Mobile | 88 分,TBT 140ms | 71~74 分,TBT ~400ms |
| Desktop | **60 分,TBT 27,950ms** | 90+ 分,TBT 130ms |

**破解**:PSI 测试服务器无 GPU,desktop 模式渲染完整 three.js 场景时退回 SwiftShader(CPU 软渲染 WebGL),每帧都成为长任务,TBT 累加到测试超时,产生 28 秒的病理数值——**不代表真实桌面体验**。mobile 分数反而好,是因为渲染的只是提示语,没有 canvas。

**由此确立的测量口径**:
- 桌面性能:以本机/真机为准,PSI desktop 标签忽略
- 移动 + 真实网络:以 PSI mobile 为准
- 跨环境比数字无意义,同口径比变化才算数

---

## 五、定位病灶:移动端下载了整个游戏包

### 证据链(三步闭合)

1. **代码推因**:`MobileGate.tsx` 静态 `import GameBoard`,`if (isMobile)` 是运行时分支,而打包器在构建时静态解析依赖图,无法预知分支走向,只能把 three.js/tone.js 整条依赖链全量打入首屏 bundle
2. **指标见果**:PSI mobile 报告中 LCP 元素是提示语 `<p>`(证明未渲染游戏),但 JS 执行 1.8s、主线程工作 2.6s、最大 chunk 235KB 中 **76% 未执行**(证明下载解析了游戏代码却没用上;对照 desktop 同 chunk 仅 49% 未使用)
3. **对照实锤**:比对 mobile 与 desktop 两份 Lighthouse 报告的网络请求明细——**JS 文件列表逐个相同,均为 8 个文件合计 424KB**

结论:移动端用户为一行提示文字付出了与桌面端完全相同的 424KB JS 下载 + 解析执行代价。

---

## 六、改造方案:按运行时分支做代码分割

### 改动(components/MobileGate.tsx)

```tsx
// 改造前:静态导入,three.js 必然进入首屏 bundle
import GameBoard from "@/components/GameBoard";

// 改造后:动态导入,判断完 isMobile 后按需下载
const GameBoard = dynamic(() => import("@/components/GameBoard"), {
  ssr: false,   // GameBoard 依赖 window/WebGL,且页面本就纯 CSR
  loading: () => <div>…加载占位,避免桌面端 chunk 下载期白屏…</div>,
});
```

`MobilePrompt` 保持静态导入(仅几 KB,拆分反而多一次请求)。

### 回归测试(tests/game.spec.ts 新增"懒加载"块)

- 移动端:断言 `window.__shootbang_test` 未注册(该 API 由 GameBoard 依赖链内的 `useGameLogic` 注册,未定义即游戏模块未加载执行——比断言 hash 命名的 chunk 文件名稳定)
- 桌面端:canvas 出现后断言该 API 已注册
- 边界:移动视口看到提示后 resize 到桌面尺寸,断言 canvas 按需出现

---

## 七、验证结果

### 本机 Lighthouse(生产构建,多轮采样)

| | 改造前 | 改造后(4~5 轮) | 变化 |
|---|---|---|---|
| Mobile 得分 | 71~74 | 96~98 | +25 |
| Mobile JS 下载 | 424KB | **158KB(每轮精确一致)** | **-63%,267KB 游戏 chunk 消失** |
| Mobile JS 执行 | 1.8s | 0.2s | -89% |
| Mobile TBT | 390~440ms | 30~100ms | 恢复健康 |
| Desktop 得分(3 轮中位) | 96 | 93~97 | 持平,无回退 |

### 线上 PSI 同口径对比(Google 机房,唯一变量是代码)

| | 改造前 | 改造后 | 变化 |
|---|---|---|---|
| Mobile 得分 | 88 | **98** | +10 |
| Mobile LCP | 3.6s(超标) | **2.1s(达标)** | 进入 Core Web Vitals 良好区间 |
| Mobile TBT | 140ms | 40ms | -71% |
| Mobile FCP | 1.1s | 1.1s | 不变——反向印证机制:FCP 取决于 HTML/CSS,与游戏 chunk 无关 |
| Desktop | 60 | 59 | 无变化(无 GPU 环境的病理数值,预期内,以本机数据为准) |

### 测量噪声的教训

单批 desktop 测试曾显示提升至 99 分 / TBT 30ms,多轮复测不能复现(回到 120~150ms),判定为机器空闲期的噪声并**收回该结论**。凡结论必须满足:多轮采样稳定复现,或构建产物层面可解释(如 158KB 是产物事实,不依赖测量)。单次测量 ±10~20% 的波动是常态,对比一律取中位数,差异 <10% 视为无变化。

---

## 八、方法论沉淀

每一步遵循同一循环:**测量 → 解释(数字必须能用代码/原理讲通)→ 决策 → 改动 → 同口径复测**。

1. 不懂指标含义之前不看数字,不看数字之前不谈优化
2. 每个异常数字都追到物理解释为止(28s TBT、76% 未使用、FCP 不变,各有下文)
3. 跨环境比数字无意义,同口径比变化才算数
4. 结论要经得起复测,被推翻的诚实收回
5. 性能优化必须配回归测试,否则一次随手的 import 就会悄悄退化

## 九、遗留事项(按优先级)

- [ ] 上线 RUM(`web-vitals` + `useReportWebVitals`,采集真实用户 LCP/INP/CLS)——**当前最有信息增量的下一步**,lab 指标已进入收益递减区,真实数据才能裁决还差什么
- [ ] "点击开始游戏"时刻的性能测量(SceneCanvas 挂载的长任务,Lighthouse 单次加载测不到,需 Playwright + CDP 节流)
- [ ] CI 性能回归门槛(Lighthouse CI 断言阈值,或 Playwright 读 Paint Timing 做烟雾测试)
- [ ] 真机弱 GPU 测试(旧手机连局域网直测,唯一免费的真实低端 GPU 数据源)
- [ ] 渲染阻塞 CSS(~80ms)与 legacy polyfill(~14KB)的小额优化(性价比低,暂缓)
- [x] ~~按主题拆分场景组件(雷暴/暴雪)~~——已否决:bundle 分析显示每个主题组件仅 ~3KB,拆分无收益

---

## 十、后续补充(懒加载上线后的深入分析)

### 测量注意事项:懒加载占位符会"美化" LCP

懒加载引入了一个测量副作用:桌面端加载时序变为"框架 JS → hydrate → 触发动态导入 → 游戏 chunk → 菜单"。Lighthouse 可能在游戏 chunk 开始下载前就判定页面加载完成并结束 trace,此时 LCP 命中的是 `loading` 占位符("加载中…"),得出 0.5s 的虚高好成绩;完整捕捉全过程的运行,LCP 命中真菜单 `<h1>Shootbang</h1>`,约 1.0~1.4s。

**规则:看本项目桌面 LCP 必须核对命中元素是否为 `<h1>Shootbang</h1>`,命中占位符的数据一律作废。**

真实结论:懒加载使桌面菜单可见时间从 ~0.8s 变为 ~1.0-1.4s(hydrate 后才下载 chunk 的串行代价),换取移动端 -63% 下载量,交换划算。消除该串行需服务端 UA 检测(架构级改动,已评估不做:UA 不可靠、破坏 CDN 静态缓存、改动半径大)。

### 游戏 chunk 构成分析(Turbopack bundle analyzer)

本项目 Next.js 16 用 Turbopack 构建,webpack 时代的 `@next/bundle-analyzer` 不适用,用内置的:

```bash
npx next experimental-analyze   # 构建后在 127.0.0.1:4000 提供交互式矩形树图
```

游戏 chunk(948KB 未压缩 / 266KB 压缩)构成:

| 构成 | 未压缩 | 占比 |
|---|---|---|
| three.js(three.core.js + three.module.js,r167+ 的官方两段式构建) | 698KB | 73.7% |
| @react-three/fiber | 141KB | 14.9% |
| tailwind-merge | 26KB | 2.7% |
| 项目代码(场景/主题/音频合计) | ~30KB | ~3% |

**推论**:Lighthouse 报告的"49% 未使用"主体是 three.js 中未被场景调用的类(几何体/加载器/动画系统等)。three.js 类间耦合深,tree-shaking 空间已尽,266KB 压缩体积即"使用 three.js 的地板价",不再深挖。

注意:bundle analyzer 只能看"包里装了什么"(静态构成),看不到"哪些被执行了"(运行时覆盖率,来自 Chrome Coverage / Lighthouse unused-javascript 审计),两者结合才能归因"未使用部分是什么"。

### 幽灵依赖清理

追查 chunk 构成时发现 `tone`(音频库)从未被任何代码 import——`lib/sounds.ts` 及主题音频用的全是原生 Web Audio API。`tone` 只存在于 package.json,从未进入任何 bundle,对性能无影响,已卸载(依赖卫生)。

## 相关提交

- `feae1c7` perf: GameBoard 懒加载 — 移动端不再下载 three.js 游戏包,JS 从 424KB 降至 158KB
- 依赖清理与首屏优化记录：卸载未使用的 tone，并补充 chunk 构成分析与 LCP 测量注意事项
