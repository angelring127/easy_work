# Repository Guidelines

## Project Structure & Module Organization
The app is a Next.js + TypeScript project with App Router.
- `src/app`: route handlers and pages (localized routes under `src/app/[locale]`).
- `src/components`: shared UI and feature widgets (`ui`, `layout`, `schedule`, `auth`).
- `src/features`: feature-scoped components (auth, stores, invites).
- `src/lib`: domain logic (Supabase clients, auth, validation, i18n, schedule utilities).
- `e2e`: Playwright specs, fixtures, page objects, and test setup scripts.
- `supabase/migrations`: SQL migrations for schema and policy changes.
- `public/locales`: translation JSON files (`en`, `ko`, `ja`).

## Build, Test, and Development Commands
- `npm run dev`: run local dev server on `http://localhost:3000`.
- `npm run build`: production build.
- `npm run start`: run built app.
- `npm run lint`: run Next.js ESLint checks.
- `npm run test:e2e`: run all Playwright E2E tests.
- `npm run test:e2e:ui`: run tests in Playwright UI mode.
- `npm run seed:test-users`: seed staging/test users from `.env.test`.
- `npm run cleanup:test-data`: remove generated test data.

## Coding Style & Naming Conventions
Use TypeScript with strict compiler mode enabled in `tsconfig.json`.
- Formatting in codebase: 2-space indentation, semicolons, double quotes.
- Components/hooks: PascalCase for components (`WeekGrid`), `useXxx` for hooks (`useAuth`).
- Files: kebab-case for most files (example: `user-availability-calendar.tsx`).
- Use `@/*` import alias for `src/*` paths.
- Lint with `next/core-web-vitals` + `next/typescript` (`npm run lint`).

## Localization Rules
- All user-facing text must use locale translation keys; do not hardcode strings in pages, components, or API responses.
- When adding or changing messages, update all supported locales (`ko`, `en`, `ja`) together.
- Keep this rule as the default for all future text changes.

## Testing Guidelines
E2E tests use Playwright (`playwright.config.ts`) with specs in `e2e/specs`.
- Naming: `*.spec.ts`, grouped by domain (`01-auth`, `02-stores`, etc.).
- Prefer fixtures/page objects from `e2e/fixtures` and `e2e/pages`.
- Before first run: copy `.env.test.example` to `.env.test`, then seed users.
- Run a focused suite example: `npx playwright test e2e/specs/03-invitations/`.

## Commit & Pull Request Guidelines
Commit history follows mostly conventional prefixes (`feat:`, `fix:`), often with Korean summaries. Keep format: `type: short summary`.
- Keep commits scoped to one change area.
- Reference affected domain when useful (auth, stores, schedule, i18n).
- PRs should include: purpose, key changes, test evidence (`npm run lint`, relevant Playwright run), and screenshots/GIFs for UI changes.
- Mention required env or migration changes explicitly (for example in `supabase/migrations`).
