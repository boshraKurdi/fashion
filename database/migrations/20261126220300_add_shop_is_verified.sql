SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'shops'
        AND COLUMN_NAME = 'is_verified'
    ),
    'SELECT 1',
    'ALTER TABLE shops ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'shops'
        AND COLUMN_NAME = 'verified_at'
    ),
    'SELECT 1',
    'ALTER TABLE shops ADD COLUMN verified_at DATETIME NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
