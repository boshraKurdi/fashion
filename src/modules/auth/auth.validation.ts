import { z } from "zod";

const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
    message: "Password cannot exceed 72 UTF-8 bytes",
  })
  .refine((value) => /[a-z]/.test(value), {
    message: "Password must contain a lowercase letter",
  })
  .refine((value) => /[A-Z]/.test(value), {
    message: "Password must contain an uppercase letter",
  })
  .refine((value) => /\d/.test(value), {
    message: "Password must contain a number",
  })
  .refine((value) => /[^A-Za-z0-9]/.test(value), {
    message: "Password must contain a symbol",
  });

export const registerSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    email: z.string().trim().email().max(190).transform((value) => value.toLowerCase()),
    phone: z.string().trim().max(30).optional(),
    password: strongPassword,
    passwordConfirmation: z.string(),
  })
  .strict()
  .refine((value) => value.password === value.passwordConfirmation, {
    message: "Passwords do not match",
    path: ["passwordConfirmation"],
  });

export const loginSchema = z
  .object({
    email: z.string().trim().email().max(190).transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(1)
      .max(72)
      .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
        message: "Password cannot exceed 72 UTF-8 bytes",
      }),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1)
      .max(72)
      .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
        message: "Password cannot exceed 72 UTF-8 bytes",
      }),
    newPassword: strongPassword,
    newPasswordConfirmation: z.string(),
  })
  .strict()
  .refine((value) => value.newPassword === value.newPasswordConfirmation, {
    message: "New passwords do not match",
    path: ["newPasswordConfirmation"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must differ from the current password",
    path: ["newPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
