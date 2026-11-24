import assert from "node:assert/strict";
import test from "node:test";
import { withDefaultProductImages } from "./product-images.js";

const defaultImageUrl = "http://localhost:3000/api/v1/product-placeholder.svg";

test("adds a default image when a product has no usable images", () => {
  const [product] = withDefaultProductImages([
    { id: 1n, name: "Shirt", images: [] },
    { id: 2n, name: "Pants", images: [{ id: 3n, image: "  ", is_primary: false, sort_order: 0 }] },
  ], defaultImageUrl);

  assert.ok(product);
  assert.deepEqual(product.images, [{
    id: null,
    image: defaultImageUrl,
    is_primary: true,
    sort_order: 0,
    is_placeholder: true,
  }]);

  const [blankProduct] = withDefaultProductImages([
    { id: 2n, name: "Pants", images: [{ id: 3n, image: "  ", is_primary: false, sort_order: 0 }] },
  ], defaultImageUrl);
  assert.ok(blankProduct);
  assert.deepEqual(blankProduct.images[0]?.image, defaultImageUrl);
});

test("preserves valid product images without adding a placeholder", () => {
  const image = { id: 7n, image: "https://cdn.example.test/shirt.jpg", is_primary: true, sort_order: 0 };
  const [product] = withDefaultProductImages([
    { id: 1n, name: "Shirt", images: [image] },
  ], defaultImageUrl);

  assert.ok(product);
  assert.deepEqual(product.images, [image]);
});
