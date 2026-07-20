"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh" className="dark">
      <body>
        <div className="flex h-screen items-center justify-center bg-background text-foreground">
          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-bold">出现错误</h1>
            <p className="text-muted-foreground">页面加载失败，请重试</p>
            <button
              className="cursor-pointer rounded-md bg-primary px-4 py-2 text-primary-foreground"
              onClick={unstable_retry}
            >
              重试
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
