/**
 * Security Rules Verification Spec — Dirty Dozen Payloads
 * Validates that every unauthorized, malformed, spoofed, or shadow-field
 * mutation against /schedules/{scheduleId} and /admins/{adminUid} is denied.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: 'schedules' | 'admins';
  operation: 'create' | 'update' | 'delete' | 'get' | 'list';
  expected: 'PERMISSION_DENIED';
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  docId: string;
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated schedule creation',
    collection: 'schedules',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: null,
    docId: '2026-11_joao-silva',
    payload: { monthKey: '2026-11', employeeName: 'Joao Silva' },
  },
  {
    id: 2,
    name: 'Non-admin authenticated schedule creation',
    collection: 'schedules',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'regular-user-1', email: 'employee@example.com', email_verified: true },
    docId: '2026-11_joao-silva',
    payload: { monthKey: '2026-11', employeeName: 'Joao Silva' },
  },
  {
    id: 3,
    name: 'Unverified email spoofing bootstrapped admin',
    collection: 'schedules',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'spoof-1', email: 'tonny.azin@gmail.com', email_verified: false },
    docId: '2026-11_joao-silva',
    payload: { monthKey: '2026-11', employeeName: 'Joao Silva' },
  },
  {
    id: 4,
    name: 'Shadow field / PII injection on schedule',
    collection: 'schedules',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'admin-1', email: 'tonny.azin@gmail.com', email_verified: true },
    docId: '2026-11_joao-silva',
    payload: {
      monthKey: '2026-11',
      employeeName: 'Joao Silva',
      normalizedName: 'joao silva',
      department: 'Logistica',
      shift: '08:00 - 17:00',
      days: { '01': 'T' },
      isPublished: true,
      updatedBy: 'admin-1',
      ghostPiiEmail: 'leak@example.com',
    },
  },
  {
    id: 5,
    name: 'Oversized employeeName (> 80 chars)',
    collection: 'schedules',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'admin-1', email: 'tonny.azin@gmail.com', email_verified: true },
    docId: '2026-11_long-name',
    payload: { employeeName: 'A'.repeat(200) },
  },
  {
    id: 6,
    name: 'Document ID poisoning with invalid symbols',
    collection: 'schedules',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'admin-1', email: 'tonny.azin@gmail.com', email_verified: true },
    docId: 'bad$id!poisoning',
    payload: { monthKey: '2026-11' },
  },
  {
    id: 7,
    name: 'Invalid monthKey format',
    collection: 'schedules',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'admin-1', email: 'tonny.azin@gmail.com', email_verified: true },
    docId: '2026-11_joao',
    payload: { monthKey: '2026/11' },
  },
  {
    id: 8,
    name: 'Oversized days map (> 31 entries)',
    collection: 'schedules',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'admin-1', email: 'tonny.azin@gmail.com', email_verified: true },
    docId: '2026-11_joao',
    payload: {
      days: Object.fromEntries(Array.from({ length: 35 }, (_, i) => [String(i + 1), 'T'])),
    },
  },
  {
    id: 9,
    name: 'Identity spoofing via updatedBy mismatch',
    collection: 'schedules',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'admin-1', email: 'tonny.azin@gmail.com', email_verified: true },
    docId: '2026-11_joao',
    payload: { updatedBy: 'someone-else-uid' },
  },
  {
    id: 10,
    name: 'Client-forged createdAt timestamp',
    collection: 'schedules',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'admin-1', email: 'tonny.azin@gmail.com', email_verified: true },
    docId: '2026-11_joao',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
  },
  {
    id: 11,
    name: 'Immutable createdAt mutation on update',
    collection: 'schedules',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'admin-1', email: 'tonny.azin@gmail.com', email_verified: true },
    docId: '2026-11_joao',
    payload: { createdAt: '2026-12-01T00:00:00Z' },
  },
  {
    id: 12,
    name: 'Non-bootstrapped user self-assigning admin role',
    collection: 'admins',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'attacker-uid', email: 'attacker@example.com', email_verified: true },
    docId: 'attacker-uid',
    payload: { displayName: 'Attacker', role: 'admin', createdBy: 'attacker-uid' },
  },
];
