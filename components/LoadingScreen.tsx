import { Spinner } from "@/components/ui/spinner";

export function LoadingScreen() {
  return (
    <main className="flex h-screen items-center justify-center bg-background px-6 text-center">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold tracking-tight">Shootbang</h1>
        <p className="text-base text-muted-foreground">
          在限定时间内尽可能多地命中目标
        </p>
        <div
          role="status"
          aria-live="polite"
          className="flex h-8 items-center gap-2 text-sm text-muted-foreground"
        >
          <Spinner aria-hidden="true" />
          <span>加载中…</span>
        </div>
      </div>
    </main>
  );
}
