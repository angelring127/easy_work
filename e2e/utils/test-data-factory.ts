import { StoreData } from '../pages/store-create.page';

export function generateTimestamp(): string {
  return Date.now().toString();
}

export function generateStoreName(): string {
  return `test-store-${generateTimestamp()}`;
}

export function generateStoreCode(): string {
  return `CODE-${generateTimestamp()}`;
}

export function generateStoreData(overrides?: Partial<StoreData>): StoreData {
  return {
    name: generateStoreName(),
    description: 'Test store for E2E testing',
    address: '123 Test Street, Seoul, South Korea',
    phone: '010-1234-5678',
    timezone: 'Asia/Seoul',
    ...overrides,
  };
}

export function generateInvitationEmail(): string {
  return `test-invite-${generateTimestamp()}@workeasy.test`;
}

export function generateGuestName(): string {
  return `게스트-${generateTimestamp()}`;
}

export function generateUserName(): string {
  return `테스트사용자-${generateTimestamp()}`;
}

export function generatePassword(): string {
  return `TestPass${generateTimestamp()}!`;
}

export function generateUniqueId(): string {
  return `test-${generateTimestamp()}-${Math.random().toString(36).substring(7)}`;
}

export const TEST_PASSWORDS = {
  valid: 'TestPassword123!',
  weak: '123',
  medium: 'Test123',
  strong: 'TestPassword123!@#',
} as const;

export const TEST_EMAILS = {
  valid: 'test@example.com',
  invalid: 'not-an-email',
  malformed: '@example.com',
  noAt: 'testexample.com',
} as const;

export const TEST_PHONE_NUMBERS = {
  korea: '010-1234-5678',
  us: '+1-555-123-4567',
  japan: '+81-90-1234-5678',
  invalid: '123',
} as const;

export const TEST_TIMEZONES = {
  seoul: 'Asia/Seoul',
  tokyo: 'Asia/Tokyo',
  newYork: 'America/New_York',
  losAngeles: 'America/Los_Angeles',
  london: 'Europe/London',
  paris: 'Europe/Paris',
} as const;

export const TEST_ROLES = {
  master: 'MASTER',
  subManager: 'SUB_MANAGER',
  partTimer: 'PART_TIMER',
  guest: 'GUEST',
} as const;

export const TEST_INVITATION_EXPIRY_DAYS = {
  day: 1,
  threeDays: 3,
  week: 7,
  twoWeeks: 14,
  month: 30,
} as const;
