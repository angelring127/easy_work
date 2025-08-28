"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InviteUserForm } from "./invite-user-form";
import { InvitesList } from "./invites-list";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { Permission } from "@/types/auth";
import { t } from "@/lib/i18n";
import { UserPlus, Mail, Users } from "lucide-react";

interface Store {
  id: string;
  name: string;
  description?: string;
  address?: string;
}

interface InviteManagerProps {
  className?: string;
}

/**
 * 초대 관리 통합 컴포넌트
 */
export function InviteManager({ className }: InviteManagerProps) {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("create");
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  // INVITE_USER 권한 확인
  const canInviteUsers = hasPermission(Permission.INVITE_USER);

  /**
   * 사용자의 매장 목록 로드
   */
  const loadUserStores = async () => {
    if (!user) return;

    setIsLoadingStores(true);
    try {
      // TODO: 실제 API 구현 후 교체
      // 현재는 mock 데이터 사용
      const mockStores: Store[] = [
        {
          id: "store-1",
          name: "카페 드림",
          description: "강남역 1번 출구 카페",
          address: "서울시 강남구 강남대로 123",
        },
        {
          id: "store-2",
          name: "베이커리 선샤인",
          description: "홍대 맛집 베이커리",
          address: "서울시 마포구 홍대로 456",
        },
      ];

      setStores(mockStores);
      if (mockStores.length > 0 && !selectedStoreId) {
        setSelectedStoreId(mockStores[0].id);
      }
    } catch (error) {
      console.error("매장 목록 로드 오류:", error);
    } finally {
      setIsLoadingStores(false);
    }
  };

  /**
   * 초대 성공 후 콜백
   */
  const handleInviteSuccess = () => {
    // 초대 목록 탭으로 전환
    setActiveTab("list");
  };

  /**
   * 초대 목록 업데이트 콜백
   */
  const handleInviteUpdate = () => {
    // 필요시 추가 처리
  };

  /**
   * 컴포넌트 마운트 시 매장 목록 로드
   */
  useEffect(() => {
    if (canInviteUsers) {
      loadUserStores();
    }
  }, [user, canInviteUsers]);

  // 권한이 없는 경우
  if (!canInviteUsers) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">접근 권한 없음</h3>
            <p className="text-muted-foreground">
              팀원 초대 권한이 없습니다. 관리자에게 문의해주세요.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 로딩 상태
  if (isLoadingStores) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>매장 정보를 불러오는 중...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 매장이 없는 경우
  if (stores.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">매장이 없습니다</h3>
            <p className="text-muted-foreground mb-4">
              먼저 매장을 생성해주세요.
            </p>
            <Button>매장 생성하기</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          팀원 관리
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />새 초대
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              초대 목록
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4">
            <InviteUserForm stores={stores} onSuccess={handleInviteSuccess} />
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label htmlFor="store-select" className="text-sm font-medium">
                  매장 선택:
                </label>
                <select
                  id="store-select"
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="border border-input bg-background px-3 py-2 text-sm ring-offset-background rounded-md"
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedStoreId && (
                <InvitesList
                  storeId={selectedStoreId}
                  onInviteUpdate={handleInviteUpdate}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}




