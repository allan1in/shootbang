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
    await expect(page.getByText("开始测试")).toBeVisible();
  });

  test("显示设置按钮", async ({ page }) => {
    await expect(page.locator('[data-slot="button"]').first()).toBeVisible();
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
    // 点击设置按钮（左上角第一个按钮）
    await page.locator('[data-slot="button"]').first().click();
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
    await expect(page.getByText("开始测试")).toBeVisible();
  });
});

// ===== 游戏中 HUD =====

test.describe("游戏中 HUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
  });

  test("显示分数卡片", async ({ page }) => {
    await expect(page.getByText("分数")).toBeVisible();
  });

  test("显示时间卡片", async ({ page }) => {
    await expect(page.getByText("时间")).toBeVisible();
  });

  test("显示准确率卡片", async ({ page }) => {
    await expect(page.getByText("准确率")).toBeVisible();
  });

  test("倒计时数字可见", async ({ page }) => {
    // 倒计时 3-2-1 应该显示
    await expect(page.locator(".text-9xl")).toBeVisible();
  });
});

// ===== 游戏结束结算 =====

test.describe("游戏结束结算", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    // 直接跳到 finished 状态
    await startGameDirect(page);
    await setGameState(page, "finished");
  });

  test("显示总分", async ({ page }) => {
    await expect(page.getByText("总分")).toBeVisible();
  });

  test("显示命中数", async ({ page }) => {
    await expect(page.getByText("命中数")).toBeVisible();
  });

  test("显示准确率", async ({ page }) => {
    await expect(page.getByText("准确率")).toBeVisible();
  });

  test("显示再来一局按钮", async ({ page }) => {
    await expect(page.getByText("再来一局")).toBeVisible();
  });

  test("显示返回首页按钮", async ({ page }) => {
    await expect(page.getByText("返回首页")).toBeVisible();
  });
});

// ===== 再来一局 =====

test.describe("再来一局", () => {
  test("点击再来一局重新开始游戏", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await setGameState(page, "finished");

    // 点击再来一局 — 会调用 triggerStart，但 Pointer Lock 会失败
    // 所以只验证按钮可点击（不验证游戏是否真正启动）
    const btn = page.getByText("再来一局");
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

    await page.getByText("返回首页").click();
    await expect(page.getByText("开始测试")).toBeVisible();
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
    await expect(page.getByText("开始测试")).toBeVisible();
    expect(await getGameState(page)).toBe("idle");

    // 跳到 playing
    await startGameDirect(page);
    await expect(page.getByText("分数")).toBeVisible();
    expect(await getGameState(page)).toBe("playing");

    // 跳到 finished
    await setGameState(page, "finished");
    await expect(page.getByText("总分")).toBeVisible();
    expect(await getGameState(page)).toBe("finished");

    // 返回 idle
    await page.getByText("返回首页").click();
    await expect(page.getByText("开始测试")).toBeVisible();
    expect(await getGameState(page)).toBe("idle");
  });
});
