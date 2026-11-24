# Public Products API

## List products

- **GET** `/api/v1/products`
- Supports pagination, search, category, brand, shop, price, color, size, sale,
  and sorting query parameters.
- Product images remain in the `images` array. If a product has no usable image
  URL, the API returns a default image in the same shape:

```json
{
  "id": null,
  "image": "https://api.example.com/api/v1/product-placeholder.svg",
  "is_primary": true,
  "sort_order": 0,
  "is_placeholder": true
}
```

The placeholder is served by the API itself at
`GET /api/v1/product-placeholder.svg`; no external image host is required.
`id: null` and `is_placeholder: true` identify the synthetic image (it is not a
database record).
