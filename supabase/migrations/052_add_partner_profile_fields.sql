-- Add rich partner profile fields (synced from Airtable)
ALTER TABLE partners ADD COLUMN IF NOT EXISTS architecture TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS listing_types TEXT[];
ALTER TABLE partners ADD COLUMN IF NOT EXISTS pricing_model TEXT[];
ALTER TABLE partners ADD COLUMN IF NOT EXISTS isva_status TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS deployed_on_aws TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS prm_status TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS crm_status TEXT;
