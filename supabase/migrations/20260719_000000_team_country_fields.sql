-- Add country code and secondary-country fields to site_team
-- secondary_* fields are used exclusively for the CEO (two-country expansion card)

ALTER TABLE viralizahost.site_team
  ADD COLUMN IF NOT EXISTS country_code        text,
  ADD COLUMN IF NOT EXISTS specialty           text,
  ADD COLUMN IF NOT EXISTS secondary_flag      text,
  ADD COLUMN IF NOT EXISTS secondary_country_code text,
  ADD COLUMN IF NOT EXISTS secondary_country_name text;
