# Workeasy 시스템 기능 설명서

Workeasy는 소규모 카페, 음식점, 리테일 매장처럼 교대 근무 인원이 자주 바뀌는 팀을 위한 스케줄 관리 시스템이다. 핵심 목적은 매장별 직원 관리, 초대 기반 온보딩, 근무 항목 설정, 주간 스케줄 편성, 출근 불가 일정 관리, 근무 시간 분석, 운영자용 감사/모니터링을 하나의 웹 애플리케이션에서 제공하는 것이다.

이 문서는 제품 설명, 기능 정의, 운영 흐름, 개발 구조를 함께 설명한다. 비개발자는 기능 범위를 이해하는 용도로, 개발자는 구현 위치와 주요 API를 파악하는 용도로 사용할 수 있다.

## 1. 시스템 개요

Workeasy는 Next.js App Router 기반의 다국어 웹 애플리케이션이며 Supabase를 인증, 데이터베이스, RLS 기반 접근 제어 백엔드로 사용한다.

주요 특징은 다음과 같다.

- 매장 단위로 사용자를 묶고, 매장별 역할과 권한을 관리한다.
- MASTER, SUB_MANAGER, PART_TIMER 역할에 따라 화면과 API 권한이 달라진다.
- 이메일 초대와 게스트 초대를 모두 지원한다.
- 매장 영업 시간, 휴무일, 근무 항목, 직무 역할, 휴게/근무 제한 규칙을 설정할 수 있다.
- 주간 스케줄 그리드에서 직원을 날짜와 근무 항목에 배정한다.
- 직원별 출근 불가일과 시간 제한을 등록할 수 있다.
- 스케줄을 XLSX, CSV, PNG 형태로 내보낼 수 있다.
- 관리자 콘솔에서 전체 사용자, 매장, 감사 로그, 이상 징후를 확인할 수 있다.
- 한국어, 영어, 일본어 UI를 지원한다.

## 2. 사용자와 권한 모델

### 2.1 매장 사용자 역할

Workeasy의 일반 사용자 권한은 `src/types/auth.ts`에 정의되어 있다.

| 역할 | 설명 | 대표 권한 |
| --- | --- | --- |
| MASTER | 매장 소유자 또는 최상위 매장 관리자 | 매장 생성/수정/삭제, 사용자 초대, 역할 관리, 스케줄 생성/수정/삭제, 분석 보기 |
| SUB_MANAGER | 특정 매장에 위임된 관리자 | 매장 운영 관리, 사용자 초대, 스케줄 생성/수정/삭제, 요청 승인 |
| PART_TIMER | 근무자 | 본인 스케줄 조회, 출근 불가 등록, 교대 요청 생성 |

역할별 권한은 `ROLE_PERMISSIONS`와 `Permission` enum으로 관리된다. 클라이언트에서는 `usePermissions`, `useAdminAccess`, `PermissionGuard` 계열 컴포넌트가 화면 접근을 제어하고, 서버 API에서는 `withAuth`, `checkAuth`, Supabase RLS가 실제 접근 제어를 담당한다.

### 2.2 플랫폼 관리자 역할

매장 운영 권한과 별도로 시스템 전체를 관리하는 플랫폼 관리자 역할이 있다.

| 역할 | 목적 |
| --- | --- |
| SYSTEM_ADMIN | 전체 시스템 관리 |
| OPS_ANALYST | 운영 데이터 분석 |
| SUPPORT_AGENT | 고객 지원 |
| READ_ONLY_AUDITOR | 읽기 전용 감사 |

플랫폼 관리자 권한은 관리자 콘솔(`/[locale]/admin`) 접근, 전체 사용자/매장 조회, 감사 로그 조회, CSV 리포트 내보내기 등에 사용된다.

## 3. 주요 화면 구조

### 3.1 공개/인증 화면

| 경로 | 기능 |
| --- | --- |
| `/[locale]` | 제품 홈 화면. 로그인/회원가입으로 진입한다. |
| `/[locale]/login` | 이메일/비밀번호 로그인. `redirectTo` 파라미터로 원래 접근하려던 페이지로 복귀한다. |
| `/[locale]/signup` | 일반 회원가입. |
| `/[locale]/auth/callback` | Supabase Auth 콜백 처리. |
| `/[locale]/auth/verify-email` | 이메일 인증 처리. |
| `/[locale]/auth/signup-complete` | 회원가입 완료 화면. |
| `/[locale]/invites/*` | 초대 수락, 초대 오류, 비밀번호 설정, 이메일 검증 흐름. |

인증이 필요한 경로에 비로그인 사용자가 접근하면 `proxy.ts`에서 로그인 페이지로 리다이렉트한다.

### 3.2 대시보드

경로: `/[locale]/dashboard`

대시보드는 로그인 후 사용자가 가장 먼저 보는 업무 허브다.

주요 기능:

- 현재 선택된 매장과 사용자 역할 표시
- 스케줄 화면으로 이동
- 사용자 관리 화면으로 이동
- 매장 관리 화면으로 이동
- 근무 시간 분석 패널 표시
- 플랫폼 관리자 권한이 있으면 시스템 관리자 콘솔로 이동
- MASTER 사용자가 접근 가능한 매장이 없을 때 첫 매장 생성 안내

대시보드는 `useStore` 컨텍스트에서 접근 가능한 매장 목록과 현재 매장을 읽고, `usePermissions`/`useAdminAccess`로 사용자에게 보여줄 액션을 결정한다.

### 3.3 매장 관리

경로:

- `/[locale]/stores`
- `/[locale]/stores/create`
- `/[locale]/stores/[id]`
- `/[locale]/stores/[id]/edit`
- `/[locale]/stores/[id]/users`
- `/[locale]/stores/[id]/users/[userId]`

매장 관리는 Workeasy의 운영 단위 설정 영역이다.

주요 기능:

- 접근 가능한 매장 목록 조회
- 매장 생성, 상세 조회, 수정, 보관
- 매장 기본 정보 관리: 이름, 설명, 주소, 전화번호, 시간대
- 영업 시간과 휴무일 설정
- 근무 항목 설정
- 직무 역할 설정
- 휴게 규칙과 월간 최대 근무 시간 같은 정책 설정
- 매장 구성원 조회, 역할 변경, 비활성화/재활성화/삭제
- 현재 선택 매장 저장 및 전환

매장 목록은 `/api/stores?mine=1`에서 가져오며, 현재 선택된 매장은 `StoreProvider`가 `localStorage`의 `currentStoreId`와 API 응답을 기준으로 복원한다.

### 3.4 초대와 온보딩

관련 API:

- `/api/invites`
- `/api/invites/[id]`
- `/api/invites/accept`
- `/api/invitations`
- `/api/invitations/info`
- `/api/invitations/accept`
- `/api/invitations/[id]/cancel`
- `/api/invitations/[id]/resend`

Workeasy는 두 가지 초대 방식을 지원한다.

1. 이메일 기반 초대
   - 초대받는 사람의 이메일, 이름, 역할, 만료 기간을 입력한다.
   - 초대 링크가 생성되고 SMTP 설정이 있으면 이메일로 발송된다.
   - 사용자는 링크를 통해 계정 설정 및 비밀번호 설정을 진행한다.

2. 게스트 사용자 초대
   - 이메일 없이 이름과 역할만으로 매장 구성원을 생성한다.
   - `store_users.is_guest` 플래그로 일반 인증 사용자와 구분한다.
   - 게스트도 스케줄 배정 대상이 될 수 있다.

초대 시스템은 `invites`, `invitations`, `store_users`, `user_store_roles`를 함께 사용한다. 초대 수락 후에는 사용자가 해당 매장의 역할 레코드와 매장 구성원 레코드를 갖게 된다.

### 3.5 스케줄 관리

경로: `/[locale]/schedule`

스케줄 화면은 Workeasy의 핵심 업무 화면이다. 선택된 매장을 기준으로 주간/월간 스케줄과 출근 불가 정보를 관리한다.

주요 기능:

- 주간 스케줄 그리드 표시
- 이전 주, 현재 주, 다음 주 이동
- 날짜별/사용자별 근무 배정 표시
- 근무 항목 기반 배정
- 관리자 권한 사용자만 스케줄 생성/수정/삭제 가능
- PART_TIMER는 본인 중심으로 제한된 정보를 본다.
- 근무 항목이 없을 경우 설정 화면으로 이동하도록 안내
- 자동 배정 실행
- 스케줄 내보내기
- 월간 출근 불가 캘린더 표시

주요 컴포넌트:

- `WeekGrid`: 주간 스케줄 그리드
- `UserAvailabilityCalendar`: 월간 출근 불가 관리
- `ScheduleExporter`: XLSX, CSV, PNG 내보내기
- `WorkItemsEditor`: 근무 항목 관리
- `RolesEditor`: 매장 직무 역할 관리
- `WorkItemRoleManager`: 근무 항목별 필수 직무 역할 관리

### 3.6 출근 불가 일정

출근 불가 기능은 직원이 특정 날짜 또는 시간대에 근무할 수 없음을 등록하는 기능이다.

지원 기능:

- 날짜 단위 출근 불가 등록
- 시간 제한이 있는 출근 불가 등록
- 오전/오후 경계 시간 기반 빠른 시간대 선택
- 여러 날짜 선택 모드
- 관리자 권한 사용자의 전체 직원 출근 불가 조회
- 일반 사용자의 본인 출근 불가 등록/수정/삭제

주요 데이터는 `user_availability`에 저장된다. 이후 마이그레이션에서 `store_users.id`를 참조하도록 변경되어 게스트 사용자도 출근 불가와 스케줄 배정 대상이 될 수 있다.

### 3.7 자동 배정

API: `/api/schedule/auto-assign`

자동 배정은 지정된 매장과 날짜 범위에 대해 조건을 만족하는 사용자를 근무 항목에 배정한다.

현재 구현된 기본 규칙:

- MASTER, SUB, SUB_MANAGER만 실행 가능
- 지정된 기간의 근무 항목을 기준으로 배정 후보를 계산
- 근무 항목별 필수 직무 역할이 있으면 해당 역할을 가진 사용자만 후보로 사용
- 출근 불가 일정이 있는 사용자는 제외
- 이미 같은 날짜에 배정된 사용자는 제외
- 매장 영업 시간이 있으면 해당 요일의 영업 시간을 배정 시간으로 사용
- 영업 시간이 없으면 기본값 09:00-18:00을 사용

자동 배정은 단순하고 보수적인 1차 로직이다. 공정성, 누적 근무 시간 균형, 선호 요일, 휴게 규칙까지 완전히 최적화하는 엔진은 별도 고도화 영역이다.

### 3.8 스케줄 검증

API: `/api/schedule/validate`

스케줄 검증은 저장 전 또는 자동 배정 전후에 근무 데이터가 기본 조건을 만족하는지 확인하기 위한 API다.

현재 검증 항목:

- 종료 시간이 시작 시간보다 늦은지 확인
- 매장의 템플릿/인력 목표와 시간대가 맞는지 확인
- 근무 항목별 필수 직무 역할이 배정 사용자로 충족되는지 확인

역할 충족 검증은 `src/lib/schedule/role-coverage.ts`의 `validateScheduleRoleRequirements`를 사용한다.

### 3.9 내보내기

스케줄 내보내기는 두 경로에서 제공된다.

1. 클라이언트 내보내기
   - 컴포넌트: `ScheduleExporter`
   - 형식: XLSX, CSV, PNG
   - 현재 화면의 주간 그리드나 선택된 스케줄 데이터를 사용한다.

2. 서버 API 내보내기
   - API: `/api/schedule/export`
   - 형식: XLSX, CSV
   - 시트 구성: Week Grid, Assignments, Roles
   - `exceljs`로 XLSX 파일을 생성한다.

내보내기에는 `include_private_info` 옵션이 있으며, 역할과 권한에 따라 전체 데이터 또는 본인 데이터 범위가 달라질 수 있다.

### 3.10 근무 시간 분석

API: `/api/analytics/work-hours`

근무 시간 분석은 매장 관리자에게 주간/월간 근무 시간 합계를 제공한다.

주요 계산 방식:

- `ASSIGNED`, `CONFIRMED` 상태의 스케줄만 집계
- 시작/종료 시간을 분 단위로 변환
- 자정을 넘는 근무도 보정
- `work_items.unpaid_break_min`을 제외한 유급 근무 시간을 계산
- 사용자별 주간/월간 합계를 시간 단위로 반환

대시보드의 `WorkHoursAnalyticsPanel`에서 이 데이터를 사용한다.

### 3.11 관리자 콘솔

경로:

- `/[locale]/admin`
- `/[locale]/admin/users`
- `/[locale]/admin/stores`
- `/[locale]/admin/logs`
- `/[locale]/admin/anomalies`

관리자 콘솔은 플랫폼 관리자 권한이 있는 사용자를 위한 시스템 운영 화면이다.

주요 기능:

- 전체 사용자 수, 활성 사용자 수, 활성 매장 수, 스케줄 커버리지 KPI
- 기간별 사용자/매장/초대/배정 추세
- 사용자 목록과 상태 조회
- 매장 목록, 구성원 수, 매니저 수, 초대 수, 최근 배정 수, 리스크 레벨 조회
- 감사 로그 조회
- 이상 징후 조회 및 상태 변경
- CSV 리포트 내보내기

관리자 API는 `withPlatformAdminAuth`를 사용해 보호된다. 리포트 내보내기 같은 작업은 `logPlatformAudit`로 감사 로그를 남긴다.

## 4. 데이터 모델 요약

주요 테이블과 역할은 다음과 같다.

| 테이블 | 역할 |
| --- | --- |
| `stores` | 매장 기본 정보, 상태, 시간대, 정책 설정 |
| `store_users` | 매장 구성원. 인증 사용자와 게스트 사용자를 모두 표현 |
| `user_store_roles` | 사용자와 매장 사이의 권한/역할 관계 |
| `invites`, `invitations` | 초대 생성, 만료, 수락, 취소 상태 |
| `store_business_hours` | 요일별 영업 시간 |
| `store_holidays` | 매장 휴무일 |
| `work_items` | 근무 항목. 예: 오픈, 마감, 주방, 홀 |
| `store_job_roles` | 매장별 직무 역할 |
| `user_store_job_roles` | 사용자별 직무 역할 보유 정보 |
| `work_item_required_roles` | 근무 항목별 필요한 직무 역할과 최소 인원 |
| `staffing_targets` | 시간대별 목표 인원 |
| `break_rules` | 휴게/근무 제한 규칙 |
| `user_availability` | 출근 불가 날짜와 시간 제한 |
| `schedule_assignments` | 실제 스케줄 배정 |
| `admin_audit_logs` 계열 | 플랫폼 감사 로그 |
| `admin_anomalies` 계열 | 운영 이상 징후 |

Supabase 마이그레이션은 `supabase/migrations`에 있으며, 스케줄 기능은 특히 `20241204000001_schedule_extensions.sql`, `20241207000004_create_user_availability_system.sql`, `20241210000004_update_schedule_assignments_for_guest_users.sql` 계열에서 확장되었다.

## 5. API 영역별 요약

### 인증

- `POST /api/auth/signin`
- `POST /api/auth/signup`
- `POST /api/auth/logout`
- `GET/POST /api/auth/profile`
- `POST /api/auth/change-password`
- `POST /api/auth/update-role`
- `POST /api/auth/promote-to-master`

### 매장

- `GET/POST /api/stores`
- `GET/PATCH/DELETE /api/stores/[id]`
- `GET /api/stores/[id]/users`
- `GET/PATCH/DELETE /api/stores/[id]/users/[userId]`
- `GET /api/stores/[id]/users/me`
- `POST /api/stores/[id]/users/deactivate`
- `POST /api/stores/[id]/users/reactivate`
- `POST /api/stores/[id]/users/delete`
- `POST /api/stores/[id]/users/demote`
- `POST /api/stores/[id]/roles/grant`
- `POST /api/stores/[id]/roles/revoke`

### 초대

- `GET/POST /api/invites`
- `GET/DELETE /api/invites/[id]`
- `POST /api/invites/accept`
- `GET/POST /api/invitations`
- `GET /api/invitations/info`
- `POST /api/invitations/accept`
- `POST /api/invitations/[id]/cancel`
- `POST /api/invitations/[id]/resend`

### 스케줄

- `GET/POST /api/schedule/assignments`
- `POST /api/schedule/auto-assign`
- `GET/POST/DELETE /api/schedule/availability`
- `POST /api/schedule/copy-week`
- `GET /api/schedule/export`
- `POST /api/schedule/validate`

### 매장 운영 설정

- `GET/POST /api/store-business-hours`
- `GET/POST /api/store-holidays`
- `GET/POST /api/work-items`
- `GET/PATCH/DELETE /api/work-items/[id]`
- `GET/POST /api/store-job-roles`
- `PATCH/DELETE /api/store-job-roles/[id]`
- `GET/POST /api/user-store-job-roles`
- `GET/POST/DELETE /api/work-item-required-roles`
- `GET/POST /api/staffing-targets`
- `PATCH/DELETE /api/staffing-targets/[id]`
- `GET/POST /api/break-rules`
- `PATCH/DELETE /api/break-rules/[id]`

### 분석과 관리자

- `GET /api/analytics/work-hours`
- `GET /api/admin/overview`
- `GET /api/admin/users`
- `GET /api/admin/stores`
- `GET /api/admin/audit-logs`
- `GET /api/admin/anomalies`
- `PATCH /api/admin/anomalies/[id]`
- `GET /api/admin/export`

## 6. 다국어 구조

지원 언어는 한국어(`ko`), 영어(`en`), 일본어(`ja`)다.

다국어 처리 방식:

- 모든 페이지 경로는 `/[locale]/...` 형태를 사용한다.
- locale이 없는 경로는 `proxy.ts`가 쿠키 또는 `Accept-Language`를 기준으로 locale 경로로 리다이렉트한다.
- UI 문자열은 `src/lib/i18n.ts`의 translation key를 통해 렌더링한다.
- `public/locales`에는 언어별 JSON 리소스가 있다.

향후 새 화면이나 메시지를 추가할 때는 세 언어의 번역 키를 함께 추가해야 한다.

## 7. 보안과 접근 제어

Workeasy의 보안은 세 층으로 구성된다.

1. 라우팅 레벨
   - `proxy.ts`가 locale 처리와 보호 경로 리다이렉트를 담당한다.
   - 인증되지 않은 사용자는 로그인 화면으로 이동한다.

2. API 레벨
   - `withAuth`, `checkAuth`, `withPlatformAdminAuth`가 API 요청의 사용자와 권한을 검증한다.
   - 민감한 작업은 `supabase.auth.getUser()`를 사용해 인증 사용자를 검증한다.

3. 데이터베이스 레벨
   - Supabase RLS 정책이 테이블별 접근 범위를 제한한다.
   - 매장 구성원, 스케줄, 출근 불가, 근무 항목 등은 매장 소속과 역할을 기준으로 접근이 제한된다.

운영 시 주의할 점:

- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 환경변수로만 사용해야 한다.
- `NEXT_PUBLIC_` 접두사가 붙은 값은 브라우저에 노출된다.
- 초대 링크와 인증 토큰은 로그에 남기지 않는 것이 좋다.
- 관리자 리포트 내보내기와 권한 변경 같은 행위는 감사 로그로 추적해야 한다.

## 8. 테스트와 검증

주요 명령어:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e
```

E2E 테스트는 `e2e/specs` 아래에 있다.

테스트 영역:

- `01-auth`: 로그인과 인증 핵심 경로
- `02-stores`: 매장 생성/관리
- `03-invitations`: 이메일 초대, 게스트 초대, 초대 수락
- `04-schedule`: 모바일 주간표와 스케줄 레이아웃

E2E 실행 전에는 `.env.test`가 필요하며, Supabase 테스트 키와 테스트 사용자 계정을 설정한 뒤 `npm run seed:test-users`를 실행해야 한다.

## 9. 현재 구현 상태와 한계

구현되어 있는 주요 기능:

- 인증, 회원가입, 로그인, 로그아웃
- 매장 생성/수정/보관
- 매장 구성원 관리
- 이메일 초대와 게스트 사용자
- 주간 스케줄 관리
- 출근 불가 관리
- 근무 항목, 직무 역할, 역할 요구 사항
- 자동 배정의 기본 로직
- 근무 시간 분석
- 관리자 콘솔
- XLSX/CSV/PNG 내보내기
- 한국어/영어/일본어 다국어 UI

아직 제품적으로 고도화가 필요한 영역:

- 교대 요청 화면은 대시보드에 진입점이 있지만 일부 흐름은 비활성 상태다.
- 채팅/공지 권한은 권한 모델에 정의되어 있으나 별도 완성 화면은 제한적이다.
- 자동 배정은 공정성 최적화 엔진이라기보다 역할/출근 불가/기존 배정 제외를 반영한 기본 배정 로직이다.
- E2E 테스트는 실제 Supabase 테스트 환경이 준비되어야 의미 있게 실행된다.
- 관리자 이상 징후는 운영 지표 기반으로 더 많은 룰을 추가할 수 있다.

## 10. 개발자가 빠르게 보는 구현 지도

| 영역 | 위치 |
| --- | --- |
| 페이지 라우트 | `src/app/[locale]` |
| API 라우트 | `src/app/api` |
| 공통 UI | `src/components/ui` |
| 레이아웃 | `src/components/layout` |
| 스케줄 컴포넌트 | `src/components/schedule` |
| 인증 기능 | `src/features/auth`, `src/contexts/auth-context.tsx` |
| 매장 컨텍스트 | `src/contexts/store-context.tsx` |
| 초대 기능 | `src/features/invites`, `src/app/api/invites`, `src/app/api/invitations` |
| 권한 로직 | `src/types/auth.ts`, `src/lib/auth/permissions.ts`, `src/lib/auth/middleware.ts` |
| Supabase 클라이언트 | `src/lib/supabase` |
| 스케줄 검증 | `src/lib/schedule` |
| 관리자 서비스 | `src/lib/admin` |
| DB 마이그레이션 | `supabase/migrations` |
| E2E 테스트 | `e2e` |

## 11. 대표 사용 시나리오

### 신규 매장 운영 시작

1. MASTER 계정으로 로그인한다.
2. 매장을 생성한다.
3. 매장 기본 정보, 영업 시간, 휴무일을 설정한다.
4. 근무 항목을 만든다.
5. 직무 역할을 만든다.
6. 근무 항목별 필수 역할을 지정한다.
7. 이메일 초대 또는 게스트 초대로 직원을 등록한다.
8. 직원별 직무 역할을 배정한다.
9. 스케줄 화면에서 주간 배정을 생성한다.
10. 스케줄을 내보내거나 근무 시간 분석을 확인한다.

### 직원 온보딩

1. 관리자 또는 매니저가 초대장을 생성한다.
2. 직원이 초대 링크를 연다.
3. 이메일 인증 또는 비밀번호 설정을 완료한다.
4. 초대 수락 API가 매장 구성원과 역할 레코드를 만든다.
5. 직원은 자신의 스케줄과 출근 불가 일정을 확인할 수 있다.

### 주간 스케줄 작성

1. 매장과 주차를 선택한다.
2. 영업 시간과 근무 항목을 확인한다.
3. 직원 출근 불가 정보를 확인한다.
4. 수동으로 배정하거나 자동 배정을 실행한다.
5. 역할 요구 사항 검증 결과를 확인한다.
6. 필요하면 XLSX/CSV/PNG로 내보낸다.

## 12. 운영 전 체크리스트

- `.env.local`에 Supabase URL, anon key, service role key가 설정되어 있는지 확인한다.
- SMTP를 사용할 경우 `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`를 설정한다.
- 관리자 계정은 `npm run provision:admin`으로 생성한다.
- Supabase 마이그레이션이 대상 프로젝트에 적용되어 있는지 확인한다.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`가 통과하는지 확인한다.
- 배포 환경의 `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `SITE_URL`이 실제 도메인과 일치하는지 확인한다.
- E2E를 돌릴 경우 `.env.test`와 테스트 사용자를 준비한다.
