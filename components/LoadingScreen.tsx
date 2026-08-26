import { Spinner } from "@/components/ui/spinner";
import { TriangleAlert } from "lucide-react";

interface LoadingScreenProps {
  status?: "loading" | "slow" | "failed";
}

export function LoadingScreen({ status = "loading" }: LoadingScreenProps) {
  const failed = status === "failed";

  return (
    <main className="flex h-screen items-center justify-center bg-background px-6 text-center">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold tracking-tight">Shootbang</h1>
        <p className="text-base text-muted-foreground">
          在限定时间内尽可能多地命中目标
        </p>
        <div
          role={failed ? "alert" : "status"}
          aria-live={failed ? "assertive" : "polite"}
          className="flex h-8 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground sm:text-sm"
        >
          {failed ? (
            <>
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
              <span>
                加载失败，请刷新页面，或使用最新版 Chrome 或 Edge 浏览器重试
              </span>
            </>
          ) : (
            <>
              <Spinner aria-hidden="true" />
              <span>
                {status === "slow" ? "加载时间较长，请稍候…" : "加载中…"}
              </span>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
