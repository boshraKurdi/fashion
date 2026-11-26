CREATE TABLE IF NOT EXISTS platform_settings (
  id INT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  platform_name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  logo VARCHAR(500) NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(30) NULL,
  support_email VARCHAR(190) NULL,
  support_phone VARCHAR(30) NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  social_links JSON NULL,
  general JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_platform_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB;

INSERT INTO platform_settings (id, platform_name)
VALUES (1, 'Fashion Marketplace')
ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS payment_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  method_name VARCHAR(100) NOT NULL,
  provider_name VARCHAR(150) NOT NULL,
  account_name VARCHAR(150) NOT NULL,
  account_number VARCHAR(190) NULL,
  payment_code VARCHAR(190) NULL,
  qr_image VARCHAR(500) NULL,
  instructions TEXT NULL,
  status TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_payment_account_status CHECK (status IN (0,1)),
  CONSTRAINT chk_payment_account_value CHECK (account_number IS NOT NULL OR payment_code IS NOT NULL),
  INDEX idx_payment_accounts_status_order (status, sort_order)
) ENGINE=InnoDB;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'proof_image'
    ),
    'SELECT 1',
    'ALTER TABLE payments ADD COLUMN proof_image VARCHAR(500) NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'payment_account_id'
    ),
    'SELECT 1',
    'ALTER TABLE payments ADD COLUMN payment_account_id BIGINT UNSIGNED NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'reviewed_by_id'
    ),
    'SELECT 1',
    'ALTER TABLE payments ADD COLUMN reviewed_by_id BIGINT UNSIGNED NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'reviewed_at'
    ),
    'SELECT 1',
    'ALTER TABLE payments ADD COLUMN reviewed_at DATETIME NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND CONSTRAINT_NAME = 'fk_payments_account'
    ),
    'SELECT 1',
    'ALTER TABLE payments ADD CONSTRAINT fk_payments_account FOREIGN KEY (payment_account_id) REFERENCES payment_accounts(id) ON UPDATE CASCADE ON DELETE SET NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND CONSTRAINT_NAME = 'fk_payments_reviewer'
    ),
    'SELECT 1',
    'ALTER TABLE payments ADD CONSTRAINT fk_payments_reviewer FOREIGN KEY (reviewed_by_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
