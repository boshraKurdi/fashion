import assert from "node:assert/strict";
import { createServer } from "node:http";
import { join } from "node:path";
import { rm, stat } from "node:fs/promises";
import express from "express";
import test from "node:test";
import {
  shopImageUploadMiddleware,
  uploadDirectory,
} from "./shop-image-upload.middleware.js";

test("shop image upload accepts valid image bytes and rejects spoofed image MIME types", async () => {
  const app = express();
  app.use("/uploads", express.static(uploadDirectory, { dotfiles: "deny", index: false }));
  app.post("/upload", shopImageUploadMiddleware, (req, res) => {
    const uploaded = req.files && !Array.isArray(req.files) ? req.files : {};
    const logo = uploaded.logo?.[0];
    res.status(201).json({ filename: logo?.filename });
  });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const statusCode = error && typeof error === "object" && "statusCode" in error
      ? Number(error.statusCode)
      : 500;
    res.status(statusCode).json({ message: error instanceof Error ? error.message : "Upload failed" });
  });

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const uploadedPaths: string[] = [];

  try {
    const validForm = new FormData();
    validForm.append(
      "logo",
      new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/r9sAAAAASUVORK5CYII=", "base64")], {
        type: "image/png",
      }),
      "logo.png",
    );
    const validResponse = await fetch(`${baseUrl}/upload`, { method: "POST", body: validForm });
    assert.equal(validResponse.status, 201);
    const validBody = await validResponse.json() as { filename: string };
    const uploadedPath = join(uploadDirectory, "shops", validBody.filename);
    uploadedPaths.push(uploadedPath);
    assert.match(validBody.filename, /^[0-9a-f-]+\.png$/);
    assert.ok((await stat(uploadedPath)).isFile());
    const publicImageResponse = await fetch(`${baseUrl}/uploads/shops/${validBody.filename}`);
    assert.equal(publicImageResponse.status, 200);
    assert.match(publicImageResponse.headers.get("content-type") ?? "", /^image\/png/);

    const spoofedForm = new FormData();
    spoofedForm.append("logo", new Blob(["not an image"], { type: "image/png" }), "logo.png");
    const spoofedResponse = await fetch(`${baseUrl}/upload`, { method: "POST", body: spoofedForm });
    assert.equal(spoofedResponse.status, 400);
    assert.match((await spoofedResponse.json() as { message: string }).message, /valid JPEG, PNG, or WebP/);
  } finally {
    await Promise.all(uploadedPaths.map((filePath) => rm(filePath, { force: true })));
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
