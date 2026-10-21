import assert from "node:assert/strict";
import test from "node:test";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from "./auth.validation.js";

const strongPassword = "FashionPass1!";

test("registration rejects privilege fields", () => {
  const result = registerSchema.safeParse({
    name: "Test Customer",
    email: "CUSTOMER@example.com",
    password: strongPassword,
    passwordConfirmation: strongPassword,
    role: "ADMIN",
  });

  assert.equal(result.success, false);
});

test("registration accepts a customer and normalizes email", () => {
  const result = registerSchema.safeParse({
    name: "Test Customer",
    email: "CUSTOMER@example.com",
    phone: "+1 555 0100",
    password: strongPassword,
    passwordConfirmation: strongPassword,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.email, "customer@example.com");
  }
});

test("registration rejects weak or mismatched passwords", () => {
  assert.equal(registerSchema.safeParse({
    name: "Test Customer",
    email: "customer@example.com",
    password: "weak",
    passwordConfirmation: "weak",
  }).success, false);

  assert.equal(registerSchema.safeParse({
    name: "Test Customer",
    email: "customer@example.com",
    password: strongPassword,
    passwordConfirmation: "DifferentPass1!",
  }).success, false);
});

test("login rejects unknown request fields", () => {
  assert.equal(loginSchema.safeParse({
    email: "customer@example.com",
    password: strongPassword,
    role: "ADMIN",
  }).success, false);
});

test("passwords exceeding bcrypt's UTF-8 byte limit are rejected", () => {
  const result = loginSchema.safeParse({
    email: "customer@example.com",
    password: "é".repeat(37),
  });

  assert.equal(result.success, false);
});

test("password change requires a distinct confirmed strong password", () => {
  assert.equal(changePasswordSchema.safeParse({
    currentPassword: strongPassword,
    newPassword: "AnotherPass2!",
    newPasswordConfirmation: "AnotherPass2!",
  }).success, true);

  assert.equal(changePasswordSchema.safeParse({
    currentPassword: strongPassword,
    newPassword: strongPassword,
    newPasswordConfirmation: strongPassword,
  }).success, false);
});
