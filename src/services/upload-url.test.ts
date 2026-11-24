import assert from "node:assert/strict";
import test from "node:test";
import { makeUploadsAbsolute } from "./upload-url.js";

test("converts local upload paths to absolute URLs throughout API data", () => {
  assert.deepEqual(makeUploadsAbsolute({
    logo: "/uploads/shops/logo.png",
    cover_image: "/uploads/shops/cover.webp",
    products: [{ image: "/uploads/products/item.jpg" }],
    externalImage: "https://cdn.example.test/image.jpg",
  }, "https://api.example.test"), {
    logo: "https://api.example.test/uploads/shops/logo.png",
    cover_image: "https://api.example.test/uploads/shops/cover.webp",
    products: [{ image: "https://api.example.test/uploads/products/item.jpg" }],
    externalImage: "https://cdn.example.test/image.jpg",
  });
});
