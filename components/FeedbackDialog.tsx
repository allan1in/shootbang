"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TurnstileWidget,
  type TurnstileStatus,
  type TurnstileWidgetHandle,
} from "@/components/TurnstileWidget";
import {
  isTurnstileTestSiteKey,
  type FeedbackResponse,
} from "@/lib/feedback";

const MAX_FEEDBACK_LENGTH = 2_000;
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const CONFIGURED_TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ??
  (process.env.NODE_ENV === "development"
    ? TURNSTILE_TEST_SITE_KEY
    : undefined);
const TURNSTILE_SITE_KEY =
  process.env.NODE_ENV === "production" &&
  isTurnstileTestSiteKey(CONFIGURED_TURNSTILE_SITE_KEY)
    ? undefined
    : CONFIGURED_TURNSTILE_SITE_KEY;

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SubmissionAttempt {
  content: string;
  id: string;
}

const ERROR_MESSAGES: Record<
  Exclude<FeedbackResponse, { ok: true }>["code"],
  string
> = {
  invalid_input: "反馈内容无效，请检查后重试。",
  verification_failed: "验证未通过或已失效，请重试。",
  service_unavailable: "反馈服务暂不可用，请稍后重试。",
  send_failed: "反馈发送失败，请稍后重试。",
};

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [turnstileStatus, setTurnstileStatus] =
    useState<TurnstileStatus>("loading");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const attemptRef = useRef<SubmissionAttempt | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const openRef = useRef(open);
  const generationRef = useRef(0);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const resetDraft = useCallback(() => {
    generationRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    attemptRef.current = null;
    setContent("");
    setSubmitting(false);
    setTurnstileStatus("loading");
  }, []);

  const closeDialog = useCallback(() => {
    openRef.current = false;
    resetDraft();
    onOpenChange(false);
  }, [onOpenChange, resetDraft]);

  const handleContentChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextContent = event.target.value;
      setContent(nextContent);
      if (attemptRef.current?.content !== nextContent.trim()) {
        attemptRef.current = null;
      }
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    const normalizedContent = content.trim();
    if (
      normalizedContent.length < 1 ||
      normalizedContent.length > MAX_FEEDBACK_LENGTH
    ) {
      toast.error(ERROR_MESSAGES.invalid_input);
      return;
    }
    if (turnstileStatus !== "ready" || !turnstileRef.current) {
      toast.error("验证服务正在加载，请稍后重试。");
      return;
    }

    const attempt =
      attemptRef.current?.content === normalizedContent
        ? attemptRef.current
        : { content: normalizedContent, id: crypto.randomUUID() };
    attemptRef.current = attempt;

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setSubmitting(true);

    try {
      const turnstileToken = await turnstileRef.current.execute();
      if (!openRef.current || generation !== generationRef.current) return;

      const controller = new AbortController();
      requestRef.current = controller;
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: normalizedContent,
          turnstileToken,
          submissionId: attempt.id,
          page: window.location.pathname,
        }),
        signal: controller.signal,
      });
      const result = (await response.json()) as FeedbackResponse;
      if (!openRef.current || generation !== generationRef.current) return;

      if (!response.ok || !result.ok) {
        turnstileRef.current?.reset();
        toast.error(
          result.ok ? ERROR_MESSAGES.send_failed : ERROR_MESSAGES[result.code],
        );
        return;
      }

      toast.success("反馈已发送，感谢你的反馈。");
      closeDialog();
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }
      if (error instanceof Error && error.name === "AbortError") return;
      if (!openRef.current || generation !== generationRef.current) return;
      turnstileRef.current?.reset();
      toast.error("验证或发送失败，请稍后重试。");
    } finally {
      if (generation === generationRef.current) {
        requestRef.current = null;
        setSubmitting(false);
      }
    }
  }, [closeDialog, content, turnstileStatus]);

  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeDialog();
      }}
    >
      <DialogContent className="w-[22rem] max-w-[calc(100vw-2rem)] bg-card/60 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>反馈</DialogTitle>
          <DialogDescription className="sr-only">
            向 Shootbang 提交反馈
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="feedback-content">反馈内容</Label>
          <Textarea
            id="feedback-content"
            value={content}
            maxLength={MAX_FEEDBACK_LENGTH}
            rows={7}
            disabled={submitting}
            placeholder="请描述你遇到的问题或建议"
            onChange={handleContentChange}
          />
          <div className="text-right text-xs tabular-nums text-muted-foreground">
            {content.length} / {MAX_FEEDBACK_LENGTH}
          </div>
        </div>

        {open && (
          <TurnstileWidget
            ref={turnstileRef}
            siteKey={TURNSTILE_SITE_KEY}
            onStatusChange={setTurnstileStatus}
          />
        )}

        <DialogFooter className="grid grid-cols-2">
          <Button
            className="w-full"
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={closeDialog}
          >
            取消
          </Button>
          <Button
            className="w-full"
            type="button"
            disabled={!content.trim() || submitting}
            onClick={handleSubmit}
          >
            {submitting && <LoaderCircle className="animate-spin" />}
            {submitting ? "发送中" : "发送"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
