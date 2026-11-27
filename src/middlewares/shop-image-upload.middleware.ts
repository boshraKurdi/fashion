import { randomUUID } from "node:crypto";
import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import type { Request, RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../modules/auth/auth.service.js";

export const uploadDirectory = path.resolve(process.cwd(), "uploads");
const shopImagesDirectory = path.join(uploadDirectory, "shops");
export const paymentQrDirectory = path.join(uploadDirectory, "payment-accounts");
export const categoryImagesDirectory = path.join(uploadDirectory, "categories");
export const brandImagesDirectory = path.join(uploadDirectory, "brands");
export const productImagesDirectory = path.join(uploadDirectory, "products");
const extensionByMimeType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function getUploadedFiles(req: Request): Express.Multer.File[] {
  const files = req.files;
  if (!files || Array.isArray(files)) return files ?? [];
  return Object.values(files).flat();
}

async function removeUploadedFiles(req: Request): Promise<void> {
  await Promise.all(getUploadedFiles(req).map((file) => rm(file.path, { force: true })));
}

async function hasValidImageSignature(file: Express.Multer.File): Promise<boolean> {
  const handle = await open(file.path, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);

    if (file.mimetype === "image/jpeg") {
      return bytesRead >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    }
    if (file.mimetype === "image/png") {
      return bytesRead >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    return file.mimetype === "image/webp"
      && bytesRead >= 12
      && header.toString("ascii", 0, 4) === "RIFF"
      && header.toString("ascii", 8, 12) === "WEBP";
  } finally {
    await handle.close();
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      mkdir(shopImagesDirectory, { recursive: true }).then(
        () => callback(null, shopImagesDirectory),
        (error: Error) => callback(error, shopImagesDirectory),
      );
    },
    filename(_req, file, callback) {
      callback(null, `${randomUUID()}${extensionByMimeType[file.mimetype] ?? ".bin"}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 2,
    fields: 8,
    fieldSize: 64 * 1024,
  },
  fileFilter(_req, file, callback) {
    if (!Object.hasOwn(extensionByMimeType, file.mimetype)) {
      callback(new AppError("Only JPEG, PNG, and WebP images are allowed", 400));
      return;
    }
    callback(null, true);
  },
}).fields([
  { name: "logo", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
]);

export const shopImageUploadMiddleware: RequestHandler = (req, res, next) => {
  upload(req, res, (error: unknown) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        const message = error.code === "LIMIT_FILE_SIZE"
          ? "Each shop image must be 5 MB or smaller"
          : error.code === "LIMIT_UNEXPECTED_FILE"
            ? "Only one logo and one coverImage file are allowed"
            : "Invalid shop image upload";
        next(new AppError(message, 400));
        return;
      }
      next(error);
      return;
    }

    void (async () => {
      const files = getUploadedFiles(req);
      const signatures = await Promise.all(files.map(hasValidImageSignature));
      if (signatures.some((valid) => !valid)) {
        await removeUploadedFiles(req);
        next(new AppError("Uploaded file content is not a valid JPEG, PNG, or WebP image", 400));
        return;
      }
      next();
    })().catch(next);
  });
};

export async function removeShopImageUploads(files: Express.Multer.File[]): Promise<void> {
  await Promise.all(files.map((file) => rm(file.path, { force: true })));
}

const qrUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      mkdir(paymentQrDirectory, { recursive: true }).then(
        () => callback(null, paymentQrDirectory),
        (error: Error) => callback(error, paymentQrDirectory),
      );
    },
    filename(_req, file, callback) {
      callback(null, `${randomUUID()}${extensionByMimeType[file.mimetype] ?? ".bin"}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 12, fieldSize: 64 * 1024 },
  fileFilter(_req, file, callback) {
    if (!Object.hasOwn(extensionByMimeType, file.mimetype)) {
      callback(new AppError("Only JPEG, PNG, and WebP images are allowed", 400));
      return;
    }
    callback(null, true);
  },
}).single("qrImage");

export const paymentQrUploadMiddleware: RequestHandler = (req, res, next) => {
  qrUpload(req, res, (error: unknown) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        next(new AppError(error.code === "LIMIT_FILE_SIZE" ? "QR image must be 5 MB or smaller" : "Invalid QR image upload", 400));
        return;
      }
      next(error);
      return;
    }
    if (!req.file) {
      next();
      return;
    }
    void (async () => {
      const file = req.file;
      if (!file) {
        next();
        return;
      }
      if (!(await hasValidImageSignature(file))) {
        await rm(file.path, { force: true });
        next(new AppError("Uploaded file content is not a valid JPEG, PNG, or WebP image", 400));
        return;
      }
      next();
    })().catch(next);
  });
};

const assetDirectoryByField: Record<string, string> = {
  image: categoryImagesDirectory,
  logo: brandImagesDirectory,
  images: productImagesDirectory,
};

const assetUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      const directory = assetDirectoryByField[file.fieldname] ?? path.join(uploadDirectory, "misc");
      mkdir(directory, { recursive: true }).then(
        () => callback(null, directory),
        (error: Error) => callback(error, directory),
      );
    },
    filename(_req, file, callback) {
      callback(null, `${randomUUID()}${extensionByMimeType[file.mimetype] ?? ".bin"}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 50, fields: 30, fieldSize: 64 * 1024 },
  fileFilter(_req, file, callback) {
    if (!Object.hasOwn(extensionByMimeType, file.mimetype)) {
      callback(new AppError("Only JPEG, PNG, and WebP images are allowed", 400));
      return;
    }
    callback(null, true);
  },
}).fields([
  { name: "image", maxCount: 1 },
  { name: "logo", maxCount: 1 },
  { name: "images", maxCount: 50 },
]);

export const assetImageUploadMiddleware: RequestHandler = (req, res, next) => {
  assetUpload(req, res, (error: unknown) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        const message = error.code === "LIMIT_FILE_SIZE"
          ? "Each image must be 5 MB or smaller"
          : "Invalid image upload";
        next(new AppError(message, 400));
        return;
      }
      next(error);
      return;
    }

    void (async () => {
      const files = getUploadedFiles(req);
      const signatures = await Promise.all(files.map(hasValidImageSignature));
      if (signatures.some((valid) => !valid)) {
        await removeUploadedFiles(req);
        next(new AppError("Uploaded file content is not a valid JPEG, PNG, or WebP image", 400));
        return;
      }
      next();
    })().catch(next);
  });
};
