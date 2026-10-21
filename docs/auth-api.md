# Authentication API (Postman)

The API uses access tokens only. Tokens are signed JWTs and are not stored in the database. There is no refresh-token endpoint or server-side token revocation. Logout and password changes do not invalidate already issued JWTs; those tokens remain valid until their configured expiration. Use a short access-token lifetime and securely discard tokens on the client.

## Setup

1. Copy `.env.example` to `.env` and supply the credentials for the existing MySQL database.
2. Generate a JWT secret, for example with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`, and put its output in `JWT_ACCESS_SECRET`.
3. Install dependencies with `npm install`, then generate the Prisma client with `npx prisma generate`. This reads the existing `users` table model and does not modify the database.
4. Start development mode with `npm run dev`, or build and run with `npm run build` followed by `npm start`.

The example endpoints use `http://localhost:3000`. All responses are JSON. Public-registration input rejects unknown properties, including `role` and `status`.

## Endpoints

### Register a customer

- **Method / URL:** `POST http://localhost:3000/api/v1/auth/register`
- **Authentication:** Not required.
- **Headers:** `Content-Type: application/json`
- **Purpose:** Create an active customer account. The server sets `CUSTOMER` and `ACTIVE`.
- **Body:**

```json
{
  "name": "Test Customer",
  "email": "customer@example.com",
  "phone": "+1 555 0100",
  "password": "FashionPass1!",
  "passwordConfirmation": "FashionPass1!"
}
```

- **Success (201):**

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "id": "1",
      "name": "Test Customer",
      "email": "customer@example.com",
      "phone": "+1 555 0100",
      "role": "CUSTOMER",
      "email_verified_at": null
    }
  }
}
```

- **Common errors:** `400` invalid fields, weak password, mismatch, or unexpected fields; `409` email already registered; `429` registration limit exceeded (100 attempts/hour by default in development, 5/hour in production). Override with `AUTH_REGISTER_LIMIT`.

### Login

- **Method / URL:** `POST http://localhost:3000/api/v1/auth/login`
- **Authentication:** Not required.
- **Headers:** `Content-Type: application/json`
- **Purpose:** Verify credentials and issue a JWT access token.
- **Body:**

```json
{
  "email": "customer@example.com",
  "password": "FashionPass1!"
}
```

- **Success (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "1",
      "name": "Test Customer",
      "email": "customer@example.com",
      "phone": "+1 555 0100",
      "role": "CUSTOMER",
      "email_verified_at": null
    },
    "accessToken": "<JWT returned by this request>",
    "tokenType": "Bearer",
    "expiresIn": "15m"
  }
}
```

- **Common errors:** `400` invalid request; `401` invalid email/password; `403` account is inactive or blocked; `429` more than 10 login attempts in 15 minutes.

### Get current user

- **Method / URL:** `GET http://localhost:3000/api/v1/auth/me`
- **Authentication:** Required.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Purpose:** Return the authenticated user's current profile and account status from MySQL.
- **Body:** None.
- **Success (200):**

```json
{
  "success": true,
  "message": "Current user retrieved successfully",
  "data": {
    "user": {
      "id": "1",
      "name": "Test Customer",
      "email": "customer@example.com",
      "phone": "+1 555 0100",
      "role": "CUSTOMER",
      "status": "ACTIVE",
      "email_verified_at": null
    }
  }
}
```

- **Common errors:** `401` missing, invalid, expired token, or no-longer-active account.

### Logout

- **Method / URL:** `POST http://localhost:3000/api/v1/auth/logout`
- **Authentication:** Required.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Purpose:** End the client session by instructing the client to discard the token. The stateless token is not revoked server-side.
- **Body:** None.
- **Success (200):**

```json
{
  "success": true,
  "message": "Logged out. Discard the access token on the client; it remains valid until it expires."
}
```

- **Common errors:** `401` missing, invalid, or expired token.

### Change password

- **Method / URL:** `PATCH http://localhost:3000/api/v1/auth/change-password`
- **Authentication:** Required.
- **Headers:** `Authorization: Bearer <accessToken>` and `Content-Type: application/json`
- **Purpose:** Verify the current password and save a bcrypt hash of a new, confirmed password.
- **Body:**

```json
{
  "currentPassword": "FashionPass1!",
  "newPassword": "NewFashionPass2!",
  "newPasswordConfirmation": "NewFashionPass2!"
}
```

- **Success (200):**

```json
{
  "success": true,
  "message": "Password changed successfully. Existing access tokens remain valid until expiry."
}
```

- **Common errors:** `400` invalid input, confirmation mismatch, unchanged password, or incorrect current password; `401` missing, invalid, or expired token.

### Protected shop-owner authorization example

- **Method / URL:** `GET http://localhost:3000/api/v1/auth/owner-example`
- **Authentication:** Required; caller must have role `SHOP_OWNER` or `ADMIN`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Purpose:** Demonstrate reusable role-based authorization. Public registration cannot grant either role; this route does not perform a sensitive operation.
- **Body:** None.
- **Success (200):** JSON with `success: true`, a message, and the safe user profile.
- **Common errors:** `401` missing/invalid token; `403` authenticated customer lacks the required role.

## Postman sequence

Import `postman/fashion-marketplace-auth.postman_collection.json`. Set collection variable `baseUrl` to `http://localhost:3000`.

1. Send **Register customer**.
2. Send **Login**. Its test script saves `data.accessToken` in the `accessToken` collection variable.
3. Send **Get current user**; the collection applies the saved Bearer token.
4. Send **Change password** with the same current/new values in the JSON body.
5. Send **Logout**. Clear/discard the token in Postman; this does not revoke its JWT.
6. To test role authorization, a `SHOP_OWNER` or `ADMIN` account must be provisioned outside public registration. Then send **Owner authorization example**.

Protected requests use the Postman **Authorization** tab with **Bearer Token**, or the collection-level saved `accessToken`.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP port; defaults to `3000`. |
| `DATABASE_URL` | Yes | Connection URL for the existing MySQL `fashion_marketplace` database. |
| `JWT_ACCESS_SECRET` | Yes | Random secret of at least 32 characters; generate with the command above. |
| `JWT_ACCESS_EXPIRES_IN` | No | Access-token lifetime in `s`, `m`, `h`, or `d`; defaults to `15m`. |
| `BCRYPT_ROUNDS` | No | bcrypt cost from 10 through 14; defaults to `12`. |
| `CORS_ORIGINS` | No | Comma-separated allowed browser origins; defaults to local development origins. |
| `NODE_ENV` | No | `development`, `test`, or `production`. |

No refresh tokens are implemented. Adding hashed refresh-token rotation, revocation, or server-side access-token revocation requires a separately approved schema migration/table; this module does not change the existing database schema.
