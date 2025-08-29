"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InvitationStatusDebugPage() {
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      // URL에서 매장 ID와 이메일을 가져오기
      const urlParams = new URLSearchParams(window.location.search);
      const storeId = urlParams.get("storeId");
      const email = urlParams.get("email");

      if (!storeId) {
        alert(
          "storeId 파라미터가 필요합니다. URL에 ?storeId=xxx&email=xxx를 추가하세요."
        );
        return;
      }

      const response = await fetch(
        `/api/test/invitation-status?storeId=${storeId}&email=${email || ""}`,
        { cache: "no-store" }
      );
      const data = await response.json();
      setStatusData(data);
      console.log("상태 확인 결과:", data);
    } catch (error) {
      console.error("상태 확인 실패:", error);
      alert("상태 확인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>초대 상태 디버깅</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button onClick={checkStatus} disabled={loading}>
              {loading ? "확인 중..." : "상태 확인"}
            </Button>

            {statusData && (
              <div className="space-y-4">
                <h3 className="font-semibold">결과:</h3>
                <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                  {JSON.stringify(statusData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
