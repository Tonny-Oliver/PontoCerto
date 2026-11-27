# Security Specification — PontoCerto Schedules (Phase 0)

## 1. Data Invariants

1. **Supervisor-Only Writes**: Only an authenticated, email-verified supervisor (`tonny.azin@gmail.com` or an existing UID in `/admins/{uid}`) may create, update, or delete any document in `/schedules/{scheduleId}`.
2. **PII-Free Public Consultation**: Documents in `/schedules/{scheduleId}` strictly forbid PII fields (no email, phone, CPF, or address) via `hasOnly(...)`. Employees may read only documents where `isPublished == true`.
3. **Immutable Ownership & Timestamps**: `createdAt` must equal `request.time` on creation and never change on update; `updatedAt` must always equal `request.time`; `updatedBy` must always equal `request.auth.uid`.
4. **Strict ID & Payload Sizing**: Every document ID (`scheduleId`, `adminUid`) must satisfy `isValidId()` (`<= 128` chars, `^[a-zA-Z0-9_\-]+$`). Every string has explicit min/max `.size()` bounds, and `days` is strictly a map with `.size() <= 31`.
5. **No Self-Assigned Admin Privileges**: Non-bootstrapped users cannot create, update, or delete documents in `/admins/{adminUid}`, nor list `/admins`.
6. **Verified Email Requirement**: Spoofed tokens where `email_verified != true` are strictly rejected even if the email string matches the bootstrapped admin.

## 2. The "Dirty Dozen" Attack Payloads

1. **Unauthenticated Schedule Write**: Anonymous/signed-out client attempts `setDoc('/schedules/2026-11_joao', validSchedule)` -> MUST return `PERMISSION_DENIED`.
2. **Non-Admin Authenticated Write**: Regular signed-in Google user (not in `/admins` and not `tonny.azin@gmail.com`) attempts to create a schedule -> MUST return `PERMISSION_DENIED`.
3. **Email Spoofing Attack**: Token with `email: 'tonny.azin@gmail.com'` and `email_verified: false` attempts to write a schedule -> MUST return `PERMISSION_DENIED`.
4. **Shadow Field Injection (Ghost Field)**: Verified admin sends valid schedule plus extra key `isAdmin: true` or `email: 'leak@test.com'` -> MUST return `PERMISSION_DENIED`.
5. **Oversized String / Denial of Wallet**: Verified admin sends `employeeName` with 500 characters (`> 80`) -> MUST return `PERMISSION_DENIED`.
6. **Document ID Poisoning**: Verified admin attempts to write to `/schedules/bad$id!with*symbols` or an ID > 128 chars -> MUST return `PERMISSION_DENIED`.
7. **Invalid `monthKey` Pattern**: Verified admin sends `monthKey: '2026/11'` (violating `^[0-9]{4}-[0-9]{2}$`) -> MUST return `PERMISSION_DENIED`.
8. **Oversized `days` Map**: Verified admin sends a `days` map with 35 entries (`> 31`) -> MUST return `PERMISSION_DENIED`.
9. **Identity Spoofing on `updatedBy`**: Verified admin attempts to write `updatedBy: 'another-uid'` instead of `request.auth.uid` -> MUST return `PERMISSION_DENIED`.
10. **Client-Forged Timestamp**: Verified admin attempts to set `createdAt` or `updatedAt` to a past timestamp instead of `request.time` -> MUST return `PERMISSION_DENIED`.
11. **Immutable `createdAt` Mutation**: Verified admin attempts to alter `createdAt` during an `update` -> MUST return `PERMISSION_DENIED`.
12. **Self-Assigned Admin Escalation**: Non-bootstrapped authenticated user attempts to create `/admins/{ownUid}` with `role: 'admin'` -> MUST return `PERMISSION_DENIED`.
