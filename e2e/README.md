# E2E Testing with Playwright

This directory contains end-to-end tests for the Workeasy application using Playwright.

**Current Status**: Phase 2 Complete - 29 tests, 65% coverage
**Next Phase**: Phase 3 - Schedule management and advanced features

📊 **Progress Details**: See [PROGRESS.md](PROGRESS.md)

---

## Quick Start

```bash
# 1. Setup (first time only)
cp .env.test.example .env.test  # Add your Supabase credentials
npm run seed:test-users         # Create test users

# 2. Run tests
npm run test:e2e                # All tests
npm run test:e2e:ui             # Interactive UI mode (best for debugging)
npm run test:e2e:report         # View HTML report
```

---

## Setup

### 1. Install Dependencies

Dependencies are already installed. If you need to reinstall:

```bash
npm install
npx playwright install chromium
```

### 2. Configure Test Environment

Create `.env.test` file based on `.env.test.example`:

```bash
cp .env.test.example .env.test
```

Edit `.env.test` and add your credentials:

```env
# Supabase Staging Environment
NEXT_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_staging_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_staging_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Test User Credentials
TEST_MASTER_EMAIL=test-master@workeasy.test
TEST_MASTER_PASSWORD=TestPassword123!

TEST_SUB_MANAGER_EMAIL=test-submanager@workeasy.test
TEST_SUB_MANAGER_PASSWORD=TestPassword123!

TEST_PART_TIMER_EMAIL=test-parttimer@workeasy.test
TEST_PART_TIMER_PASSWORD=TestPassword123!

# Real User (optional, for additional testing)
REAL_USER_EMAIL=your-real-email@example.com
REAL_USER_PASSWORD=your-password
```

### 3. Create Test Users

Run the seed script to create test users in your staging database:

```bash
npm run seed:test-users
```

**Expected output:**
```
✓ Connected to Supabase successfully
✓ MASTER user created/verified: test-master@workeasy.test
✓ SUB_MANAGER user created/verified: test-submanager@workeasy.test
✓ PART_TIMER user created/verified: test-parttimer@workeasy.test
```

---

## Running Tests

### All Tests

```bash
npm run test:e2e
```

### Specific Test Suite

```bash
# Authentication tests only
npx playwright test e2e/specs/01-auth/

# Store management tests only
npx playwright test e2e/specs/02-stores/

# Invitation tests only
npx playwright test e2e/specs/03-invitations/

# Specific test file
npx playwright test e2e/specs/02-stores/create-store.spec.ts
```

### Interactive Modes

```bash
# UI Mode (best for debugging)
npm run test:e2e:ui

# Headed Mode (see browser)
npm run test:e2e:headed

# Debug Mode (step through tests)
npm run test:e2e:debug
```

### View Test Report

```bash
npm run test:e2e:report
```

---

## Directory Structure

```
e2e/
├── specs/                    # Test files organized by feature
│   ├── 01-auth/             # ✅ Authentication tests (9 tests)
│   │   ├── login.spec.ts
│   │   └── critical-path.spec.ts
│   ├── 02-stores/           # ✅ Store management tests (6 tests)
│   │   └── create-store.spec.ts
│   ├── 03-invitations/      # ✅ Invitation system tests (14 tests)
│   │   ├── email-invite.spec.ts
│   │   ├── guest-invite.spec.ts
│   │   └── accept-invitation.spec.ts
│   ├── 04-schedule/         # 🔄 Schedule tests (Phase 3)
│   ├── 05-rbac/             # 🔄 RBAC tests (Phase 3)
│   └── 06-i18n/             # 🔄 i18n tests (Phase 3)
├── pages/                   # Page Object Models
│   ├── login.page.ts
│   ├── signup.page.ts
│   ├── dashboard.page.ts
│   ├── store-create.page.ts        # ✅ Phase 2
│   ├── store-list.page.ts          # ✅ Phase 2
│   ├── invitation.page.ts          # ✅ Phase 2
│   └── invite-accept.page.ts       # ✅ Phase 2
├── fixtures/                # Test fixtures
│   ├── auth.fixture.ts             # ✅ Multi-role authentication
│   ├── store.fixture.ts            # ✅ Phase 2
│   └── database.fixture.ts         # ✅ Phase 2
├── utils/                   # Utility functions
│   ├── database.ts                 # ✅ DB helpers
│   ├── test-data-factory.ts       # ✅ Phase 2
│   └── api-helpers.ts              # ✅ Phase 2
├── setup/                   # Setup scripts
│   ├── seed-users.ts
│   └── cleanup.ts
├── README.md               # This file
└── PROGRESS.md             # Implementation progress
```

---

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';

test.describe('Login Flow', () => {
  test('should login successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('en');
    await loginPage.login('test@example.com', 'password');
    await loginPage.waitForDashboard();

    expect(page.url()).toContain('/dashboard');
  });
});
```

### Using Authenticated Fixtures

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test('MASTER can create store', async ({ masterPage }) => {
  // masterPage is already authenticated as MASTER user
  await masterPage.goto('/en/stores/create');
  // ... test logic
});

test('PART_TIMER cannot access store creation', async ({ partTimerPage }) => {
  // partTimerPage is authenticated as PART_TIMER user
  await partTimerPage.goto('/en/stores/create');
  // Should be redirected or see error
});
```

### Using Store Fixture

```typescript
import { test, expect } from '../../fixtures/store.fixture';

test('Can create invitation in store', async ({ masterPage, testStore }) => {
  // testStore is automatically created and cleaned up
  await masterPage.goto(`/en/stores/${testStore.id}/users`);
  // ... test logic
});
```

### Using Test Data Factory

```typescript
import { generateStoreData, generateInvitationEmail } from '../../utils/test-data-factory';

const storeData = generateStoreData({
  name: 'Custom Store Name',  // Override defaults
  timezone: 'Asia/Tokyo',
});

const inviteEmail = generateInvitationEmail(); // test-invite-1234567890@workeasy.test
```

---

## Current Test Coverage

### Phase 1 Complete ✅ (9 tests)
- Authentication flow (login, signup, critical path)
- Multi-locale support (ko, en, ja)
- Error handling and validation

### Phase 2 Complete ✅ (20 tests)
- Store creation and RBAC enforcement
- Email-based invitations (create, resend, cancel)
- Guest user registration (no email required)
- Invitation acceptance flow

**Total**: 29 tests covering ~65% of core functionality

See [PROGRESS.md](PROGRESS.md) for detailed breakdown and next steps.

---

## Test Maintenance

### Cleanup Test Data

```bash
npm run cleanup:test-data
```

This removes:
- Test stores (name starts with `test-store-`)
- Test invitations (email starts with `test-invite-`)
- Guest users (name starts with `게스트-`)

### Update Test Users

If test users need to be recreated:

```bash
npm run cleanup:test-data
npm run seed:test-users
```

---

## Troubleshooting

### Tests Failing to Connect

1. Check `.env.test` has correct Supabase credentials
2. Verify staging database is accessible
3. Run seed script: `npm run seed:test-users`
4. Check Supabase dashboard for RLS policy issues

### Tests Timeout

1. Increase timeout in `playwright.config.ts`
2. Check if dev server is running: `npm run dev`
3. Use headed mode to see what's happening: `npm run test:e2e:headed`
4. Check network tab in browser for API errors

### Flaky Tests

1. Tests may fail intermittently due to timing issues
2. Use explicit waits: `waitFor({ state: 'visible' })`
3. Check trace files in `test-results/` for debugging
4. Re-run failed tests: `npx playwright test --last-failed`

### Clean Up After Failed Tests

```bash
npm run cleanup:test-data
```

---

## Best Practices

### Page Object Model (POM)

- Keep page logic separate from test logic
- Use meaningful method names: `await loginPage.login()` not `await page.click('#submit')`
- Return promises or use async/await consistently
- Add explicit waits in page objects, not in tests

### Test Data

- Always use unique identifiers (timestamps) for test data
- Clean up test data in `afterAll` hooks
- Use fixtures for automatic setup/teardown
- Don't hardcode test data in tests

### Test Organization

- Group related tests in `describe` blocks
- Use descriptive test names: "should show error for invalid email"
- One assertion per test when possible
- Independent tests (no dependencies between tests)

### Error Handling

- Add explicit error messages to assertions
- Use `expect().toContain()` for flexible matching
- Capture screenshots on failure (automatic)
- Use trace viewer for debugging: `npx playwright show-trace trace.zip`

---

## CI/CD Integration (Planned - Phase 4)

GitHub Actions workflow will be added to:
- Run tests on every PR
- Parallel execution with sharding (4 workers)
- Upload test reports and traces as artifacts
- Block merge if tests fail

---

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Test Best Practices](https://playwright.dev/docs/best-practices)
- [Page Object Model](https://playwright.dev/docs/pom)
- [Fixtures](https://playwright.dev/docs/test-fixtures)
- [Debugging Guide](https://playwright.dev/docs/debug)
