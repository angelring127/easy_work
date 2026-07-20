# 운영 패턴 구현 계획

이 문서는 `docs/operating-pattern-feature-spec.md`를 구현하기 위한 개발 계획이다. 1차 구현은 자동 스케줄 설정 안에 요일 기반 운영 패턴을 추가하고, 자동 배정 결과에 시간대별 미충족 구간을 표시하는 것을 목표로 한다.

구현 진행 상태는 [운영 패턴 구현 Todo](./operating-pattern-todo.md)에서 관리한다.

## 1. 현재 구조와 연결 지점

현재 자동 스케줄 관련 구현은 다음 위치에 있다.

| 영역 | 현재 파일 |
| --- | --- |
| 자동 배정 API | `src/app/api/schedule/auto-assign/route.ts` |
| 자동 스케줄 설정 API | `src/app/api/stores/[id]/auto-schedule-settings/route.ts` |
| 자동 스케줄 설정 UI | `src/components/schedule/auto-schedule-settings-editor.tsx` |
| 자동 스케줄 설정 마이그레이션 | `supabase/migrations/20260623000001_create_auto_schedule_settings.sql` |
| 사용자 역할 | `store_job_roles`, `user_store_job_roles` |
| 근무항목 역할 조건 | `work_item_required_roles` |
| 실제 배정 | `schedule_assignments` |

운영 패턴은 기존 `store_business_hours`, `staffing_targets`, `max_morning_staff`, `max_afternoon_staff`를 즉시 제거하지 않는다. 1차에서는 자동 배정의 커버리지 기준으로만 사용한다.

## 2. 데이터 모델

### 2.1 운영 패턴

테이블: `store_auto_schedule_operating_patterns`

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | UUID | 기본 키 |
| `store_id` | UUID | 매장 ID |
| `name` | TEXT | 패턴 이름. 예: 평일, 주말 |
| `is_active` | BOOLEAN | 사용 여부 |
| `sort_order` | INT | UI 표시 순서 |
| `created_at` | TIMESTAMPTZ | 생성 시각 |
| `updated_at` | TIMESTAMPTZ | 수정 시각 |

제약:

- `store_id + name` 유니크 권장
- `sort_order`는 같은 매장 안에서 정렬용으로 사용

### 2.2 패턴 적용 요일

테이블: `store_auto_schedule_pattern_weekdays`

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `store_id` | UUID | 매장 ID |
| `pattern_id` | UUID | 운영 패턴 ID |
| `weekday` | INT | 0=일요일, 6=토요일 |
| `created_at` | TIMESTAMPTZ | 생성 시각 |

제약:

- 기본 키: `store_id, weekday`
- `pattern_id`는 `store_auto_schedule_operating_patterns(id)` 참조
- 이 기본 키가 “각 요일은 하나의 운영 패턴에만 배정” 규칙을 보장한다.

### 2.3 패턴 시간 구간

테이블: `store_auto_schedule_pattern_segments`

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | UUID | 기본 키 |
| `store_id` | UUID | 매장 ID |
| `pattern_id` | UUID | 운영 패턴 ID |
| `name` | TEXT | 구간 이름. 예: 오프닝, 오전, 오후, 클로징 |
| `start_min` | INT | 시작 시간. 00:00부터 분 |
| `end_min` | INT | 종료 시간. 00:00부터 분. 24:00은 1440 |
| `min_headcount` | INT | 총 최소 인원 |
| `sort_order` | INT | UI 표시 순서 |
| `created_at` | TIMESTAMPTZ | 생성 시각 |
| `updated_at` | TIMESTAMPTZ | 수정 시각 |

제약:

- `start_min < end_min`
- `min_headcount >= 1`
- `start_min`, `end_min`은 0-1440 범위

겹침 검증:

- DB 제약으로 완전히 막기보다 API 저장 시 같은 패턴 안의 구간 겹침을 검증한다.
- 1차에서는 빈틈은 허용하되 경고한다.

### 2.4 구간 필요한 역할

테이블: `store_auto_schedule_segment_roles`

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `segment_id` | UUID | 시간 구간 ID |
| `job_role_id` | UUID | 필요한 역할 ID |
| `created_at` | TIMESTAMPTZ | 생성 시각 |

제약:

- 기본 키: `segment_id, job_role_id`
- `job_role_id`는 `store_job_roles(id)` 참조

해석:

- 선택된 역할은 각각 최소 1명 이상 커버되어야 한다.
- 한 직원이 여러 역할을 보유하면 여러 역할 조건을 동시에 만족할 수 있다.
- 총 인원은 실제 배정된 사람 수로만 계산한다.

## 3. API 설계

1차에서는 기존 자동 스케줄 설정 API에 운영 패턴을 함께 포함한다.

### 3.1 설정 조회

`GET /api/stores/[id]/auto-schedule-settings`

기존 응답에 `operatingPatterns`를 추가한다.

```json
{
  "success": true,
  "data": {
    "conditionPriorities": [],
    "userPriorities": [],
    "jobRoles": [],
    "operatingPatterns": [
      {
        "id": "pattern-id",
        "name": "평일",
        "isActive": true,
        "sortOrder": 1,
        "weekdays": [1, 2, 3, 4],
        "segments": [
          {
            "id": "segment-id",
            "name": "오전",
            "startMin": 660,
            "endMin": 1050,
            "minHeadcount": 2,
            "requiredRoleIds": ["role-supervisor", "role-kitchen", "role-cashier"]
          }
        ]
      }
    ]
  }
}
```

### 3.2 설정 저장

`PUT /api/stores/[id]/auto-schedule-settings`

기존 요청에 `operatingPatterns`를 추가한다.

```json
{
  "operatingPatterns": [
    {
      "id": "existing-pattern-id-or-null",
      "name": "평일",
      "isActive": true,
      "sortOrder": 1,
      "weekdays": [1, 2, 3, 4],
      "segments": [
        {
          "id": "existing-segment-id-or-null",
          "name": "오전",
          "startMin": 660,
          "endMin": 1050,
          "minHeadcount": 2,
          "requiredRoleIds": ["role-supervisor", "role-kitchen", "role-cashier"]
        }
      ]
    }
  ]
}
```

저장 검증:

- 패턴 이름 필수
- 같은 요청 안에서 요일 중복 불가
- 같은 패턴 안에서 구간 시간 겹침 불가
- 구간 시작/종료 시간 유효성
- `minHeadcount >= 1`
- `requiredRoleIds`는 해당 매장의 활성 역할이어야 함

저장 방식:

- 1차는 매장 단위로 운영 패턴 전체를 replace하는 방식이 단순하다.
- 기존 패턴/구간을 부분 업데이트하려면 UI 상태와 삭제 처리가 복잡해진다.
- replace 방식은 트랜잭션이 가장 안전하지만 Supabase route에서 직접 트랜잭션이 어렵다면 delete/insert 순서를 안정적으로 유지한다.

## 4. 설정 UI 계획

위치:

- `매장 설정 > 자동 스케줄`
- 기존 `AutoScheduleSettingsEditor`에 `운영 패턴` 섹션 추가

필요 데이터:

- 기존 자동 스케줄 설정
- `store_job_roles` 목록
- 운영 패턴 목록

UI 구조:

```text
자동 스케줄 설정
  조건 우선순위
  직원 배정 우선순위
  운영 패턴
    [패턴 카드: 평일]
      적용 요일: 월 화 수 목
      구간:
        10:00-11:00 / 오프닝 / 최소 1명 / 수퍼바이저
        11:00-17:30 / 오전 / 최소 2명 / 수퍼바이저, 키친, 캐셔
    [패턴 추가]
```

1차 UI 원칙:

- 복잡한 “커버리지” 용어를 노출하지 않는다.
- 라벨은 `최소 인원`, `필요한 역할`을 사용한다.
- 역할은 체크박스로 선택한다.
- 같은 요일을 이미 다른 패턴에서 선택했다면 비활성화하거나 저장 시 오류를 표시한다.
- 구간은 시작 시간 순서로 정렬한다.

## 5. 자동 배정 엔진 변경 계획

### 5.1 현재 방식의 한계

현재 자동 배정은 근무항목을 순서대로 처리한다. 그 결과 특정 시간대의 실제 필요 인원을 기준으로 부족분을 채우지 못할 수 있다.

운영 패턴 도입 후에는 날짜별로 다음을 계산해야 한다.

- 해당 날짜에 적용되는 운영 패턴
- 패턴의 시간 구간별 최소 인원
- 패턴의 시간 구간별 필요한 역할
- 현재까지 배정된 근무항목이 각 구간을 얼마나 커버하는지

### 5.2 날짜별 처리 흐름

```text
for each date:
  pattern = findPatternByWeekday(date.weekday)
  if no pattern:
    fallback to current work-item based assignment
    continue

  for each segment in pattern.segments:
    while segment is not satisfied:
      candidateWorkItems = workItems covering segment
      sort candidateWorkItems by overflow minutes asc
      for each candidateWorkItem:
        candidates = users satisfying hard constraints and work item role
        score candidates
        simulate assignment
        choose assignment that best improves segment coverage

      if no assignment possible:
        record unmet segment warning
        break

  validate all segments
  record unmet headcount and role warnings
```

### 5.3 구간 충족 판단

구간을 만족하려면 두 조건을 모두 만족해야 한다.

1. 총 인원
   - 해당 구간과 시간이 겹치는 활성 배정의 고유 직원 수가 `minHeadcount` 이상이어야 한다.
2. 필요한 역할
   - 해당 구간과 시간이 겹치는 배정 직원들의 보유 역할을 합쳤을 때, 선택된 모든 역할이 존재해야 한다.

중요:

- 한 직원은 총 인원에서 1명으로만 센다.
- 한 직원이 여러 역할을 보유하면 역할 조건은 여러 개 충족할 수 있다.

### 5.4 근무항목 선택 점수

근무항목은 부족 구간을 덮을 수 있어야 한다.

우선순위:

1. 부족 구간을 덮는 근무항목
2. 초과 시간이 적은 근무항목
3. 사용자 희망 일 근무 시간과 가까운 근무항목
4. 기존 조건 우선순위 점수
5. 직원 배정 우선순위 보조 점수
6. 공정성 tie-breaker

초과 시간 계산 예:

```text
overflow =
  max(0, segment.startMin - workItem.startMin) +
  max(0, workItem.endMin - segment.endMin)
```

이 계산은 단순한 1차 기준이다. 한 근무항목이 여러 구간을 동시에 채울 수 있으므로, 후속 단계에서는 “전체 미충족 감소량”을 함께 점수화할 수 있다.

### 5.5 미충족 결과 타입

자동 배정 응답에 `unmetSegments`를 추가한다.

```json
{
  "date": "2026-06-23",
  "patternName": "평일",
  "segmentName": "오후",
  "startMin": 1050,
  "endMin": 1320,
  "requiredHeadcount": 3,
  "actualHeadcount": 2,
  "missingRoleIds": ["role-cashier"],
  "missingRoleNames": ["캐셔"],
  "reason": "insufficient_role_coverage"
}
```

UI 메시지 예:

- `화 17:30-22:00: 총 인원 3명 중 2명만 배정`
- `화 17:30-22:00: 캐셔 역할 미충족`

## 6. 영업 시작 구간의 통합 원칙

운영 패턴이 들어오면 오프닝은 별도 1시간 슬롯이 아니라 운영 패턴의 첫 구간으로 표현한다.

예:

- `10:00-11:00 / 오프닝 / 최소 1명 / 수퍼바이저`

실제 배정은 기존 근무항목을 사용하므로 `Opening 10:00-22:30`이 이 구간을 충족할 수 있다.

시스템에는 별도 오프닝 정책, 오프닝 전용 근무항목 목록, 오프닝 플래그를 두지 않는다.

- 운영 패턴이 있는 요일은 첫 구간도 다른 구간과 동일하게 처리한다.
- 운영 패턴이 없는 요일은 모든 등록 근무항목을 이름 구분 없이 기존 필수 조건과 점수 조건으로 배정한다.
- 영업 시작 구간이 미충족되면 다른 구간과 같은 `unmetSegments` 경고로 반환한다.
- 기존 `store_auto_schedule_opening_policies`와 `store_auto_schedule_opening_work_items`는 제거한다.

## 7. 마이그레이션 초안

추가 파일 예:

`supabase/migrations/20260717000001_create_operating_patterns.sql`

필요 테이블:

- `store_auto_schedule_operating_patterns`
- `store_auto_schedule_pattern_weekdays`
- `store_auto_schedule_pattern_segments`
- `store_auto_schedule_segment_roles`

RLS 정책:

- SELECT: 해당 매장에 활성 역할이 있는 사용자
- WRITE: `MASTER`, `SUB_MANAGER`
- 기존 자동 스케줄 설정 테이블의 RLS 패턴을 따른다.

## 8. 구현 단계

### 1단계: 데이터 모델

- 마이그레이션 추가
- 타입 정의 추가
- RLS 정책 추가

완료 기준:

- 로컬 타입체크 통과
- Supabase migration SQL 문법 검토

### 2단계: 설정 API

- `GET /api/stores/[id]/auto-schedule-settings`에 운영 패턴 포함
- `PUT /api/stores/[id]/auto-schedule-settings`에서 운영 패턴 저장
- 요일 중복, 시간 겹침 검증

완료 기준:

- 잘못된 요일 중복 요청이 400을 반환
- 정상 요청이 저장 후 조회에서 같은 구조로 돌아옴

### 3단계: 설정 UI

- 자동 스케줄 설정 화면에 운영 패턴 섹션 추가
- 패턴 추가/삭제
- 요일 선택
- 시간 구간 추가/삭제
- 역할 체크박스

완료 기준:

- 관리자가 대표 패턴을 입력할 수 있음
- 같은 요일 중복 선택이 UI에서 방지되거나 저장 오류로 표시됨

### 4단계: 자동 배정 엔진

- 날짜별 운영 패턴 조회
- 구간별 충족 판단 함수 추가
- 근무항목 초과 시간 계산
- 미충족 구간 결과 생성
- 운영 패턴 없는 날짜는 기존 로직 fallback

완료 기준:

- `10:00-11:00 / 1명 / 수퍼바이저`를 `Opening 10:00-22:30` 배정으로 충족할 수 있음
- `17:30-22:00 / 3명 / 수퍼바이저, 키친, 캐셔`에서 2명만 있으면 미충족 경고가 나옴
- 한 직원이 여러 역할을 가진 경우 여러 필요한 역할을 동시에 충족함

### 5단계: 결과 표시

- 자동 배정 결과 toast 또는 모달에 미충족 구간 표시
- 날짜, 시간, 부족 인원, 미충족 역할을 사람이 읽을 수 있게 표시

완료 기준:

- 관리자가 자동 배정 후 어떤 구간을 수동 보정해야 하는지 알 수 있음

## 9. 테스트 계획

단위 테스트 후보:

- 요일 중복 검증
- 구간 시간 겹침 검증
- 구간 총 인원 충족 판단
- 역할 커버리지 충족 판단
- 한 직원의 복수 역할 중복 충족
- 근무항목 초과 시간 계산

API 테스트 후보:

- 운영 패턴 조회/저장
- 잘못된 역할 ID 거부
- 요일 중복 거부
- 시간 겹침 거부

브라우저 QA 후보:

- 매장 설정 > 자동 스케줄에서 운영 패턴 추가
- 대표 운영 패턴 입력
- 저장 후 새로고침해도 값 유지
- 자동 배정 실행 후 미충족 구간 표시

검증 명령:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## 10. 리스크와 주의점

- 기존 `staffing_targets`와 개념이 겹친다. 1차에서는 운영 패턴을 자동 배정 전용으로 두고, 기존 API와 화면을 즉시 제거하지 않는다.
- 자동 배정 엔진이 너무 탐욕적으로 동작하면 앞 구간을 채우느라 뒤 구간이 더 나빠질 수 있다. 1차는 결과 경고를 명확히 보여주고, 후속으로 미리보기/재계산을 강화한다.
- `Opening` 같은 긴 근무항목은 여러 구간을 동시에 충족할 수 있다. 구간별 충족 판단은 배정 단위가 아니라 시간 겹침 기준으로 해야 한다.
- 24:00은 `1440`으로 저장한다. UI 표시에서는 `00:00`과 혼동되지 않게 `24:00` 표시를 유지하는 편이 좋다.
