"use client";

import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ReactNode } from "react";
import { format } from "date-fns";

interface DateActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  title?: string;
  children: ReactNode;
}

export function DateActionSheet({
  open,
  onOpenChange,
  date,
  title,
  children,
}: DateActionSheetProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const displayTitle = title || format(date, "MMMM d, yyyy");

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{displayTitle}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{displayTitle}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
