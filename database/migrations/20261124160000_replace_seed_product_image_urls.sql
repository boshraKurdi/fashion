UPDATE product_images
SET image = CASE image
  WHEN 'https://example.com/products/dress-1.jpg' THEN 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'
  WHEN 'https://example.com/products/dress-2.jpg' THEN 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=80'
  WHEN 'https://example.com/products/blazer-1.jpg' THEN 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80'
  WHEN 'https://example.com/products/hoodie-1.jpg' THEN 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80'
  WHEN 'https://example.com/products/runner-1.jpg' THEN 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'
  WHEN 'https://example.com/products/tote-1.jpg' THEN 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80'
END
WHERE image IN (
  'https://example.com/products/dress-1.jpg',
  'https://example.com/products/dress-2.jpg',
  'https://example.com/products/blazer-1.jpg',
  'https://example.com/products/hoodie-1.jpg',
  'https://example.com/products/runner-1.jpg',
  'https://example.com/products/tote-1.jpg'
);

UPDATE order_items
SET product_image = CASE product_image
  WHEN 'https://example.com/products/dress-1.jpg' THEN 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'
  WHEN 'https://example.com/products/dress-2.jpg' THEN 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=80'
  WHEN 'https://example.com/products/blazer-1.jpg' THEN 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80'
  WHEN 'https://example.com/products/hoodie-1.jpg' THEN 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80'
  WHEN 'https://example.com/products/runner-1.jpg' THEN 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'
  WHEN 'https://example.com/products/tote-1.jpg' THEN 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80'
END
WHERE product_image IN (
  'https://example.com/products/dress-1.jpg',
  'https://example.com/products/dress-2.jpg',
  'https://example.com/products/blazer-1.jpg',
  'https://example.com/products/hoodie-1.jpg',
  'https://example.com/products/runner-1.jpg',
  'https://example.com/products/tote-1.jpg'
);

UPDATE shops
SET logo = CASE logo
  WHEN 'https://example.com/shops/aurelia-logo.png' THEN 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
  WHEN 'https://example.com/shops/veloura-logo.png' THEN 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80'
END
WHERE logo IN (
  'https://example.com/shops/aurelia-logo.png',
  'https://example.com/shops/veloura-logo.png'
);
