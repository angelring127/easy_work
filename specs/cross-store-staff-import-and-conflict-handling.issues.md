# 다른 지점 유저 가져오기 및 교차 지점 스케줄 충돌 처리 이슈 분해

이 문서는 상위 계획과 체크리스트를 실제 구현 가능한 이슈 단위로 더 잘게 나눈 작업 백로그입니다.

## 이슈 1. 다른 지점 유저 가져오기용 후보 조회 API 추가

### 목표
- 현재 지점에 없는 다른 지점 일반 유저 후보 목록을 source-store별로 조회할 수 있게 합니다.

### 작업 범위
- `GET /api/stores/[id]/users/import-candidates?source_store_id=...` 추가
- 대상 지점 관리자 권한 검증
- source store 접근 가능 여부 검증
- source store 멤버 중 일반 유저만 조회
- 현재 지점 active 멤버는 제외

### 응답 형태
- `success`
- `data.store`
- `data.candidates`
  - `userId`
  - `storeUserId`
  - `name`
  - `email`
  - `sourceRole`

### 완료 기준
- guest 유저가 내려오지 않음
- 현재 지점 이미 등록 유저가 내려오지 않음
- source store를 바꾸면 후보 목록이 달라짐

## 이슈 2. 다른 지점 유저 가져오기 실행 API 추가

### 목표
- 선택한 유저를 현재 지점에 즉시 등록할 수 있게 합니다.

### 작업 범위
- `POST /api/stores/[id]/users/import` 추가
- body 검증
  - `sourceStoreId`
  - `userIds`
  - `role`
- 각 유저별 source 멤버십 검증
- `user_store_roles` 생성 또는 복구
- 중복/이미 존재/실패 결과 분리
- 감사 로그 추가

### 완료 기준
- 단건 등록 성공
- 다건 등록 성공
- 현재 지점 이미 active 멤버면 `alreadyExists`로 분리
- 초대 테이블에는 레코드가 생성되지 않음

## 이슈 3. 초대 모달에 다른 지점 유저 모드 추가

### 목표
- 기존 email/guest 흐름을 유지하면서 `다른 지점 유저 가져오기` 모드를 추가합니다.

### 작업 범위
- `InvitationManager` 상태 구조 확장
- 모달 상단 입력 방식 탭 추가
  - 이메일 초대
  - 게스트 등록
  - 다른 지점 유저 가져오기
- 기존 2개 흐름 회귀 없이 공존하도록 정리

### 완료 기준
- 모드 전환 시 각 입력 폼 상태가 충돌하지 않음
- 기존 이메일 초대/게스트 등록 UI가 깨지지 않음

## 이슈 4. source-store 탭 및 후보 선택 UI 추가

### 목표
- 다른 지점 유저 가져오기 모드에서 source-store별 후보를 보고 선택할 수 있게 합니다.

### 작업 범위
- accessible stores를 이용해 현재 지점 제외 탭 렌더링
- 탭 선택 시 후보 목록 조회
- 체크박스로 단일/다중 선택 지원
- 현재 지점 역할 선택 재사용
- 로딩/빈 상태/에러 상태 UI 추가

### 완료 기준
- 탭 전환 시 후보 목록이 올바르게 갱신됨
- 다중 선택 후 제출 가능
- 빈 지점은 적절한 안내 문구가 보임

## 이슈 5. 가져오기 결과 요약 및 멤버 목록 갱신

### 목표
- 가져오기 실행 후 사용자가 결과를 바로 이해하고 현재 멤버 목록에서 확인할 수 있게 합니다.

### 작업 범위
- 성공/스킵/이미 존재 결과 요약 메시지 생성
- users 목록 query invalidation 또는 refetch 연결
- 모달 닫기/유지 조건 정리

### 완료 기준
- 성공 후 현재 지점 사용자 목록에 새 멤버가 보임
- 일부 성공/일부 스킵인 경우 결과 요약이 노출됨

## 이슈 6. 현재 지점 사용자 데이터에 `authUserId` 추가

### 목표
- 교차 지점 동일인 식별을 위해 현재 지점 사용자 응답에 auth user id를 포함합니다.

### 작업 범위
- `/api/stores/[id]/users` 응답 확장
- 일반 유저는 `authUserId` 포함
- guest는 `authUserId: null`
- `SchedulePage` 변환 로직 반영

### 완료 기준
- schedule page에서 각 일반 유저에 auth user id 접근 가능
- 기존 화면 동작에 영향 없음

## 이슈 7. 교차 지점 배정 조회 API 추가

### 목표
- 현재 지점 유저들의 다른 지점 배정을 날짜 범위 기준으로 조회합니다.

### 작업 범위
- `GET /api/schedule/cross-store-assignments` 추가
- 현재 지점 일반 유저의 auth user id 집합 산출
- 다른 관리 가능 지점의 assignment 조회
- 현재 지점은 제외
- short code 생성 포함

### 응답 형태
- `authUserId`
- `date`
- `startTime`
- `endTime`
- `storeId`
- `storeName`
- `shortCode`

### 완료 기준
- 같은 유저의 다른 지점 배정만 반환됨
- 현재 지점 배정은 포함되지 않음

## 이슈 8. 지점 short code 생성 공통 helper 추가

### 목표
- UI와 export에서 동일한 지점 short code 규칙을 재사용할 수 있게 합니다.

### 작업 범위
- 공통 helper 추가
- 첫 글자 기본값
- 중복 시 shortest unique prefix 확장
- 동일 입력에 대해 deterministic 보장

### 완료 기준
- 같은 글자로 시작하는 지점이 여러 개 있어도 충돌 없이 생성됨
- UI/export 양쪽에서 같은 결과 사용 가능

## 이슈 9. SchedulePage에 교차 지점 배정 데이터 연결

### 목표
- schedule page가 현재 주 데이터와 함께 교차 지점 배정도 로드해 하위 컴포넌트에 전달합니다.

### 작업 범위
- 주간 데이터 로드 시 cross-store API 추가 호출
- state 추가
- `WeekGrid`, `ScheduleExporter` props 연결

### 완료 기준
- 스토어/주 변경 시 교차 지점 데이터도 함께 갱신됨

## 이슈 10. WeekGrid 셀에 다른 지점 근무 마커 표시

### 목표
- 특정 유저/날짜 셀에서 다른 지점 근무가 있음을 볼 수 있게 합니다.

### 작업 범위
- 셀별 cross-store assignment 매핑
- 마커 UI 추가
- tooltip에 지점명/시간 표시
- 기존 assignment/availability 표시와 레이아웃 충돌 최소화

### 완료 기준
- 다른 지점 근무가 있는 셀에서 마커와 tooltip 확인 가능
- 기존 셀 정보가 지나치게 깨지지 않음

## 이슈 11. WeekGrid 신규 배정 시 교차 지점 시간 겹침 차단

### 목표
- 새 배정 생성 시 다른 지점과 시간 겹침이 있으면 저장하지 못하게 합니다.

### 작업 범위
- work item 선택 후 예정 시간 계산
- 같은 날짜 cross-store assignment와 overlap 검사
- 충돌 시 경고 다이얼로그 표시
- 충돌 store/time 정보 표시

### 완료 기준
- 시간이 겹치면 저장 요청 전 차단
- 시간이 안 겹치면 같은 날짜여도 허용

## 이슈 12. WeekGrid 수정/교체 배정 시 교차 지점 시간 겹침 차단

### 목표
- 기존 배정 수정이나 work item 교체 시에도 동일한 overlap 규칙을 적용합니다.

### 작업 범위
- PATCH 전 예정 시간 계산
- 기존 배정 교체 흐름에 overlap 검사 추가
- 차단 UI 재사용

### 완료 기준
- 수정 시 새 시간이 겹치면 차단됨
- 기존 same-store 수정 흐름은 유지됨

## 이슈 13. 다중 날짜 등록 시 교차 지점 충돌 검사

### 목표
- 다중 날짜 등록에서 날짜별 충돌 여부를 먼저 수집하고 충돌이 있으면 일괄 등록을 막습니다.

### 작업 범위
- 선택 날짜별 overlap 검사
- 날짜별 충돌 목록 구성
- 기존 warning dialog와 공존 가능한 데이터 구조 정리

### 완료 기준
- 충돌 날짜만 묶어서 보여줌
- 충돌이 하나라도 있으면 bulk save가 진행되지 않음

## 이슈 14. 서버 공통 overlap 검증 helper 추가

### 목표
- API 우회를 막기 위해 서버에서도 같은 overlap 검증을 수행합니다.

### 작업 범위
- 공통 helper 또는 route 내부 공용 로직 작성
- `store_users.id -> authUserId` 해석
- 같은 날짜 다른 지점 assignment 조회
- 시간 겹침 판정

### 완료 기준
- 서버에서 동일 규칙으로 충돌 판단 가능

## 이슈 15. `POST /api/schedule/assignments`에 overlap 검증 적용

### 목표
- 신규 배정 API에서 교차 지점 시간 겹침을 차단합니다.

### 작업 범위
- 기존 권한/availability 검사 뒤 overlap 검사 추가
- 충돌 시 `409`와 `conflicts` 반환

### 완료 기준
- UI 없이 API 직접 호출해도 겹치면 생성되지 않음

## 이슈 16. `PATCH /api/schedule/assignments/[id]`에 overlap 검증 적용

### 목표
- 수정 API에서도 교차 지점 시간 겹침을 차단합니다.

### 작업 범위
- 수정 대상 시간 계산
- 자기 자신 제외 조건 처리
- 충돌 시 `409`와 `conflicts` 반환

### 완료 기준
- 수정 API 직접 호출 시에도 겹치면 반영되지 않음

## 이슈 17. Quick XLSX export에 다른 지점 short code 반영

### 목표
- 현재 화면에서 빠르게 내보내는 XLSX에 다른 지점 표기를 추가합니다.

### 작업 범위
- 두 번째 row에 short code 표시
- 기존 두 번째 줄 텍스트와 함께 표기 규칙 결정
- legend 블록 추가

### 완료 기준
- quick XLSX에서 short code와 legend 확인 가능

## 이슈 18. PNG export에 다른 지점 short code 및 legend 반영

### 목표
- PNG export에서도 동일한 교차 지점 정보를 시각적으로 표현합니다.

### 작업 범위
- canvas 렌더링에 두 번째 줄 short code 추가
- 하단 legend 렌더링 추가

### 완료 기준
- PNG에 short code와 legend가 함께 보임

## 이슈 19. Advanced export API에 교차 지점 표기 반영

### 목표
- CSV/XLSX 서버 export에서도 동일한 교차 지점 규칙을 사용합니다.

### 작업 범위
- `/api/schedule/export`에 cross-store marker 계산 추가
- CSV row 포맷 확장
- XLSX 시트 포맷 확장
- legend 추가

### 완료 기준
- advanced CSV/XLSX에 short code와 legend 포함

## 이슈 20. 다국어 키 추가 및 신규 하드코딩 제거

### 목표
- 이번 기능에서 추가되는 사용자 문구를 모든 로케일에 반영합니다.

### 작업 범위
- `ko`, `en`, `ja` 키 추가
- 가져오기 탭/후보/결과 문구 추가
- 다른 지점 근무/충돌 경고/legend 문구 추가
- 새로 추가한 하드코딩 문자열 제거

### 완료 기준
- 신규 UI에서 하드코딩된 사용자 문구가 없음

## 이슈 21. API 테스트 추가

### 목표
- 핵심 서버 기능을 회귀 없이 검증합니다.

### 작업 범위
- import candidates API 테스트
- import 실행 API 테스트
- assignments POST overlap 테스트
- assignments PATCH overlap 테스트

### 완료 기준
- 정상/스킵/충돌 케이스가 모두 검증됨

## 이슈 22. E2E 테스트 추가

### 목표
- 실제 사용자 흐름 기준으로 핵심 시나리오를 검증합니다.

### 작업 범위
- users 페이지 다른 지점 유저 가져오기 테스트
- week-grid marker 표시 테스트
- 같은 날짜 비겹침 허용 테스트
- 같은 날짜 겹침 차단 테스트
- export short code/legend 테스트

### 완료 기준
- 주요 사용자 시나리오가 브라우저 수준에서 재현 가능

## 권장 구현 순서

1. 이슈 1
2. 이슈 2
3. 이슈 3
4. 이슈 4
5. 이슈 5
6. 이슈 6
7. 이슈 7
8. 이슈 8
9. 이슈 9
10. 이슈 10
11. 이슈 14
12. 이슈 15
13. 이슈 16
14. 이슈 11
15. 이슈 12
16. 이슈 13
17. 이슈 17
18. 이슈 18
19. 이슈 19
20. 이슈 20
21. 이슈 21
22. 이슈 22
