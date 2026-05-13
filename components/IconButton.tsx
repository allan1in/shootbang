import React from "react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

export const IconButton = React.memo(function IconButton({
  icon: Icon,
  label,
  onClick,
}: IconButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon-lg"
      className="cursor-pointer border-foreground/10"
      aria-label={label}
      onClick={onClick}
    >
      <Icon className="size-5" />
    </Button>
  );
});
