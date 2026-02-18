"use client";

import { useState } from "react";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { StoreSwitcher } from "@/components/ui/store-switcher";
import { RoleBadge } from "@/components/auth/role-badge";
import { UserRole } from "@/types/auth";

interface MobileNavProps {
  userEmail?: string;
  currentStoreRole?: UserRole;
  locale: string;
  onLogout: () => void;
}

export function MobileNav({
  userEmail,
  currentStoreRole,
  locale,
  onLogout,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px]">
        <SheetHeader>
          <SheetTitle>Workeasy</SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col space-y-4">
          {/* Store Switcher */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Store
            </label>
            <StoreSwitcher />
          </div>

          {/* Language Switcher */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Language
            </label>
            <LanguageSwitcher />
          </div>

          {/* User Info */}
          {userEmail && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">{userEmail}</p>
              {currentStoreRole && <RoleBadge role={currentStoreRole} />}
            </div>
          )}

          {/* Logout */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
