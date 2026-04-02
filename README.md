이 프로젝트는 [`EasyNext`](https://github.com/easynext/easynext)를 사용해 생성된 [Next.js](https://nextjs.org) 프로젝트입니다.

## Getting Started

개발 서버를 실행합니다.<br/>
환경에 따른 명령어를 사용해주세요.

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 결과를 확인할 수 있습니다.

`app/page.tsx` 파일을 수정하여 페이지를 편집할 수 있습니다. 파일을 수정하면 자동으로 페이지가 업데이트됩니다.

## Supabase 설정

### 1. 환경변수 설정

`.env.example` 파일을 참고하여 `.env.local` 파일을 생성하고 다음 환경변수들을 설정하세요:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
```

### 2. Supabase 프로젝트 설정

1. [Supabase 콘솔](https://supabase.com)에서 새 프로젝트 생성
2. Settings > API에서 URL과 키 정보 복사
3. 위의 환경변수에 실제 값 입력

### 3. 연결 테스트

개발 서버 실행 후 다음 URL로 연결 상태를 확인할 수 있습니다:

```
http://localhost:3000/api/test/supabase
```

## 관리자 계정 프로비저닝

관리자 계정은 공개 회원가입이 아니라 내부 프로비저닝 스크립트로 생성하거나 갱신합니다.

### 1. 환경변수 준비

`.env.local`에 아래 값을 추가하세요:

```bash
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeMe123!
```

- 대부분의 경우 `ADMIN_EMAIL`, `ADMIN_PASSWORD`만 설정하면 됩니다.
- 기본값:
  - `ADMIN_PLATFORM_ROLE`: `SYSTEM_ADMIN`
  - `ADMIN_USER_ROLE`: `MASTER`
  - `ADMIN_NAME`: `System Admin`

고급 옵션이 필요할 때만 아래 값을 추가로 지정하세요:

```bash
ADMIN_NAME=System Admin
ADMIN_PLATFORM_ROLE=SYSTEM_ADMIN
ADMIN_USER_ROLE=MASTER
```

- `ADMIN_PLATFORM_ROLE`: `SYSTEM_ADMIN`, `OPS_ANALYST`, `SUPPORT_AGENT`, `READ_ONLY_AUDITOR`
- `ADMIN_USER_ROLE`: `MASTER`, `SUB_MANAGER`, `PART_TIMER`

### 2. 관리자 계정 생성 또는 갱신

```bash
npm run provision:admin
```

이 스크립트는 같은 이메일 계정이 이미 있으면 비밀번호와 메타데이터를 갱신하고, 없으면 새로 생성합니다.

### 3. 관리자 로그인

관리자 전용 로그인 페이지는 다음 경로입니다:

```bash
http://localhost:3000/ko/admin/login
```

## 기본 포함 라이브러리

- [Next.js](https://nextjs.org)
- [React](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org)
- [ESLint](https://eslint.org)
- [Prettier](https://prettier.io)
- [Shadcn UI](https://ui.shadcn.com)
- [Lucide Icon](https://lucide.dev)
- [date-fns](https://date-fns.org)
- [react-use](https://github.com/streamich/react-use)
- [es-toolkit](https://github.com/toss/es-toolkit)
- [Zod](https://zod.dev)
- [React Query](https://tanstack.com/query/latest)
- [React Hook Form](https://react-hook-form.com)
- [TS Pattern](https://github.com/gvergnaud/ts-pattern)
- [Supabase](https://supabase.com) - 인증 및 데이터베이스

## 사용 가능한 명령어

한글버전 사용

```sh
easynext lang ko
```

최신버전으로 업데이트

```sh
npm i -g @easynext/cli@latest
# or
yarn add -g @easynext/cli@latest
# or
pnpm add -g @easynext/cli@latest
```

Supabase 설정

```sh
easynext supabase
```

Next-Auth 설정

```sh
easynext auth

# ID,PW 로그인
easynext auth idpw
# 카카오 로그인
easynext auth kakao
```

유용한 서비스 연동

```sh
# Google Analytics
easynext gtag

# Microsoft Clarity
easynext clarity

# ChannelIO
easynext channelio

# Sentry
easynext sentry

# Google Adsense
easynext adsense
```
