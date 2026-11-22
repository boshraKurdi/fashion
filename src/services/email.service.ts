import { createTransport } from "nodemailer";
import { env } from "../config/env.js";

export class EmailDeliveryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EmailDeliveryError";
  }
}

const transporter = env.SMTP_HOST
  ? createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER && env.SMTP_PASSWORD
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
        : {}),
    })
  : null;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

async function deliver(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  if (!transporter || !env.SMTP_FROM) {
    throw new EmailDeliveryError("SMTP email delivery is not configured");
  }

  try {
    await transporter.sendMail({ from: env.SMTP_FROM, ...input });
  } catch (error) {
    console.error("SMTP email delivery failed", error);
    throw new EmailDeliveryError("SMTP email delivery failed", { cause: error });
  }
}

export async function sendVerificationEmail(input: {
  name: string;
  email: string;
  code: string;
}): Promise<void> {
  const name = escapeHtml(input.name);
  const code = escapeHtml(input.code);

  await deliver({
    to: input.email,
    subject: "Your Fashion Marketplace verification code",
    text: `Hello ${input.name}, your email verification code is ${input.code}. It expires in 10 minutes.`,
    html: `<p>Hello ${name},</p><p>Your email verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes.</p>`,
  });
}

export async function sendShopDecisionEmail(input: {
  ownerName: string;
  ownerEmail: string;
  shopName: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason: string | null;
}): Promise<void> {
  const approved = input.status === "APPROVED";
  const decision = approved ? "approved" : "rejected";
  const reason = input.rejectionReason
    ? `\nReason: ${input.rejectionReason}`
    : "";
  const safeOwner = escapeHtml(input.ownerName);
  const safeShop = escapeHtml(input.shopName);
  const safeReason = input.rejectionReason ? `<p>Reason: ${escapeHtml(input.rejectionReason)}</p>` : "";

  await deliver({
    to: input.ownerEmail,
    subject: `Your shop ${decision}: ${input.shopName}`,
    text: `Hello ${input.ownerName}, your shop "${input.shopName}" was ${decision}.${reason}`,
    html: `<p>Hello ${safeOwner},</p><p>Your shop <strong>${safeShop}</strong> was ${decision}.</p>${safeReason}`,
  });
}
