# 다른 지점 유저 가져오기 및 교차 지점 스케줄 충돌 처리 체크리스트

## 진행 상태
- [ ] 시작 전
- [ ] 진행 중
- [ ] 리뷰 대기
- [ ] 완료

## 1단계. 다른 지점 유저 가져오기

### API
- [ ] `POST /api/stores/[id]/users/import` 추가
- [ ] 대상 지점 관리자 권한 검증
- [ ] source store 접근 가능 여부 검증
- [ ] 게스트 유저 제외 처리
- [ ] `user_store_roles` 생성 또는 복구
- [ ] 기존 트리거로 `store_users` 생성 확인
- [ ] 감사 로그 추가
- [ ] `imported`, `skipped`, `alreadyExists` 응답 구조 반환

### UI
- [ ] 초대 모달에 email / guest / 다른 지점 유저 3개 모드 추가
- [ ] source-store 탭 UI 추가
- [ ] 선택한 source store의 후보 유저 로드
- [ ] 현재 지점 active 멤버 제외 처리
- [ ] 단일 선택 / 다중 선택 지원
- [ ] 현재 지점 역할 선택 재사용
- [ ] 가져오기 후 멤버 목록 갱신
- [ ] 성공/오류 문구 다국어 적용

## 2단계. 스케줄 데이터 연결

### 데이터 로딩
- [ ] 현재 지점 사용자 데이터에 `authUserId` 추가
- [ ] schedule page에서 교차 지점 배정 조회 추가
- [ ] 공통 `CrossStoreAssignment` 타입 정의
- [ ] `WeekGrid`에 교차 지점 데이터 전달
- [ ] `ScheduleExporter`에 교차 지점 데이터 전달

### WeekGrid 표시
- [ ] 셀에 다른 지점 근무 마커 표시
- [ ] tooltip에 지점명과 시간 표시
- [ ] 기존 assignment / availability 표시와 함께 가독성 유지

## 3단계. 시간 겹침 차단

### 클라이언트 검사
- [ ] 신규 배정 전 시간 겹침 검사
- [ ] 기존 배정 교체 전 시간 겹침 검사
- [ ] 다중 날짜 배정 시 시간 겹침 검사
- [ ] 충돌 지점/시간을 보여주는 차단 경고 다이얼로그 표시

### 서버 검사
- [ ] `POST /api/schedule/assignments`에 겹침 검증 추가
- [ ] `PATCH /api/schedule/assignments/[id]`에 겹침 검증 추가
- [ ] 충돌 시 `409` 응답 구조 추가
- [ ] availability 경고와 overlap 차단을 분리 유지

## 4단계. Export 지원

### Quick export
- [ ] quick XLSX 두 번째 줄에 다른 지점 short code 표시
- [ ] quick XLSX legend 블록 추가
- [ ] PNG export 두 번째 줄에 다른 지점 short code 표시
- [ ] PNG export legend 블록 추가

### Advanced export
- [ ] `/api/schedule/export`에 교차 지점 마커 계산 추가
- [ ] CSV export에 마커 반영
- [ ] XLSX export에 마커 반영
- [ ] 모든 export 형식에 legend 추가

### Short code 생성
- [ ] 지점 short code 생성기 구현
- [ ] 첫 글자 중복 시 shortest unique prefix 처리
- [ ] UI / export에서 동일 생성기 재사용

## 5단계. 다국어

- [ ] 한국어 locale 키 추가
- [ ] 영어 locale 키 추가
- [ ] 일본어 locale 키 추가
- [ ] 신규 사용자 노출 문자열 하드코딩 제거

## 6단계. 테스트

### API / 통합 테스트
- [ ] 1명 가져오기 성공 케이스
- [ ] 여러 명 가져오기 성공 케이스
- [ ] 현재 지점 이미 존재 유저 skip 케이스
- [ ] create API overlap 충돌 응답 테스트
- [ ] update API overlap 충돌 응답 테스트

### E2E
- [ ] users 페이지에서 다른 지점 유저 가져오기 흐름 테스트
- [ ] week-grid 다른 지점 마커 표시 테스트
- [ ] 같은 날짜 비겹침 배정 허용 테스트
- [ ] 같은 날짜 겹침 배정 차단 테스트
- [ ] export에 short code와 legend 포함 테스트

### 회귀
- [ ] 이메일 초대 정상 동작 확인
- [ ] 게스트 등록 정상 동작 확인
- [ ] 일반 같은 지점 스케줄 기능 정상 동작 확인
- [ ] 기존 export 다운로드 정상 동작 확인

## 리뷰 메모
- [ ] UI 문구가 요구사항 표현과 맞는지 확인
- [ ] export short code 가독성 확인
- [ ] 차단 경고 다이얼로그 문구 다국어 확인
- [ ] 게스트 유저가 후보 목록에 노출되지 않는지 확인

## 관련 문서

- 세부 이슈 백로그: `specs/cross-store-staff-import-and-conflict-handling.issues.md`
