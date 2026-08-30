"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UpdateAnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateAnnouncementDialog({
  open,
  onOpenChange,
}: UpdateAnnouncementDialogProps) {
  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={onOpenChange}
    >
      <DialogContent
        initialFocus={false}
        className="w-[22rem] max-w-[calc(100vw-2rem)] bg-card/60 backdrop-blur-xl"
      >
        <DialogHeader>
          <DialogTitle>公告</DialogTitle>
          <DialogDescription className="sr-only">
            Shootbang 最新公告
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 text-sm">
          <li>• 三角洲灵敏度已适配</li>
        </ul>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => onOpenChange(false)}
        >
          了解
        </Button>
      </DialogContent>
    </Dialog>
  );
}
