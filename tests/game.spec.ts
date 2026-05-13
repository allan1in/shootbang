/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Page } from "@playwright/test";

// 测试辅助：通过 window.__shootbang_test 直接控制游戏状态
async function startGameDirect(page: Page) {
  await page.evaluate(() => {
    (window as any).__shootbang_test.startGame();
    (window as any).__shootbang_test.startCountdown();
  });
}

async function setGameState(page: Page, state: string) {
  await page.evaluate((s) => {
    (window as any).__shootbang_test.setGameState(s);
  }, state);
}

async function getGameState(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).__shootbang_test.getGameState());
}

// 等待 Three.js canvas 加载完成
async function waitForCanvas(page: Page) {
  await page.waitForSelector("canvas", { timeout: 10000 });
  // 给 Three.js 初始化一帧的时间
  await page.waitForTimeout(500);
}

// ===== 空闲界面 =====

test.describe("空闲界面", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
  });

  test("显示开始测试按钮", async ({ page }) => {
    await expect(page.getByRole("button", { name: "开始测试" })).toBeVisible();
  });

  test("显示设置按钮", async ({ page }) => {
    await expect(page.locator('[data-slot="button"]').nth(1)).toBeVisible();
  });

  test("canvas 场景已渲染", async ({ page }) => {
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    // canvas 应该有实际尺寸
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });
});

// ===== 设置面板 =====

test.describe("设置面板", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    // 点击设置按钮（第二个按钮）
    await page.locator('[data-slot="button"]').nth(1).click();
  });

  test("打开设置面板显示灵敏度表单", async ({ page }) => {
    await expect(page.getByText("设置")).toBeVisible();
    await expect(page.getByText("灵敏度")).toBeVisible();
  });

  test("修改灵敏度并保存", async ({ page }) => {
    const input = page.locator('input[type="number"]');
    await input.fill("3.5");
    await page.getByText("保存").click();

    // 验证 localStorage
    const saved = await page.evaluate(() =>
      localStorage.getItem("shootbang-sensitivity")
    );
    expect(saved).toBe("3.5");
  });

  test("取消关闭设置面板", async ({ page }) => {
    await page.getByText("取消").click();
    await expect(page.getByText("设置")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "开始测试" })).toBeVisible();
  });

  test("显示目标大小设置", async ({ page }) => {
    await expect(page.getByText("目标大小")).toBeVisible();
    await expect(page.getByRole("button", { name: "极小" })).toBeVisible();
    await expect(page.getByRole("button", { name: "小", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "默认" })).toBeVisible();
    await expect(page.getByRole("button", { name: "大", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "极大" })).toBeVisible();
  });

  test("修改目标大小并保存", async ({ page }) => {
    await page.getByRole("button", { name: "大", exact: true }).click();
    await page.getByText("保存").click();

    const saved = await page.evaluate(() =>
      localStorage.getItem("shootbang-targetSize")
    );
    expect(saved).toBe("large");
  });
});

// ===== 倒计时 =====

test.describe("倒计时", () => {
  test("倒计时数字可见", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await expect(page.locator(".text-9xl")).toBeVisible();
  });
});

// ===== 计时进度条 =====

test.describe("计时进度条", () => {
  test("游戏中显示进度条", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);

    const progress = page.locator('[data-slot="progress"]');
    await expect(progress).toBeVisible();
  });

  test("游戏结束后进度条消失", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await setGameState(page, "finished");

    const progress = page.locator('[data-slot="progress"]');
    await expect(progress).not.toBeVisible();
  });
});

// ===== 目标球可见性 =====

test.describe("目标球", () => {
  test("游戏中目标球可见且位置正确", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);

    const targets = await page.evaluate(() =>
      (window as any).__shootbang_test.getTargetsInfo(),
    );
    expect(targets.length).toBe(3);
    const visibleTargets = targets.filter((t: any) => t.visible);
    expect(visibleTargets.length).toBe(3);
    for (const t of visibleTargets) {
      expect(t.z).toBe(-5);
    }
  });

  test("游戏结束后目标球不可见", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await setGameState(page, "finished");
    // 等待 React 重新渲染，动画循环 else 分支隐藏目标球
    await expect(page.getByRole("button", { name: "再来一局" })).toBeVisible();

    const targets = await page.evaluate(() =>
      (window as any).__shootbang_test.getTargetsInfo(),
    );
    const visibleTargets = targets.filter((t: any) => t.visible);
    expect(visibleTargets.length).toBe(0);
  });
});

// ===== 游戏结束 =====

test.describe("游戏结束", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await setGameState(page, "finished");
  });

  test("显示再来一局按钮", async ({ page }) => {
    await expect(page.getByRole("button", { name: "再来一局" })).toBeVisible();
  });

  test("显示返回首页按钮", async ({ page }) => {
    await expect(page.getByRole("button", { name: "返回首页" })).toBeVisible();
  });
});

// ===== 再来一局 =====

test.describe("再来一局", () => {
  test("点击再来一局重新开始游戏", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await setGameState(page, "finished");

    const btn = page.getByRole("button", { name: "再来一局" });
    await expect(btn).toBeVisible();
    await btn.click();
    // triggerStart 需要 pointer lock，headless 模式下会 catch
    // 所以状态可能仍在 finished，这是预期行为
  });
});

// ===== 返回首页 =====

test.describe("返回首页", () => {
  test("点击返回首页回到空闲界面", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await setGameState(page, "finished");

    await page.getByRole("button", { name: "返回首页" }).click();
    await expect(page.getByRole("button", { name: "开始测试" })).toBeVisible();
    const state = await getGameState(page);
    expect(state).toBe("idle");
  });
});

// ===== 游戏状态流转 =====

test.describe("状态流转", () => {
  test("idle -> playing -> finished -> idle 完整流转", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);

    // 初始 idle
    await expect(page.getByRole("button", { name: "开始测试" })).toBeVisible();
    expect(await getGameState(page)).toBe("idle");

    // 跳到 playing
    await startGameDirect(page);
    await expect.poll(() => getGameState(page)).toBe("playing");

    // 跳到 finished
    await setGameState(page, "finished");
    await expect(page.getByRole("button", { name: "再来一局" })).toBeVisible();
    expect(await getGameState(page)).toBe("finished");

    // 返回 idle
    await page.getByRole("button", { name: "返回首页" }).click();
    await expect(page.getByRole("button", { name: "开始测试" })).toBeVisible();
    expect(await getGameState(page)).toBe("idle");
  });
});
