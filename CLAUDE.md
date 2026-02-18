# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Workeasy** - A SaaS solution for small cafes and restaurants to automate shift scheduling, manage shift swaps, and enable real-time team communication. Built with Next.js 16, TypeScript, Supabase, and a custom i18n system.

## Development Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack (port 3000)

# Production
npm run build           # Build for production
npm run start           # Start production server

# Code Quality
npm run lint            # Run ESLint

# Package Manager
# Always use npm (not yarn/pnpm/bun)
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 16 (App Router with `proxy.ts` instead of `middleware.ts`)
- **Language**: TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Styling**: TailwindCSS + shadcn/ui
- **State**: @tanstack/react-query (server state), zustand (client state)
- **Forms**: react-hook-form + zod
- **Date Handling**: date-fns
- **Utilities**: es-toolkit, ts-pattern, react-use

### Critical: Next.js 16 Changes
- **File renamed**: `src/middleware.ts` → `src/proxy.ts`
- **Function renamed**: `export async function middleware()` → `export async function proxy()`
- **Config removed**: `eslint` config is no longer supported in `next.config.ts`

### Supabase Client Pattern

**IMPORTANT**: There are THREE different Supabase client creation functions with distinct purposes:

1. **`createClient()` from `@/lib/supabase/client`** (Client-side)
   - Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - For client components and browser interactions

2. **`createClient()` from `@/lib/supabase/server`** (Server-side, cookie-based)
   - Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - For regular user authentication and operations
   - Cookie-based session management
   - Used in API routes for normal user operations (login, signup, etc.)

3. **`createPureClient()` from `@/lib/supabase/server`** (Admin operations)
   - Uses `SUPABASE_SERVICE_ROLE_KEY`
   - **REQUIRED for all `auth.admin.*` operations**
   - Used for: `auth.admin.listUsers()`, `auth.admin.getUserById()`, `auth.admin.createUser()`, etc.
   - NO cookie handling (pure service role client)

**When to use each:**
```typescript
// ❌ WRONG - Will cause "User not allowed" errors
const supabase = await createClient();
await supabase.auth.admin.listUsers(); // ERROR!

// ✅ CORRECT - Use createPureClient for admin operations
const adminClient = await createPureClient();
await adminClient.auth.admin.listUsers(); // Works!

// ✅ CORRECT - Use createClient for normal user operations
const supabase = await createClient();
await supabase.auth.signInWithPassword({ email, password }); // Works!
```

### Custom i18n System

**Key Point**: This project uses a **custom i18n system**, NOT next-i18next or other libraries.

**Architecture**:
- **Flat structure translations**: `src/lib/i18n.ts` contains all translation data
- **URL-based routing**: `[locale]` dynamic segment (`/ko`, `/en`, `/ja`)
- **Cookie persistence**: User language preference stored in `locale` cookie
- **Middleware handling**: `src/proxy.ts` handles language detection and redirects

**Translation function**:
```typescript
import { getTranslation } from "@/lib/i18n";

// Server components
const { t } = getTranslation(locale);
const title = t("home.title");

// Client components
const { t } = getTranslation(locale);
const buttonText = t("auth.login.submit");
```

**Language detection priority**:
1. URL locale (`/ko/dashboard`)
2. Cookie value (`locale=ko`)
3. Accept-Language header
4. Default locale (`en`)

**Adding new translations**:
1. Add to all language objects in `src/lib/i18n.ts`
2. Use flat key structure: `"feature.component.element": "Translation"`
3. No nesting allowed

### Directory Structure

```
src/
├── app/
│   ├── [locale]/              # i18n routing (ko, en, ja)
│   │   ├── page.tsx          # Home page
│   │   ├── login/            # Auth pages
│   │   ├── signup/
│   │   ├── dashboard/        # Main app pages
│   │   └── stores/           # Store management
│   └── api/                  # API Routes
│       ├── auth/             # Authentication endpoints
│       ├── stores/           # Store management APIs
│       ├── schedule/         # Scheduling APIs
│       └── invitations/      # Invitation system
├── components/ui/            # shadcn components
├── features/                 # Feature-based modules
│   └── [featureName]/
│       ├── components/
│       ├── hooks/
│       └── lib/
├── lib/
│   ├── i18n.ts              # Custom i18n system
│   ├── i18n-config.ts       # i18n config (for middleware)
│   ├── supabase/
│   │   ├── client.ts        # Browser client (Anon Key)
│   │   ├── server.ts        # Server client (Anon Key + Service Role)
│   │   └── middleware.ts    # Middleware client
│   └── utils.ts
├── proxy.ts                 # Next.js 16 proxy (was middleware.ts)
└── middleware.ts            # DEPRECATED - now proxy.ts
```

### Database Migrations

**Location**: `supabase/migrations/*.sql`

**Naming Convention**: `YYYYMMDD000000_description.sql`

**Guidelines**:
- Each migration must be idempotent
- Use `CREATE TABLE IF NOT EXISTS`
- Include `updated_at` column with trigger
- Use snake_case for all identifiers
- Check existing migrations to avoid conflicts
- Always use RLS (Row Level Security) for access control

**Key Tables**:
- `stores`: Store information
- `user_store_roles`: User roles per store (MASTER, SUB_MANAGER, PART_TIMER)
- `store_users`: User profiles within stores (includes guest users)
- `invitations`: Invitation system
- `schedule_assignments`: Shift assignments
- `user_availability`: User availability tracking

### Role-Based Access Control (RBAC)

**Roles** (in `user_store_roles.role`):
- `MASTER`: Owner, can manage multiple stores
- `SUB_MANAGER`: Delegated admin for specific stores
- `PART_TIMER`: Employee with basic access

**Scope**: Store-based (`store_id`)

**Implementation**:
- RLS policies on all tables with `store_id`
- API middleware checks user role before operations
- Future: Store-specific chat channels

## Code Style Guidelines

### Must Follow
- Always use `"use client"` directive for all components
- Use promise for `page.tsx` params props: `{ params }: { params: Promise<{ id: string }> }`
- Use valid picsum.photos for placeholder images
- Prefer early returns over nested conditionals
- Use descriptive variable names
- Functional and immutable code patterns
- Minimize AI-generated comments - use clear naming instead

### Component Patterns
```typescript
// ✅ GOOD - Clear, functional
async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return <NotFound />;

  const data = await fetchData(id);
  if (!data) return <EmptyState />;

  return <Content data={data} />;
}

// ❌ BAD - Nested, unclear
async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id) {
    const data = await fetchData(id);
    if (data) {
      return <Content data={data} />;
    } else {
      return <EmptyState />;
    }
  } else {
    return <NotFound />;
  }
}
```

### Adding shadcn Components
When adding new shadcn components, provide installation commands:
```bash
npx shadcn@latest add card
npx shadcn@latest add textarea
npx shadcn@latest add dialog
```

## Common Patterns

### API Route Structure
```typescript
import { createClient, createPureClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // For admin operations, use createPureClient
    const adminClient = await createPureClient();
    const { data: users } = await adminClient.auth.admin.listUsers();

    // Your logic here

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

### i18n in Pages
```typescript
import { getTranslation } from "@/lib/i18n";

export default async function Page({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params;
  const { t } = getTranslation(locale as any);

  return (
    <div>
      <h1>{t("page.title")}</h1>
      <p>{t("page.description")}</p>
    </div>
  );
}
```

### Authentication Check in Middleware (proxy.ts)
The `src/proxy.ts` handles:
1. **Language routing**: Redirects to `/{locale}/path`
2. **Authentication**: Checks session for protected routes
3. **Session refresh**: Auto-refreshes expiring sessions

Public paths (no auth required):
- `/`, `/login`, `/signup`, `/auth/*`, `/invites/error`, `/invites/verify-email`

## Environment Variables

Required in `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_APP_URL=your_app_url
```

## Testing

### E2E Testing (Playwright)

**Status**: Phase 2 Complete (29 tests, 65% coverage)

This project has comprehensive E2E tests covering authentication, store management, and invitation systems.

**Quick Start**:
```bash
# Setup (first time only)
cp .env.test.example .env.test  # Add your credentials
npm run seed:test-users         # Create test users

# Run tests
npm run test:e2e                # All tests
npm run test:e2e:ui             # UI mode (debugging)
npm run test:e2e:report         # View results
```

**📖 Detailed Documentation**: See [`e2e/README.md`](e2e/README.md) for complete guide
**📊 Progress Tracking**: See [`e2e/PROGRESS.md`](e2e/PROGRESS.md) for implementation status

### Manual Testing

When creating migrations or DB changes:
- Test API endpoint: `http://localhost:3000/api/test/supabase`
- Check Supabase dashboard for RLS policy issues
- Verify both authenticated and unauthenticated access

## Common Issues & Solutions

### "User not allowed" / 403 errors in admin operations
- **Cause**: Using `createClient()` instead of `createPureClient()` for admin operations
- **Fix**: Use `createPureClient()` for all `auth.admin.*` calls

### "Unexpected token '<', is not valid JSON" in auth
- **Cause**: Wrong Supabase key being used (Service Role instead of Anon)
- **Fix**: Ensure `createClient()` uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Translation keys not found
- **Cause**: Missing translation in `src/lib/i18n.ts`
- **Fix**: Add translation to all language objects (ko, en, ja)

### Korean text showing as garbled characters
- **Cause**: File encoding issue
- **Fix**: Ensure all files are saved as UTF-8

## Product Context

This is an MVP for small cafe/restaurant shift management with:
- Auto-generated schedules based on employee availability
- Shift swap requests (employee → employee → manager approval)
- Real-time chat (Global and Store channels)
- Push notifications for schedule changes
- Multi-store support with delegated admin roles

Current implementation status:
- ✅ Authentication system
- ✅ Custom i18n (ko, en, ja)
- ✅ Store management
- ✅ User invitation system
- ✅ Basic RBAC structure
- 🔄 Schedule auto-assignment (in progress)
- 🔄 Shift swap system (planned)
- 🔄 Chat system (planned)
