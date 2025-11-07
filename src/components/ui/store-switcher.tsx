"use client";

import React, { useState } from "react";
import { ChevronDown, Store, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/contexts/store-context";
import { Store as StoreType } from "@/lib/supabase/types";
import { t, type Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n-config";
import { useParams } from "next/navigation";

interface StoreSwitcherProps {
  className?: string;
}

export function StoreSwitcher({ className }: StoreSwitcherProps) {
  const { locale } = useParams();
  const currentLocale = (locale as Locale) || defaultLocale;
  const { currentStore, accessibleStores, selectStore, isLoading } = useStore();
  const [isOpen, setIsOpen] = useState(false);

  // 매장이 없는 경우
  if (accessibleStores.length === 0) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Store className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {t("store.noStores", currentLocale)}
        </span>
      </div>
    );
  }

  // 로딩 중인 경우
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Store className="h-4 w-4 animate-pulse text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {t("store.loading", currentLocale)}
        </span>
      </div>
    );
  }

  const handleStoreSelect = (store: StoreType) => {
    selectStore(store);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 min-w-[200px] justify-between ${className}`}
          disabled={isLoading}
        >
          <div className="flex items-center gap-2 truncate">
            <Store className="h-4 w-4" />
            <span className="truncate">
              {currentStore?.name || t("store.selectStore", currentLocale)}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[250px]">
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          {t("store.selectStore", currentLocale)}
        </div>
        <DropdownMenuSeparator />

        {accessibleStores.map((store) => (
          <DropdownMenuItem
            key={store.id}
            onClick={() => handleStoreSelect(store)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{store.name}</div>
              {store.description && (
                <div className="text-xs text-muted-foreground truncate">
                  {store.description}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                {t(
                  `store.role.${store.user_role?.toLowerCase()}`,
                  currentLocale
                )}
              </div>
            </div>
            {currentStore?.id === store.id && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {t("store.totalStores", currentLocale, {
            count: accessibleStores.length,
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * 간단한 매장 표시 컴포넌트 (매장 전환 기능 없음)
 */
export function StoreDisplay({ className }: StoreSwitcherProps) {
  const { locale } = useParams();
  const currentLocale = (locale as Locale) || defaultLocale;
  const { currentStore } = useStore();

  if (!currentStore) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Store className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {t("store.noStoreSelected", currentLocale)}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Store className="h-4 w-4" />
      <div className="flex flex-col">
        <span className="text-sm font-medium">{currentStore.name}</span>
        {currentStore.user_role && (
          <span className="text-xs text-muted-foreground">
            {t(
              `store.role.${currentStore.user_role.toLowerCase()}`,
              currentLocale
            )}
          </span>
        )}
      </div>
    </div>
  );
}
