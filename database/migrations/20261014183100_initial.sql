CREATE DATABASE IF NOT EXISTS fashion_marketplace
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fashion_marketplace;

SET NAMES utf8mb4;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(30) NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('CUSTOMER','SHOP_OWNER','ADMIN') NOT NULL DEFAULT 'CUSTOMER',
  status ENUM('ACTIVE','INACTIVE','BLOCKED') NOT NULL DEFAULT 'ACTIVE',
  email_verified_at DATETIME NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role_status (role, status)
) ENGINE=InnoDB;

CREATE TABLE shops (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT NULL,
  logo VARCHAR(500) NULL,
  cover_image VARCHAR(500) NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(190) NULL,
  status ENUM('PENDING','APPROVED','REJECTED','SUSPENDED') NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT NULL,
  approved_at DATETIME NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shops_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_shops_status (status),
  INDEX idx_shops_name (name)
) ENGINE=InnoDB;

CREATE TABLE shop_branches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shop_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NULL,
  city VARCHAR(100) NOT NULL,
  area VARCHAR(100) NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_branches_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_branches_shop_status (shop_id, status),
  INDEX idx_branches_city_area (city, area)
) ENGINE=InnoDB;
CREATE TABLE categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(150) NOT NULL UNIQUE,
  image VARCHAR(500) NULL,
  status TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_categories_parent_status (parent_id, status)
) ENGINE=InnoDB;

CREATE TABLE brands (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  logo VARCHAR(500) NULL,
  status TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shop_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  brand_id BIGINT UNSIGNED NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  price DECIMAL(12,2) NOT NULL,
  sale_price DECIMAL(12,2) NULL,
  status ENUM('DRAFT','ACTIVE','HIDDEN','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_products_price CHECK (price >= 0),
  CONSTRAINT chk_products_sale_price CHECK (sale_price IS NULL OR (sale_price >= 0 AND sale_price <= price)),
  INDEX idx_products_shop_status (shop_id, status),
  INDEX idx_products_category_status (category_id, status),
  INDEX idx_products_brand (brand_id),
  INDEX idx_products_name (name)
) ENGINE=InnoDB;

CREATE TABLE product_images (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  image VARCHAR(500) NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_product_images_product_sort (product_id, sort_order),
  INDEX idx_product_images_primary (product_id, is_primary)
) ENGINE=InnoDB;

CREATE TABLE colors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  hex_code CHAR(7) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE sizes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  type VARCHAR(50) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sizes_name_type (name, type)
) ENGINE=InnoDB;

CREATE TABLE product_variants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  color_id BIGINT UNSIGNED NULL,
  size_id BIGINT UNSIGNED NULL,
  price DECIMAL(12,2) NULL,
  sale_price DECIMAL(12,2) NULL,
  sku VARCHAR(100) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_variants_color FOREIGN KEY (color_id) REFERENCES colors(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_variants_size FOREIGN KEY (size_id) REFERENCES sizes(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_variants_price CHECK (price IS NULL OR price >= 0),
  CONSTRAINT chk_variants_sale_price CHECK (sale_price IS NULL OR (sale_price >= 0 AND (price IS NULL OR sale_price <= price))),
  UNIQUE KEY uq_variants_sku (sku),
  INDEX idx_variants_product (product_id)
) ENGINE=InnoDB;

CREATE TABLE offers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shop_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  image VARCHAR(500) NULL,
  discount_type ENUM('PERCENTAGE','FIXED_AMOUNT') NOT NULL,
  discount_value DECIMAL(12,2) NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  status ENUM('DRAFT','ACTIVE','INACTIVE','EXPIRED') NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_offers_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_offers_discount_value CHECK (discount_value > 0),
  CONSTRAINT chk_offers_dates CHECK (end_at > start_at),
  INDEX idx_offers_shop_status_dates (shop_id, status, start_at, end_at)
) ENGINE=InnoDB;

CREATE TABLE offer_products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  offer_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_offer_products_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_offer_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE KEY uq_offer_product (offer_id, product_id),
  INDEX idx_offer_products_product (product_id)
) ENGINE=InnoDB;

CREATE TABLE favorites (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_favorites_product FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE KEY uq_favorites_user_product (user_id, product_id),
  INDEX idx_favorites_product (product_id)
) ENGINE=InnoDB;

CREATE TABLE carts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('ACTIVE','CHECKED_OUT','ABANDONED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_carts_user_status (user_id, status)
) ENGINE=InnoDB;

CREATE TABLE cart_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cart_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  price DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_cart_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_cart_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_cart_items_price CHECK (price >= 0),
  INDEX idx_cart_items_cart (cart_id),
  INDEX idx_cart_items_product (product_id)
) ENGINE=InnoDB;

CREATE TABLE addresses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(80) NULL,
  recipient_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  city VARCHAR(100) NOT NULL,
  area VARCHAR(100) NULL,
  address TEXT NOT NULL,
  notes TEXT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_addresses_user (user_id)
) ENGINE=InnoDB;
CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  shop_id BIGINT UNSIGNED NOT NULL,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  subtotal DECIMAL(12,2) NOT NULL,
  delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  status ENUM('PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED') NOT NULL DEFAULT 'PENDING',
  payment_status ENUM('UNPAID','PENDING','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED') NOT NULL DEFAULT 'UNPAID',
  shipping_address_id BIGINT UNSIGNED NULL,
  shipping_recipient_name VARCHAR(150) NULL,
  shipping_phone VARCHAR(30) NULL,
  shipping_city VARCHAR(100) NULL,
  shipping_area VARCHAR(100) NULL,
  shipping_address TEXT NULL,
  shipping_notes TEXT NULL,
  customer_note TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_orders_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_orders_address FOREIGN KEY (shipping_address_id) REFERENCES addresses(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_orders_subtotal CHECK (subtotal >= 0),
  CONSTRAINT chk_orders_delivery_fee CHECK (delivery_fee >= 0),
  CONSTRAINT chk_orders_discount CHECK (discount >= 0),
  CONSTRAINT chk_orders_total CHECK (total >= 0),
  INDEX idx_orders_user_created (user_id, created_at),
  INDEX idx_orders_shop_status (shop_id, status),
  INDEX idx_orders_payment_status (payment_status)
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  variant_id BIGINT UNSIGNED NULL,
  product_name VARCHAR(200) NOT NULL,
  product_image VARCHAR(500) NULL,
  variant_description VARCHAR(150) NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_order_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_order_items_unit_price CHECK (unit_price >= 0),
  CONSTRAINT chk_order_items_total CHECK (total >= 0),
  INDEX idx_order_items_order (order_id),
  INDEX idx_order_items_product (product_id)
) ENGINE=InnoDB;
CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(60) NOT NULL,
  transaction_id VARCHAR(190) NULL,
  status ENUM('PENDING','COMPLETED','FAILED','CANCELLED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  paid_at DATETIME NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_payments_amount CHECK (amount >= 0),
  INDEX idx_payments_order_status (order_id, status),
  INDEX idx_payments_transaction (transaction_id)
) ENGINE=InnoDB;

CREATE TABLE shop_reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  shop_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  status ENUM('PENDING','APPROVED','HIDDEN','REJECTED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shop_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_shop_reviews_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_shop_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_shop_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  UNIQUE KEY uq_shop_review_user_order (user_id, order_id),
  INDEX idx_shop_reviews_shop_status (shop_id, status)
) ENGINE=InnoDB;
CREATE TABLE subscription_plans (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  price DECIMAL(12,2) NOT NULL,
  duration INT UNSIGNED NOT NULL,
  duration_unit ENUM('DAY','MONTH','YEAR') NOT NULL DEFAULT 'MONTH',
  features JSON NULL,
  status TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_subscription_plans_price CHECK (price >= 0),
  CONSTRAINT chk_subscription_plans_duration CHECK (duration > 0),
  INDEX idx_subscription_plans_status (status)
) ENGINE=InnoDB;
CREATE TABLE shop_subscriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shop_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  status ENUM('PENDING','ACTIVE','EXPIRED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shop_subscriptions_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_shop_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_shop_subscriptions_price CHECK (price >= 0),
  CONSTRAINT chk_shop_subscriptions_dates CHECK (end_at > start_at),
  INDEX idx_shop_subscriptions_shop_status (shop_id, status),
  INDEX idx_shop_subscriptions_end_at (end_at)
) ENGINE=InnoDB;

