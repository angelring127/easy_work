"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Store } from "@/lib/supabase/types";
import { useAuth } from "./auth-context";

interface StoreContextType {
  // 현재 선택된 매장
  currentStore: Store | null;

  // 사용자가 접근 가능한 매장 목록
  accessibleStores: Store[];

  // 로딩 상태
  isLoading: boolean;

  // 매장 선택
  selectStore: (store: Store | null) => void;

  // 매장 목록 새로고침
  refreshStores: () => Promise<void>;

  // 매장 추가 (새로 생성된 매장을 목록에 추가)
  addStore: (store: Store) => void;

  // 매장 업데이트 (수정된 매장 정보 반영)
  updateStore: (storeId: string, updatedStore: Partial<Store>) => void;

  // 매장 제거 (보관된 매장을 목록에서 제거)
  removeStore: (storeId: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

interface StoreProviderProps {
  children: ReactNode;
}

export function StoreProvider({ children }: StoreProviderProps) {
  const { user } = useAuth();
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [accessibleStores, setAccessibleStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 사용자가 접근 가능한 매장 목록을 로드
   */
  const loadAccessibleStores = async () => {
    if (!user) {
      setAccessibleStores([]);
      setCurrentStore(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/stores?mine=1", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const stores = result.data || [];
          setAccessibleStores(stores);

          // 현재 선택된 매장이 목록에 없으면 첫 번째 매장으로 설정
          if (!currentStore || !stores.find((s) => s.id === currentStore.id)) {
            if (stores.length > 0) {
              setCurrentStore(stores[0]);
              // localStorage에 저장
              localStorage.setItem("currentStoreId", stores[0].id);
            } else {
              setCurrentStore(null);
              localStorage.removeItem("currentStoreId");
            }
          }
        }
      } else {
        console.error("매장 목록 로드 실패:", response.statusText);
      }
    } catch (error) {
      console.error("매장 목록 로드 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 매장 선택
   */
  const selectStore = (store: Store | null) => {
    setCurrentStore(store);
    if (store) {
      localStorage.setItem("currentStoreId", store.id);
    } else {
      localStorage.removeItem("currentStoreId");
    }
  };

  /**
   * 매장 목록 새로고침
   */
  const refreshStores = async () => {
    await loadAccessibleStores();
  };

  /**
   * 매장 추가 (새로 생성된 매장)
   */
  const addStore = (store: Store) => {
    // user_role 정보가 없는 경우 기본값 설정
    const storeWithRole = {
      ...store,
      user_role: store.user_role || "MASTER",
      granted_at: store.granted_at || store.created_at,
    };

    setAccessibleStores((prev) => [...prev, storeWithRole]);
    // 새로 생성된 매장을 현재 매장으로 설정
    setCurrentStore(storeWithRole);
    localStorage.setItem("currentStoreId", storeWithRole.id);
  };

  /**
   * 매장 업데이트 (수정된 매장 정보)
   */
  const updateStore = (storeId: string, updatedStore: Partial<Store>) => {
    setAccessibleStores((prev) =>
      prev.map((store) =>
        store.id === storeId ? { ...store, ...updatedStore } : store
      )
    );

    // 현재 매장이 업데이트된 경우 현재 매장도 업데이트
    if (currentStore?.id === storeId) {
      setCurrentStore((prev) => (prev ? { ...prev, ...updatedStore } : null));
    }
  };

  /**
   * 매장 제거 (보관된 매장)
   */
  const removeStore = (storeId: string) => {
    setAccessibleStores((prev) => prev.filter((store) => store.id !== storeId));

    // 현재 매장이 제거된 경우 다른 매장으로 변경
    if (currentStore?.id === storeId) {
      const remainingStores = accessibleStores.filter(
        (store) => store.id !== storeId
      );
      if (remainingStores.length > 0) {
        setCurrentStore(remainingStores[0]);
        localStorage.setItem("currentStoreId", remainingStores[0].id);
      } else {
        setCurrentStore(null);
        localStorage.removeItem("currentStoreId");
      }
    }
  };

  // 사용자 변경 시 매장 목록 로드
  useEffect(() => {
    loadAccessibleStores();
  }, [user]);

  // 초기 로드 시 localStorage에서 이전 선택 매장 복원
  useEffect(() => {
    if (user && accessibleStores.length > 0) {
      const savedStoreId = localStorage.getItem("currentStoreId");
      if (savedStoreId) {
        const savedStore = accessibleStores.find(
          (store) => store.id === savedStoreId
        );
        if (savedStore) {
          setCurrentStore(savedStore);
        } else {
          // 저장된 매장이 더 이상 접근 불가능한 경우 첫 번째 매장으로 설정
          setCurrentStore(accessibleStores[0]);
          localStorage.setItem("currentStoreId", accessibleStores[0].id);
        }
      } else {
        // 저장된 매장이 없는 경우 첫 번째 매장으로 설정
        setCurrentStore(accessibleStores[0]);
        localStorage.setItem("currentStoreId", accessibleStores[0].id);
      }
    }
  }, [user, accessibleStores]);

  const value: StoreContextType = {
    currentStore,
    accessibleStores,
    isLoading,
    selectStore,
    refreshStores,
    addStore,
    updateStore,
    removeStore,
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

/**
 * Store Context 사용 훅
 */
export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}

/**
 * 현재 매장 정보만 필요한 경우 사용하는 훅
 */
export function useCurrentStore() {
  const { currentStore } = useStore();
  return currentStore;
}

/**
 * 매장 목록만 필요한 경우 사용하는 훅
 */
export function useAccessibleStores() {
  const { accessibleStores, isLoading } = useStore();
  return { accessibleStores, isLoading };
}
