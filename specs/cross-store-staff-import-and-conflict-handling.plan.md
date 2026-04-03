# 다른 지점 유저 가져오기 및 교차 지점 스케줄 충돌 처리 계획

## 개요

이 문서는 서로 연결된 아래 3가지 기능 추가 계획을 정의합니다.

1. 현재 지점의 사용자 초대 모달에서 게스트 등록이나 이메일 초대 외에, 다른 지점에 속한 기존 유저를 현재 지점으로 바로 가져오는 기능
2. Schedule Management에서 같은 유저가 다른 지점 스케줄에 이미 포함되어 있을 때 이를 주간 그리드에 표시하고, 시간이 겹치는 경우 현재 지점 배정을 막는 기능
3. Export 및 Advanced Export에서 다른 지점 근무 정보를 두 번째 줄에 표기하고, 읽기 쉬운 Legend를 함께 제공하는 기능

기존 이메일 초대와 게스트 등록 기능은 유지해야 합니다.

## 제품 결정 사항

- 다른 지점 유저 가져오기는 즉시 등록 방식으로 처리합니다.
- 이 흐름에서는 `PENDING` 초대 레코드를 만들지 않습니다.
- 게스트 유저는 가져오기 대상에서 제외합니다.
- 다른 지점 유저는 단건 또는 다건 선택이 가능해야 합니다.
- 현재 지점에 부여할 역할은 모달에서 선택한 역할을 일괄 적용합니다.
- 다른 지점 스케줄 충돌은 같은 날짜에 시간이 실제로 겹칠 때만 차단합니다.
- 같은 날짜에 다른 지점 근무가 있더라도 시간이 겹치지 않으면 배정 가능합니다.
- Export 표기는 지점명의 첫 글자를 기본 short code로 사용하되, 중복되면 가장 짧은 고유 prefix까지 확장합니다.

## 현재 시스템 제약

- `schedule_assignments.user_id`는 `store_users.id`를 사용합니다.
- 따라서 교차 지점 동일인 판별은 일반 유저에 한해 `store_users.user_id` 즉 auth user id 기준으로 해야 합니다.
- 접근 가능한 지점 목록은 이미 store context에 존재하므로 source-store 탭에 재사용할 수 있습니다.
- 현재 초대 UI는 Users 페이지의 `InvitationManager` 안에 있습니다.
- 스케줄 UI는 `SchedulePage`, `WeekGrid`, `ScheduleExporter`, `/api/schedule/assignments`를 중심으로 구성되어 있습니다.

## 구현 계획

### 1. Users > Invitations에 다른 지점 유저 가져오기 추가

초대 모달에 새로운 입력 방식인 `다른 지점 유저 가져오기`를 추가합니다.

동작:
- 기존 이메일 초대 유지
- 기존 게스트 등록 유지
- 새로운 흐름으로 다른 지점 유저 가져오기 추가
- 현재 지점을 제외한 접근 가능한 지점을 모달 상단 탭으로 표시
- 선택된 지점 탭에서 아래 조건의 유저만 후보로 표시
  - 해당 지점 소속
  - 활성 상태
  - 게스트 아님
  - auth user id 존재
  - 현재 지점에 active 멤버로 아직 등록되지 않음
- 단일 선택과 다중 선택 모두 가능
- 역할 선택은 현재 지점에 부여할 역할 1회 선택 방식 사용
- 제출 시 현재 지점에 즉시 등록

API:
- `POST /api/stores/[id]/users/import` 추가
- 요청 body
  - `sourceStoreId: string`
  - `userIds: string[]`
  - `role: "PART_TIMER" | "SUB_MANAGER"`
- 응답 body
  - `success: boolean`
  - `data.imported: Array<{ userId: string; storeUserId?: string }>`
  - `data.skipped: Array<{ userId: string; reason: string }>`
  - `data.alreadyExists: Array<{ userId: string }>`

규칙:
- 현재 사용자는 대상 지점의 관리자 권한이 있어야 함
- source store도 현재 사용자가 관리 가능한 지점이어야 함
- 각 유저에 대해
  - source store 멤버십이 존재하고 non-guest인지 확인
  - `user_store_roles` 생성 또는 복구
  - 기존 트리거로 `store_users` 보장
  - 감사 로그 기록
- 이 흐름에서는 `invitations` 레코드를 만들지 않음

UI 결과:
- 성공 시 현재 지점 멤버 목록 즉시 갱신
- 성공/스킵/중복 결과를 toast 또는 요약 메시지로 표시
- 모든 문구는 다국어 키 사용

### 2. Schedule Management에 다른 지점 근무 표시 및 겹침 차단 추가

현재 주 기준으로 다른 지점 배정 데이터를 함께 조회합니다.

데이터:
- 현재 지점 사용자 데이터에 아래 값을 함께 유지
  - `id`: 현재 지점의 `store_users.id`
  - `authUserId`: 일반 유저의 auth user id

신규 조회 API:
- `GET /api/schedule/cross-store-assignments?store_id=...&from=...&to=...`
- 현재 지점의 일반 유저 중 auth user id가 있는 유저만 대상으로 조회
- 다른 관리 가능 지점의 `schedule_assignments`와 매칭하여 아래 정보 반환
  - `authUserId`
  - `date`
  - `startTime`
  - `endTime`
  - `storeId`
  - `storeName`
  - `shortCode`

페이지 동작:
- `SchedulePage`가 현재 지점 배정과 함께 교차 지점 배정도 로드
- `WeekGrid`와 `ScheduleExporter`에 전달

WeekGrid 동작:
- 특정 유저/날짜 셀에 다른 지점 근무가 있으면 마커 표시
- tooltip에는 지점명과 시간 범위 표시
- 기본적으로 표시만 수행
- 관리자가 work item을 선택해 새 배정 또는 교체 배정을 시도할 때, 같은 날짜의 다른 지점 배정들과 시간 겹침 검사
- 하나라도 겹치면 저장 차단 및 충돌 경고 표시
- 겹치지 않으면 같은 날짜 다른 지점 근무가 있어도 저장 허용

서버 검증:
- 동일 겹침 검사를 아래 API에도 추가
  - `POST /api/schedule/assignments`
  - `PATCH /api/schedule/assignments/[id]`
- 충돌 시 `409` 반환
  - `success: false`
  - `error: "Cross-store schedule conflict"`
  - `conflicts: Array<{ storeId: string; storeName: string; date: string; startTime: string; endTime: string }>`

다중 날짜 등록:
- 동일한 겹침 규칙을 사전 검사에 사용
- 충돌 날짜가 있으면 날짜별 충돌을 묶어서 보여주고 일괄 등록 차단

겹침 판정:
- 같은 auth user
- 같은 date
- 시간 구간 겹침 조건
  - `newStart < existingEnd`
  - `existingStart < newEnd`

### 3. Export / Advanced Export에 다른 지점 표기 추가

Quick export와 advanced export 모두 동일한 교차 지점 표기를 사용합니다.

Quick export / PNG / XLSX:
- `SchedulePage`에서 받은 현재 주 교차 지점 데이터를 그대로 사용
- 각 유저/날짜 셀에서
  - 현재 지점 배정 표시는 기존 방식 유지
  - 다른 지점 short code는 두 번째 줄에 표시
- 두 번째 줄에 기존 텍스트가 이미 있으면 compact delimiter로 함께 표기

Advanced export:
- `/api/schedule/export`에서도 요청 범위 기준 교차 지점 마커 계산 추가
- 동일한 short code 규칙과 legend 출력 사용

Legend:
- short code와 지점명 매핑을 export 하단에 표시
- PNG/XLSX는 그리드 아래에 legend 블록 표시
- CSV는 빈 줄 뒤에 legend row 추가

Short code 생성:
- 지점명 첫 글자부터 시작
- 중복되면 가장 짧은 고유 prefix까지 확장
- 같은 결과에 대해 항상 동일하게 생성

## 인터페이스 / 타입 변경

아래 구조를 추가 또는 확장합니다.

- `StoreUser`
  - `authUserId?: string | null`

- `CrossStoreAssignment`
  - `authUserId: string`
  - `date: string`
  - `startTime: string`
  - `endTime: string`
  - `storeId: string`
  - `storeName: string`
  - `shortCode: string`

- `WeekGrid` props
  - `crossStoreAssignments?: CrossStoreAssignment[]`

- `ScheduleExporter` props
  - `crossStoreAssignments?: CrossStoreAssignment[]`

## 다국어

모든 신규 문구는 `ko`, `en`, `ja`에 함께 추가합니다.

필요 문구 예시:
- 다른 지점 유저 가져오기 탭
- source store 탭 라벨
- 가져오기 성공 / 스킵 / 이미 존재 메시지
- 다른 지점 근무 표시 문구
- 겹침 차단 경고 제목/설명
- export legend 라벨

신규 사용자 노출 문구는 하드코딩하지 않습니다.

## 테스트 계획

### 기능
- 다른 지점에서 유저 1명을 현재 지점으로 가져오기
- 다른 지점에서 여러 유저를 현재 지점으로 가져오기
- 현재 지점에 이미 등록된 유저는 후보에서 제외
- 게스트 유저는 후보에서 제외
- 기존 이메일 초대/게스트 등록은 그대로 동작

### 스케줄
- 다른 지점 근무가 있는 날 주간 그리드에 마커 표시
- 같은 날짜라도 시간 비겹침이면 배정 허용
- 같은 날짜에 시간 겹침이면 배정 차단
- 수정 시 겹치게 바뀌는 경우도 차단
- 다중 날짜 등록 시 충돌 날짜가 있으면 차단

### Export
- quick XLSX에 두 번째 줄 short code 표시
- PNG export에 동일 마커 표시
- advanced CSV/XLSX에 마커와 legend 포함
- 같은 첫 글자가 겹치면 고유 prefix로 확장

### 회귀
- 일반 같은 지점 스케줄 생성/수정/삭제 유지
- availability 경고 유지
- 기존 export 레이아웃 가독성 유지

## 가정

- source-store 탭은 현재 로그인 사용자의 accessible stores를 사용합니다.
- 이 기능은 관리자만 사용합니다.
- guest 유저는 교차 지점 동일인 식별이 불가능하므로 교차 지점 충돌 대상에서 제외합니다.
- 현재 지점에 부여할 역할은 source store 역할을 복사하지 않고 모달 선택값을 사용합니다.
