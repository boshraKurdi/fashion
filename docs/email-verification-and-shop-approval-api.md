# Email Verification and Shop Approval API

The API is mounted at `/api/v1`. Configure SMTP before testing email delivery;
copy the SMTP settings from `.env.example` and replace them with credentials
from your mail provider.

Import
[`../postman/fashion-marketplace-email-and-shop-approval.postman_collection.json`](../postman/fashion-marketplace-email-and-shop-approval.postman_collection.json)
in Postman. Set `baseUrl`, `customerEmail` (an inbox you can access),
`adminEmail`, `adminPassword`, `verificationCode`, and `shopId` collection
variables as needed. Run `npm run seed` to prepare sample accounts and data.
The seed includes a verified
development admin (`admin@fashionmarket.test` / `AdminPass1!`) and a pending
shop (typically ID `3`). Run **Set shop decision email recipient** with an
inbox you can access before testing delivery. Public registration cannot grant
the `ADMIN` role.

## Email verification

### Verify email with a code

- **POST** `http://localhost:3000/api/v1/auth/verify-email`
- No authentication required.
- Body: `{"email":"customer@example.com","code":"012345"}`
- The six-digit code expires after 10 minutes and allows up to five attempts.
  Enter the code from the email in the Postman `verificationCode` variable.
- Success: `200`; invalid or expired code: `400`.

### Resend verification email

- **POST** `http://localhost:3000/api/v1/auth/verification-email`
- No authentication required; limited to five requests per hour.
- Body: `{"email":"customer@example.com"}`
- Returns a generic success message whether or not an unverified account
  exists. SMTP failure returns `502`.
- If registration returns `502`, the user record was created but the email
  could not be delivered; configure SMTP and call this endpoint to retry.

Unverified accounts cannot sign in. The code hash, expiry and attempt count are
stored in `email_verification_challenges`; the original code is never stored.
Apply the SQL migration once after the base schema has been created:

```powershell
npx prisma db execute --file database/migrations/20261122220000_email_verification_challenges.sql --schema prisma/schema.prisma
npx prisma generate
```

## Request a shop

- **POST** `http://localhost:3000/api/v1/auth/shop-request`
- Requires a valid JWT for a verified `CUSTOMER` or `SHOP_OWNER`.
- Send as `multipart/form-data`:

| Field | Type | Required |
| --- | --- | --- |
| `name` | Text | Yes |
| `description` | Text | No |
| `phone` | Text | No |
| `email` | Text | No |
| `facebookUrl` | Text URL | No |
| `instagramUrl` | Text URL | No |
| `whatsappUrl` | Text URL | No |
| `logo` | File | No |
| `coverImage` | File | No |

The logo and cover image are uploaded from the client device. JPEG, PNG, and
WebP files up to 5 MB each are accepted and saved under `uploads/shops` with
generated filenames. The API returns their public paths, for example
`https://api.example.com/uploads/shops/<generated-name>.jpg`. All API responses
expand local `/uploads/` paths using the request's public protocol and host.
Keep the `uploads` directory persistent and writable by the application; back
it up with the database.

The social fields must be complete HTTP(S) profile URLs, for example
`https://facebook.com/your-shop`, `https://instagram.com/your-shop`, and
`https://wa.me/966500000000`. Apply the database migration before using these
fields:

```powershell
npx prisma db execute --file database/migrations/20261124173000_add_shop_social_links.sql --schema prisma/schema.prisma
npx prisma generate
```

The authenticated user's ID becomes the shop owner; do not send an owner ID or
approval status. The shop is created with `PENDING` status and must be approved
by an administrator before it can publish products. After approval, the
account's role becomes `SHOP_OWNER`. A rejected application can be resubmitted
using this endpoint, which updates the rejected shop and sets it back to
`PENDING`. Other existing shop states return `409`.

- **Success:** `201`, with the pending shop in `data`.
- **Errors:** `400` invalid body, `401` missing/invalid token, `403` wrong role
  or unverified account, `409` a non-rejected shop already exists. Invalid
  image types, files larger than 5 MB, or duplicate/unknown file fields return
  `400`.

## Shop review

All endpoints below require a JWT for a user with the `ADMIN` role.

### List shops

- **GET** `http://localhost:3000/api/v1/admin/shops?status=PENDING&page=1&limit=10`
- `status` may be `PENDING`, `APPROVED`, `REJECTED`, or `SUSPENDED`; omitted
  status defaults to `PENDING`.
- Returns paged shops, including their owner contact details.

### Approve or reject a pending shop

- **PATCH** `http://localhost:3000/api/v1/admin/shops/1/decision`
- Approval body: `{"decision":"APPROVED"}`
- Rejection body: `{"decision":"REJECTED","rejectionReason":"Please provide the missing registration document."}`
- Only shops currently in `PENDING` status can receive a decision. A decision
  email is sent to the shop's contact email, falling back to the owner's
  account email when no shop email is set.
- Approval sets `approved_at` and clears any rejection reason. Rejection stores
  the required reason and clears `approved_at`.
- Returns `409` if the shop is no longer pending. The seed's demo shop can be
decided once; rerunning the seed resets it to `PENDING`.

### Retry a decision email

- **POST** `http://localhost:3000/api/v1/admin/shops/1/decision-email`
- Sends the email corresponding to the shop's saved `APPROVED` or `REJECTED`
  status. This endpoint is useful when the decision was saved but SMTP delivery
  failed; the decision endpoint returns `502` in that case.
- Returns `409` for shops without an approved or rejected decision.

## SMTP environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `SMTP_HOST` | For email | SMTP server hostname. |
| `SMTP_PORT` | No | SMTP server port; defaults to `587`. |
| `SMTP_SECURE` | No | `true` for implicit TLS (typically port 465), otherwise `false`. |
| `SMTP_USER` | No | SMTP username; configure together with `SMTP_PASSWORD`. |
| `SMTP_PASSWORD` | No | SMTP password; configure together with `SMTP_USER`. |
| `SMTP_FROM` | For email | Sender address/name, e.g. `Fashion Marketplace <no-reply@example.com>`. |
