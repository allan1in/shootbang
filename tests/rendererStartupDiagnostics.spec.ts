import { expect, test } from "@playwright/test";
import {
  isSoftwareWebGLRenderer,
  sanitizeRendererStartupText,
} from "@/lib/rendererStartupDiagnostics";

test.describe("Renderer 启动诊断工具", () => {
  test("清理并限制外部错误文本", () => {
    expect(sanitizeRendererStartupText("  first\nsecond\tthird  ")).toBe(
      "first second third",
    );
    expect(sanitizeRendererStartupText("abcdef", 4)).toBe("abcd");
    expect(sanitizeRendererStartupText(null)).toBeUndefined();
  });

  test("识别常见软件 WebGL Renderer", () => {
    expect(isSoftwareWebGLRenderer("ANGLE (Google, Vulkan SwiftShader)"))
      .toBe(true);
    expect(isSoftwareWebGLRenderer("llvmpipe (LLVM 15.0.7)"))
      .toBe(true);
    expect(isSoftwareWebGLRenderer("Software Rasterizer"))
      .toBe(true);
    expect(isSoftwareWebGLRenderer("NVIDIA GeForce RTX 4060"))
      .toBe(false);
    expect(isSoftwareWebGLRenderer(undefined)).toBe(false);
  });
});
