import assert from "node:assert/strict";
import test from "node:test";
import {
  branchCreateSchema,
  orderStatusSchema,
  productCreateSchema,
  productListQuerySchema,
  shopRequestSchema,
  shopUpdateSchema,
} from "./shop-owner.validation.js";

test("shop requests require a name and reject ownership or approval fields", () => {
  const valid = { name: "Atelier North", phone: "+966500000000" };
  assert.equal(shopRequestSchema.safeParse(valid).success, true);
  assert.equal(shopRequestSchema.safeParse({
    ...valid,
    facebookUrl: "https://facebook.com/atelier-north",
    instagramUrl: "https://instagram.com/atelier-north",
    whatsappUrl: "https://wa.me/966500000000",
  }).success, true);
  assert.equal(shopRequestSchema.safeParse({ phone: "+966500000000" }).success, false);
  assert.equal(shopRequestSchema.safeParse({ ...valid, ownerId: "2" }).success, false);
  assert.equal(shopRequestSchema.safeParse({ ...valid, status: "APPROVED" }).success, false);
  assert.equal(shopRequestSchema.safeParse({ ...valid, email: "not-an-email" }).success, false);
  assert.equal(shopRequestSchema.safeParse({ ...valid, instagramUrl: "javascript:alert(1)" }).success, false);
  assert.equal(shopRequestSchema.safeParse({ ...valid, logo: "/uploads/logo.png" }).success, false);
});

test("shop profile updates reject admin-controlled and ownership fields", () => {
  assert.equal(shopUpdateSchema.safeParse({ name: "Updated shop" }).success, true);
  assert.equal(shopUpdateSchema.safeParse({ whatsappUrl: "https://wa.me/15550100" }).success, true);
  assert.equal(shopUpdateSchema.safeParse({ owner_id: "99" }).success, false);
  assert.equal(shopUpdateSchema.safeParse({ status: "APPROVED" }).success, false);
});

test("product creation rejects invalid sale pricing and multiple primary images", () => {
  const valid = {
    name: "Linen Shirt",
    categoryId: "1",
    price: 60,
    salePrice: 50,
    status: "DRAFT",
  };
  assert.equal(productCreateSchema.safeParse(valid).success, true);
  assert.equal(productCreateSchema.safeParse({ ...valid, salePrice: 61 }).success, false);
  assert.equal(productCreateSchema.safeParse({
    ...valid,
    images: [
      { image: "/one.jpg", isPrimary: true },
      { image: "/two.jpg", isPrimary: true },
    ],
  }).success, false);
});

test("product filters reject an inverted price range", () => {
  assert.equal(productListQuerySchema.safeParse({ minPrice: "20", maxPrice: "10" }).success, false);
  assert.equal(productListQuerySchema.safeParse({ page: "1", limit: "20", minPrice: "10" }).success, true);
});

test("order status input cannot update payment status", () => {
  assert.equal(orderStatusSchema.safeParse({ status: "CONFIRMED" }).success, true);
  assert.equal(orderStatusSchema.safeParse({ status: "PAID" }).success, false);
  assert.equal(orderStatusSchema.safeParse({ status: "SHIPPED", paymentStatus: "PAID" }).success, false);
});

test("branch coordinates are bounded to valid latitude and longitude ranges", () => {
  const base = { name: "Central", address: "100 Main Street", city: "New York" };
  assert.equal(branchCreateSchema.safeParse({ ...base, latitude: 40.7, longitude: -74 }).success, true);
  assert.equal(branchCreateSchema.safeParse({ ...base, latitude: 91 }).success, false);
  assert.equal(branchCreateSchema.safeParse({ ...base, longitude: -181 }).success, false);
});
