"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  claimRendererStartupFailureReport,
  finishRendererStartupAttempt,
  getRendererStartupDiagnosticsSnapshot,
  markRendererStartupFailure,
} from "@/lib/rendererStartupDiagnostics";
import { createRendererStartupSentryData } from "@/lib/webglSupport";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const activeStartup = getRendererStartupDiagnosticsSnapshot();
    if (activeStartup) {
      const failureStage = activeStartup.failure?.stage ?? "react-render";
      markRendererStartupFailure(failureStage, error);
      const snapshot = claimRendererStartupFailureReport(failureStage, error);
      if (snapshot) {
        const sentryData = createRendererStartupSentryData(
          failureStage,
          snapshot,
        );
        Sentry.captureException(error, {
          ...sentryData,
          contexts: {
            ...sentryData.contexts,
            react: {
              componentStack: errorInfo.componentStack,
            },
          },
        });
        finishRendererStartupAttempt();
        return;
      }
    }

    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-screen items-center justify-center bg-background text-foreground">
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold">出现错误</h1>
              <p className="text-muted-foreground">页面加载失败，请刷新重试</p>
              <button
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground cursor-pointer"
                onClick={() => window.location.reload()}
              >
                刷新页面
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
