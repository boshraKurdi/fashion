ALTER TABLE shops
  ADD COLUMN facebook_url VARCHAR(500) NULL AFTER email,
  ADD COLUMN instagram_url VARCHAR(500) NULL AFTER facebook_url,
  ADD COLUMN whatsapp_url VARCHAR(500) NULL AFTER instagram_url;
