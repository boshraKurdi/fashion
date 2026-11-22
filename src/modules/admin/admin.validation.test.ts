import assert from "node:assert/strict";
import test from "node:test";
import { shopDecisionSchema, shopIdSchema, shopListQuerySchema } from "./admin.validation.js";

test("shop list query defaults to pending and validates pagination", () => {
  assert.deepEqual(shopListQuerySchema.parse({}), { page: 1, limit: 10, status: "PENDING" });
  assert.equal(shopListQuerySchema.safeParse({ status: "UNKNOWN" }).success, false);
  assert.equal(shopListQuerySchema.safeParse({ page: 0 }).success, false);
});

test("shop decisions require a reason when rejecting", () => {
  assert.equal(shopDecisionSchema.safeParse({ decision: "APPROVED" }).success, true);
  assert.equal(shopDecisionSchema.safeParse({ decision: "REJECTED", rejectionReason: "Incomplete documents" }).success, true);
  assert.equal(shopDecisionSchema.safeParse({ decision: "REJECTED" }).success, false);
  assert.equal(shopDecisionSchema.safeParse({ decision: "APPROVED", status: "APPROVED" }).success, false);
});

test("shop path IDs must be positive decimal integers", () => {
  assert.equal(shopIdSchema.safeParse({ id: "12" }).success, true);
  assert.equal(shopIdSchema.safeParse({ id: "0" }).success, false);
  assert.equal(shopIdSchema.safeParse({ id: "1.5" }).success, false);
});
