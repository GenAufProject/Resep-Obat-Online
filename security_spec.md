# Security Specification: Rekap Resep Obat

## 1. Data Invariants
- **Identity Integrity**: A user can only access (`get`, `list`, `create`, `update`, `delete`) their own prescription resource. The resource's `userId` field must exactly match the authenticated user's ID (`request.auth.uid`).
- **Verifiable Authentication**: The user must be signed in with an email-verified status (`request.auth.token.email_verified == true`).
- **Bounded Resource Allocations**: The `medicines` list size must be limited (`size() <= 20`) to prevent high memory or denial of wallet exploits.
- **Strict Key Adherence**: No "Ghost Fields" or shadow variables can be appended.
- **Immutable Foundations**: Owner ID (`userId`) and creation stamp (`createdAt`) are immutable.

---

## 2. The "Dirty Dozen" (Malicious Payloads)
The following 12 payloads attempt to bypass Identity, Integrity, or State invariants:

1. **Spoofed Ownership**:
   Creating a prescription where `userId` is set to `"someone_else_uid"`.
2. **Missing Auth Access**:
   Creating or updating a prescription document without any authentication.
3. **Unverified Email Privilege**:
   Attempting a write when `request.auth.token.email_verified` is `false`.
4. **Immortality Mutation**:
   Trying to modify `userId` or `createdAt` during an update.
5. **Timestamp Tampering (Creation)**:
   Specifying a client-fabricated `createdAt` timestamp (e.g., in the past).
6. **Timestamp Tampering (Update)**:
   Specifying an out-of-sync `updatedAt` during a resource edit.
7. **Phantom/Ghost Fields**:
   Injecting `isAdmin: true` inside a prescription payload.
8. **Malicious Array Bloating**:
   A `medicines` array exceeding 20 objects to exhaust layout.
9. **Malformed Drug Record**:
   An item inside `medicines` missing required properties (`nama` or `kategori`).
10. **Quantity Poisoning**:
    A drug quantity (`jumlah`) with negative values or floating-point decimals.
11. **Path Variable ID Poisoning**:
    Injecting a 10KB string as the doc ID (`prescriptionId`) to abuse index cost.
12. **Blanket Query Scrape**:
    Attempting a collection query (`list`) without checking `resource.data.userId == request.auth.uid`.

---

## 3. Test Runner Design Guide
Our tests are structural. `firestore.rules.test.ts` validates that each of these attempts returns a strict `PERMISSION_DENIED`.

To achieve zero-trust security, we will craft the corresponding ruleset in `firestore.rules` and verify them.
