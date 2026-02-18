"use client";

import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { StoreSwitcher } from "@/components/ui/store-switcher";
import { RoleBadge } from "@/components/auth/role-badge";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";
import { LogOut, User } from "lucide-react";
import { UserRole } from "@/types/auth";

interface ResponsiveHeaderProps {
  userEmail?: string;
  currentStoreRole?: UserRole;
  locale: string;
  onLogout: () => void;
}

export function ResponsiveHeader({
  userEmail,
  currentStoreRole,
  locale,
  onLogout,
}: ResponsiveHeaderProps) {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 md:py-6">
          {/* Logo + Mobile Nav */}
          <div className="flex items-center space-x-4">
            <MobileNav
              userEmail={userEmail}
              currentStoreRole={currentStoreRole}
              locale={locale}
              onLogout={onLogout}
            />
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              Workeasy
            </h1>
          </div>

          {/* Desktop Navigation (hidden on mobile) */}
          <div className="hidden md:flex items-center space-x-4">
            <LanguageSwitcher />
            <StoreSwitcher />
            {userEmail && (
              <>
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span className="text-sm">{userEmail}</span>
                </div>
                {currentStoreRole && <RoleBadge role={currentStoreRole} />}
              </>
            )}
            <Button variant="outline" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
