# Shop Owner Dashboard API

The API listens on the configured `PORT` (default `3000`) and is mounted at
`/api/v1/shop-owner`. Every endpoint below requires a valid JWT belonging to a
`SHOP_OWNER`. Send `Authorization: Bearer <accessToken>` on every request.
Requests with a body must also send `Content-Type: application/json`.

Sign in through `POST http://localhost:3000/api/v1/auth/login` with an existing
shop-owner account, then use its `accessToken`. The collection in
[`../postman/fashion-marketplace-shop-owner.postman_collection.json`](../postman/fashion-marketplace-shop-owner.postman_collection.json)
contains all 36 requests.

An account must have exactly one shop for shop-specific operations. If it has
none, shop-specific endpoints return `404`; if it has multiple, they return
`409`. `GET /dashboard` instead returns `shop: null` and zero statistics when
there is no shop. No endpoint accepts `owner_id` or `shop_id` as proof of
ownership. IDs in JSON bodies are decimal strings.

Product and offer images are still provided as caller-supplied paths. Shop
application logos and cover images can be uploaded from the device through the
`POST /api/v1/auth/shop-request` multipart endpoint; they are stored locally
under `uploads/shops`.

## Response conventions

Paged endpoints return:

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
}
```

Mutation and detail endpoints return `{"success":true,"message":"...","data":{...}}`
unless noted as a list or delete result. Errors use:

```json
{ "success": false, "message": "Product not found" }
```

Validation errors return `400` and include an `errors` array. Other common
errors are `401` missing/invalid JWT, `403` wrong role or disallowed shop
status, `404` record not found, `409` ownership ambiguity, invalid state
transition, duplicate data, or referenced variant. Unexpected failures return
`500`. `PENDING`, `REJECTED`, and `SUSPENDED` shops cannot publish active
products/offers; profile edits and order fulfillment remain available.

## Dashboard

### Get dashboard overview

- **GET** `http://localhost:3000/api/v1/shop-owner/dashboard`
- **Purpose:** Shop approval data, product/order statistics, paid sales,
  approved-review average, active subscription, and the five newest orders.
- **Role/auth:** `SHOP_OWNER`; JWT required.
- **Headers:** `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success example (200):**

```json
{
  "success": true,
  "message": "Dashboard retrieved successfully",
  "data": {
    "shop": { "id": "1", "name": "Atelier North", "status": "APPROVED", "rejection_reason": null, "approved_at": "2026-01-10T12:00:00.000Z" },
    "statistics": {
      "totalProducts": 18, "activeProducts": 12, "hiddenProducts": 2,
      "totalOrders": 42, "newOrders": 3, "processingOrders": 4,
      "shippedOrders": 2, "deliveredOrders": 28, "cancelledOrders": 5,
      "totalSales": 1250.5, "totalPaidOrders": 30, "totalReviews": 14, "averageRating": 4.6
    },
    "currentSubscription": null,
    "subscriptionExpirationDate": null,
    "recentOrders": []
  }
}
```

- **Errors:** `401`, `403`, `409` for multiple owned shops, `500`.

## Shop Profile

### Get shop

- **GET** `http://localhost:3000/api/v1/shop-owner/shop`
- **Purpose:** Read editable shop details and admin-controlled approval fields.
- **Role/auth:** `SHOP_OWNER`; JWT required.
- **Headers:** `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success:** `200`, `data` contains shop details, `status`, `rejection_reason`,
  and `approved_at`; `owner_id` is not returned.
- **Errors:** `401`, `403`, `404` no shop, `409` multiple shops, `500`.

### Update shop

- **PATCH** `http://localhost:3000/api/v1/shop-owner/shop`
- **Purpose:** Update only the provided editable profile fields.
- **Role/auth:** `SHOP_OWNER`; JWT required.
- **Headers:** `Authorization: Bearer <accessToken>`,
  `Content-Type: application/json`.
- **Query:** None.
- **Body:**

```json
{
  "name": "Atelier North",
  "description": "Contemporary fashion and accessories",
  "phone": "+1 555 0100",
  "email": "shop@example.com",
  "logo": "/uploads/atelier-logo.jpg",
  "coverImage": "/uploads/atelier-cover.jpg",
  "facebookUrl": "https://facebook.com/atelier-north",
  "instagramUrl": "https://instagram.com/atelier-north",
  "whatsappUrl": "https://wa.me/15550100"
}
```

- Social account fields are optional HTTP(S) URLs and can also be updated
  individually. Local `/uploads/` image paths are returned as absolute URLs.
- **Success:** `200`, standard success envelope with updated shop details.
- **Errors:** `400` invalid or empty body, `401`, `403`, `404`, `409`, `500`.
  Owner ID, approval status, rejection reason, and approval date cannot be
  submitted for modification.

## Products

All product list results are paged and omit archived products unless explicitly
filtered with `status=ARCHIVED`.

### List products

- **GET** `http://localhost:3000/api/v1/shop-owner/products?page=1&limit=10&search=shirt&categoryId=1&status=ACTIVE&minPrice=10&maxPrice=100&sortBy=newest&sortOrder=desc`
- **Purpose:** Search and filter this shop's products.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query:** `page`, `limit` (max 100), `search`, `categoryId`, `status`,
  `minPrice`, `maxPrice`, `sortBy=newest|price`, `sortOrder=asc|desc`.
- **Body:** None.
- **Success:** `200`, paginated product objects with category, brand, images,
  and variants.
- **Errors:** `400`, `401`, `403`, `404`, `409`, `500`.

### Get product

- **GET** `http://localhost:3000/api/v1/shop-owner/products/1`
- **Purpose:** Get one product, including images and variants.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success:** `200`, standard success envelope with product details.
- **Errors:** `401`, `403`, `404` missing or not owned, `409`, `500`.

### Create product

- **POST** `http://localhost:3000/api/v1/shop-owner/products`
- **Purpose:** Create a product in the authenticated owner's shop.
- **Role/auth:** `SHOP_OWNER`; JWT required.
- **Headers:** `Authorization: Bearer <accessToken>`,
  `Content-Type: application/json`.
- **Query:** None.
- **Body:**

```json
{
  "name": "Linen Shirt",
  "description": "Relaxed-fit linen shirt",
  "categoryId": "1",
  "brandId": null,
  "price": 59.99,
  "salePrice": 49.99,
  "status": "DRAFT",
  "images": [
    { "image": "/uploads/linen-shirt-front.jpg", "isPrimary": true, "sortOrder": 0 },
    { "image": "/uploads/linen-shirt-back.jpg", "isPrimary": false, "sortOrder": 1 }
  ],
  "variants": [
    { "colorId": "1", "sizeId": "1", "price": 59.99, "salePrice": 49.99, "sku": "LINEN-SHIRT-NAVY-M" }
  ]
}
```

- **Success:** `201`, standard success envelope with the new product, image
  collection, and variants.
- **Errors:** `400` invalid category/brand, price, variant, or image data;
  `401`, `403` active products require an approved shop, `404`, `409` duplicate
  SKU, `500`.

### Update product

- **PATCH** `http://localhost:3000/api/v1/shop-owner/products/1`
- **Purpose:** Update product details (not shop association or status).
- **Role/auth:** `SHOP_OWNER`; JWT required.
- **Headers:** `Authorization: Bearer <accessToken>`,
  `Content-Type: application/json`.
- **Query:** None.
- **Body:**

```json
{ "name": "Linen Shirt - Updated", "price": 62.5, "salePrice": 52.5 }
```

- **Success:** `200`, standard success envelope with updated product details.
- **Errors:** `400`, `401`, `403`, `404` missing or not owned, `409`, `500`.

### Archive product

- **DELETE** `http://localhost:3000/api/v1/shop-owner/products/1`
- **Purpose:** Soft-delete a product by setting its status to `ARCHIVED`.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success:** `200`, standard success envelope with archived product details.
- **Errors:** `401`, `403`, `404` missing or not owned, `409`, `500`.

### Update product status

- **PATCH** `http://localhost:3000/api/v1/shop-owner/products/1/status`
- **Purpose:** Set a product to draft, active, or hidden.
- **Role/auth:** `SHOP_OWNER`; JWT required.
- **Headers:** `Authorization: Bearer <accessToken>`,
  `Content-Type: application/json`.
- **Query:** None.
- **Body:** `{ "status": "HIDDEN" }`
- **Success:** `200`, standard success envelope with updated product details.
- **Errors:** `400`, `401`, `403` activation requires an approved shop, `404`,
  `409` archived product cannot be reactivated, `500`.

## Product Images

Image values are paths, not uploaded files.

### Add image

- **POST** `http://localhost:3000/api/v1/shop-owner/products/1/images`
- **Purpose:** Add an image, with optional primary designation and order.
- **Role/auth:** `SHOP_OWNER`; JWT required. Headers: Bearer authorization and
  `Content-Type: application/json`.
- **Query:** None.
- **Body:** `{ "image": "/uploads/product-detail.jpg", "isPrimary": false, "sortOrder": 2 }`
- **Success:** `201`, standard success envelope with the created image.
- **Errors:** `400`, `401`, `403`, `404` product not owned, `500`.

### Update image

- **PATCH** `http://localhost:3000/api/v1/shop-owner/products/1/images/1`
- **Purpose:** Update image path, primary flag, or display order.
- **Role/auth:** `SHOP_OWNER`; JWT required. Headers: Bearer authorization and
  `Content-Type: application/json`.
- **Query:** None.
- **Body:** `{ "isPrimary": true, "sortOrder": 0 }`
- **Success:** `200`, standard success envelope with the updated image.
- **Errors:** `400`, `401`, `403`, `404` product/image not owned, `500`.

### Delete image

- **DELETE** `http://localhost:3000/api/v1/shop-owner/products/1/images/1`
- **Purpose:** Delete an image; if it was primary, the next ordered image is
  selected as primary.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success:** `200`, `{ "success": true, "message": "Product image deleted successfully" }`.
- **Errors:** `401`, `403`, `404` product/image not owned, `500`.

## Product Variants

### Create variant

- **POST** `http://localhost:3000/api/v1/shop-owner/products/1/variants`
- **Purpose:** Add a product variant without stock/inventory fields.
- **Role/auth:** `SHOP_OWNER`; JWT required. Headers: Bearer authorization and
  `Content-Type: application/json`.
- **Query:** None.
- **Body:** `{ "colorId": "1", "sizeId": "1", "price": 59.99, "salePrice": 49.99, "sku": "LINEN-SHIRT-NAVY-M" }`
- **Success:** `201`, standard success envelope with the created variant.
- **Errors:** `400` color, size, or price is invalid; `401`, `403`, `404`,
  `409` duplicate SKU or referenced record, `500`.

### Update variant

- **PATCH** `http://localhost:3000/api/v1/shop-owner/products/1/variants/1`
- **Purpose:** Update a variant belonging to the product.
- **Role/auth:** `SHOP_OWNER`; JWT required. Headers: Bearer authorization and
  `Content-Type: application/json`.
- **Query:** None.
- **Body:** `{ "price": 61.99, "salePrice": 51.99 }`
- **Success:** `200`, standard success envelope with the updated variant.
- **Errors:** `400`, `401`, `403`, `404` product/variant not owned, `409`,
  `500`.

### Delete variant

- **DELETE** `http://localhost:3000/api/v1/shop-owner/products/1/variants/1`
- **Purpose:** Delete an unused variant.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success:** `200`, `{ "success": true, "message": "Product variant deleted successfully" }`.
- **Errors:** `401`, `403`, `404` product/variant not owned, `409` variant is
  referenced by an order/cart, `500`.

## Orders

### List orders

- **GET** `http://localhost:3000/api/v1/shop-owner/orders?page=1&limit=10&status=PENDING&paymentStatus=PAID&startDate=2026-01-01T00%3A00%3A00.000Z&endDate=2026-12-31T23%3A59%3A59.999Z&orderNumber=FM-2026`
- **Purpose:** Paginate and filter this shop's orders.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query:** `page`, `limit` (max 100), `status`, `paymentStatus`,
  `startDate`, `endDate`, `orderNumber`; dates must be valid and ordered.
- **Body:** None.
- **Success:** `200`, paginated full order records, customer contact, item
  snapshots/images/variants, shipping snapshot, totals, and payment/order status.
- **Errors:** `400`, `401`, `403`, `404`, `409`, `500`.

### Get order

- **GET** `http://localhost:3000/api/v1/shop-owner/orders/1`
- **Purpose:** Get order fulfillment and shipping details for an owned order.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success:** `200`, standard success envelope with the full order details.
- **Errors:** `401`, `403`, `404` missing or not owned, `500`.

### Update order status

- **PATCH** `http://localhost:3000/api/v1/shop-owner/orders/1/status`
- **Purpose:** Advance a valid fulfillment status; payment status is immutable
  through the owner API.
- **Role/auth:** `SHOP_OWNER`; JWT required. Headers: Bearer authorization and
  `Content-Type: application/json`.
- **Query:** None.
- **Body:** `{ "status": "CONFIRMED" }`
- **Success:** `200`, standard success envelope with updated order details.
- **Errors:** `400`, `401`, `403`, `404` missing or not owned, `409` invalid,
  terminal, or concurrently changed order status, `500`.

Allowed transitions: `PENDING` → `CONFIRMED` or `CANCELLED`;
`CONFIRMED` → `PROCESSING` or `CANCELLED`; `PROCESSING` → `SHIPPED` or
`CANCELLED`; `SHIPPED` → `DELIVERED`. Cancelled, returned, and delivered
orders are terminal.

## Offers

### List offers

- **GET** `http://localhost:3000/api/v1/shop-owner/offers?page=1&limit=10&status=ACTIVE`
- **Purpose:** Paginate shop offers. Expired and scheduled offers include an
  `effective_status` (`EXPIRED` or `SCHEDULED`) so they are not represented as
  currently live.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query:** `page`, `limit` (max 100), optional `status=DRAFT|ACTIVE|INACTIVE|EXPIRED`.
- **Body:** None.
- **Success:** `200`, paginated offers and selected product summaries.
- **Errors:** `400`, `401`, `403`, `404`, `409`, `500`.

### Get offer

- **GET** `http://localhost:3000/api/v1/shop-owner/offers/1`
- **Purpose:** Get one owned offer and its selected products.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success:** `200`, standard success envelope with offer details. Returned
  `status` and `effective_status` show `EXPIRED` or `SCHEDULED` where
  appropriate; `configured_status` shows the stored status.
- **Errors:** `401`, `403`, `404` missing or not owned, `500`.

### Create offer

- **POST** `http://localhost:3000/api/v1/shop-owner/offers`
- **Purpose:** Create a draft offer for products in this shop.
- **Role/auth:** `SHOP_OWNER`; JWT required. Headers: Bearer authorization and
  `Content-Type: application/json`.
- **Query:** None.
- **Body:**

```json
{
  "title": "Summer Edit",
  "description": "Seasonal savings on selected items",
  "image": "/uploads/summer-edit.jpg",
  "discountType": "PERCENTAGE",
  "discountValue": 15,
  "startAt": "2026-12-01T00:00:00.000Z",
  "endAt": "2027-01-31T23:59:59.000Z",
  "productIds": ["1"]
}
```

- **Success:** `201`, standard success envelope with offer and selected
  products; new offers begin as `DRAFT`.
- **Errors:** `400` invalid dates/discount/products or negative final price;
  `401`, `403`, `404`, `409`, `500`.

### Update offer

- **PATCH** `http://localhost:3000/api/v1/shop-owner/offers/1`
- **Purpose:** Update supplied offer fields and optionally replace selected
  products.
- **Role/auth:** `SHOP_OWNER`; JWT required. Headers: Bearer authorization and
  `Content-Type: application/json`.
- **Query:** None.
- **Body:** `{ "title": "Summer Edit - Updated", "discountValue": 20, "productIds": ["1"] }`
- **Success:** `200`, standard success envelope with updated offer details.
- **Errors:** `400`, `401`, `403`, `404` missing/not owned or selected product,
  `409`, `500`.

### Delete offer

- **DELETE** `http://localhost:3000/api/v1/shop-owner/offers/1`
- **Purpose:** Delete an owned offer and its product links.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success:** `200`, `{ "success": true, "message": "Offer deleted successfully" }`.
- **Errors:** `401`, `403`, `404` missing or not owned, `500`.

### Update offer status

- **PATCH** `http://localhost:3000/api/v1/shop-owner/offers/1/status`
- **Purpose:** Set an offer to draft, active, or inactive.
- **Role/auth:** `SHOP_OWNER`; JWT required. Headers: Bearer authorization and
  `Content-Type: application/json`.
- **Query:** None.
- **Body:** `{ "status": "ACTIVE" }`
- **Success:** `200`, standard success envelope with updated offer and effective
  status. Active status requires an approved shop and valid date range.
- **Errors:** `400`, `401`, `403`, `404`, `409`, `500`.

## Branches

### List branches

- **GET** `http://localhost:3000/api/v1/shop-owner/branches`
- **Purpose:** List branches belonging to the owner's shop.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success:** `200`, success envelope with a branch array.
- **Errors:** `401`, `403`, `404` no shop, `409`, `500`.

### Get branch

- **GET** `http://localhost:3000/api/v1/shop-owner/branches/1`
- **Purpose:** Get an owned branch.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success:** `200`, standard success envelope with branch details.
- **Errors:** `401`, `403`, `404` missing or not owned, `500`.

### Create branch

- **POST** `http://localhost:3000/api/v1/shop-owner/branches`
- **Purpose:** Create a branch in the authenticated owner's shop.
- **Role/auth:** `SHOP_OWNER`; JWT required. Headers: Bearer authorization and
  `Content-Type: application/json`.
- **Query:** None.
- **Body:**

```json
{
  "name": "Downtown Store",
  "address": "100 Market Street",
  "phone": "+1 555 0110",
  "city": "New York",
  "area": "Manhattan",
  "latitude": 40.7128,
  "longitude": -74.006
}
```

- **Success:** `201`, standard success envelope with branch details.
- **Errors:** `400` invalid coordinates/fields, `401`, `403`, `404`, `409`, `500`.

### Update branch

- **PATCH** `http://localhost:3000/api/v1/shop-owner/branches/1`
- **Purpose:** Update provided branch fields.
- **Role/auth:** `SHOP_OWNER`; JWT required. Headers: Bearer authorization and
  `Content-Type: application/json`.
- **Query:** None.
- **Body:** `{ "phone": "+1 555 0199", "area": "Central Manhattan" }`
- **Success:** `200`, standard success envelope with updated branch details.
- **Errors:** `400`, `401`, `403`, `404` missing or not owned, `500`.

### Deactivate branch (safe delete)

- **DELETE** `http://localhost:3000/api/v1/shop-owner/branches/1`
- **Purpose:** Set branch status to `INACTIVE`; does not physically delete data.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success:** `200`, standard success envelope with inactive branch.
- **Errors:** `401`, `403`, `404` missing or not owned, `500`.

### Update branch status

- **PATCH** `http://localhost:3000/api/v1/shop-owner/branches/1/status`
- **Purpose:** Activate or deactivate an owned branch.
- **Role/auth:** `SHOP_OWNER`; JWT required. Headers: Bearer authorization and
  `Content-Type: application/json`.
- **Query:** None.
- **Body:** `{ "status": "INACTIVE" }`
- **Success:** `200`, standard success envelope with updated branch.
- **Errors:** `400`, `401`, `403`, `404` missing or not owned, `500`.

## Reviews

### List reviews

- **GET** `http://localhost:3000/api/v1/shop-owner/reviews?page=1&limit=10&rating=5&sortBy=newest&sortOrder=desc`
- **Purpose:** Paginate shop reviews, including all moderation statuses. Owners
  cannot change review or moderation data.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query:** `page`, `limit` (max 100), `rating=1..5`,
  `sortBy=newest|rating`, `sortOrder=asc|desc`.
- **Body:** None.
- **Success:** `200`, paginated review records with
  `customerDisplayName`, rating, comment, moderation status, and creation time.
- **Errors:** `400`, `401`, `403`, `404`, `409`, `500`.

### Review summary

- **GET** `http://localhost:3000/api/v1/shop-owner/reviews/summary`
- **Purpose:** Approved average and count, total reviews, and approved rating
  counts from one to five.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success example:** `200`,
  `{"success":true,"message":"Review summary retrieved successfully","data":{"averageRating":4.5,"totalApprovedReviews":8,"totalReviews":10,"ratings":{"1":0,"2":1,"3":1,"4":2,"5":4}}}`.
- **Errors:** `401`, `403`, `404`, `409`, `500`.

## Subscriptions

### Get current subscription

- **GET** `http://localhost:3000/api/v1/shop-owner/subscription`
- **Purpose:** Get the current unexpired active subscription, including plan
  information; `data` is `null` when there is none.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success:** `200`, success envelope with subscription or `null`.
- **Errors:** `401`, `403`, `404` no shop, `409`, `500`.

### Get subscription history

- **GET** `http://localhost:3000/api/v1/shop-owner/subscription/history?page=1&limit=10`
- **Purpose:** Paginate this shop's subscription history.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query:** `page`, `limit` (max 100).
- **Body:** None.
- **Success:** `200`, paginated subscription records and plan details.
- **Errors:** `400`, `401`, `403`, `404`, `409`, `500`.

### List available plans

- **GET** `http://localhost:3000/api/v1/shop-owner/subscription/plans`
- **Purpose:** List active subscription plans.
- **Role/auth:** `SHOP_OWNER`; JWT required. Header: `Authorization: Bearer <accessToken>`.
- **Query/body:** None.
- **Success:** `200`, success envelope with active plans.
- **Errors:** `401`, `403`, `500`.

### Request a subscription

- **POST** `http://localhost:3000/api/v1/shop-owner/subscription`
- **Purpose:** Submit a plan request, snapshot its current price, and calculate
  dates from the plan duration.
- **Role/auth:** `SHOP_OWNER`; JWT required. Headers: Bearer authorization and
  `Content-Type: application/json`.
- **Query:** None.
- **Body:** `{ "planId": "1" }`
- **Success:** `201`, success envelope with a `PENDING` subscription. Payment
  and admin approval are not simulated.
- **Errors:** `400`, `401`, `403`, `404` inactive plan/no shop, `409` another
  pending or unexpired active subscription exists, `500`.

## Import and run in Postman

1. Start the server with `npm run dev` from the repository root.
2. In Postman choose **Import** and select
   `postman/fashion-marketplace-shop-owner.postman_collection.json`.
3. Sign in at `POST http://localhost:3000/api/v1/auth/login` as a shop owner.
   Copy the response `data.accessToken` into the collection's `accessToken`
   variable. The collection applies bearer authentication to all requests.
4. Set collection ID variables to records that exist in the database. Change
   `baseUrl` if `PORT` is not `3000`.
5. Run requests individually or run the collection. Collection tests check for
   a `2xx` status and a successful JSON response envelope.

The implementation was type-checked and validation-tested. Requests that read
or mutate database records require a configured MySQL database and valid
shop-owner data; they are not claimed as live database-tested here.
