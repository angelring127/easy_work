"use client";

import { WorkItemRoleManager } from "./work-item-role-manager";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface WorkItemRoleManagerExampleProps {
  locale: "ko" | "en" | "ja";
}

export function WorkItemRoleManagerExample({
  locale,
}: WorkItemRoleManagerExampleProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>역할 관리자 (MASTER) - 편집 가능</CardTitle>
          <CardDescription>
            마스터 관리자는 역할 요구 사항을 편집할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkItemRoleManager
            workItemId="example-work-item-1"
            storeId="example-store-1"
            locale={locale}
            userRole="MASTER"
            defaultMode="edit"
            showEditButton={true}
            onSave={(requirements) => {
              console.log("저장된 역할 요구 사항:", requirements);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>서브 매니저 (SUB_MANAGER) - 편집 가능</CardTitle>
          <CardDescription>
            서브 매니저도 역할 요구 사항을 편집할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkItemRoleManager
            workItemId="example-work-item-2"
            storeId="example-store-1"
            locale={locale}
            userRole="SUB_MANAGER"
            defaultMode="view"
            showEditButton={true}
            onSave={(requirements) => {
              console.log("저장된 역할 요구 사항:", requirements);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>파트타이머 (PART_TIMER) - 읽기 전용</CardTitle>
          <CardDescription>
            파트타이머는 역할 요구 사항을 볼 수만 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkItemRoleManager
            workItemId="example-work-item-3"
            storeId="example-store-1"
            locale={locale}
            userRole="PART_TIMER"
            defaultMode="view"
            showEditButton={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>사용법 설명</CardTitle>
          <CardDescription>
            WorkItemRoleManager 컴포넌트의 주요 기능과 props
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">주요 Props:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>
                <code>workItemId</code>: 근무 항목 ID
              </li>
              <li>
                <code>storeId</code>: 매장 ID
              </li>
              <li>
                <code>locale</code>: 언어 설정 (ko/en/ja)
              </li>
              <li>
                <code>userRole</code>: 사용자 역할
                (MASTER/SUB_MANAGER/PART_TIMER)
              </li>
              <li>
                <code>defaultMode</code>: 기본 모드 (view/edit)
              </li>
              <li>
                <code>showEditButton</code>: 편집 버튼 표시 여부
              </li>
              <li>
                <code>onSave</code>: 저장 완료 시 콜백 함수
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">주요 기능:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>편집/표시 모드 자동 전환</li>
              <li>권한에 따른 UI 동적 변경</li>
              <li>역할 요구 사항 CRUD</li>
              <li>실시간 역할 커버리지 표시</li>
              <li>다국어 지원</li>
              <li>토스트 알림</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
