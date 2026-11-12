-- Reel-to-Cart initial schema (Phase 1/6/7/11/12).
-- Requires the pgvector extension.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- Auth & users ----------------------------------------------------
CREATE TABLE IF NOT EXISTS app_user (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       CITEXT UNIQUE,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('guest','user','admin')),
  display_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Merchants / brands ---------------------------------------------
CREATE TABLE IF NOT EXISTS merchant (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  integration   TEXT NOT NULL DEFAULT 'manual' CHECK (integration IN ('manual','csv','json','api','shopify','woocommerce')),
  data_use_policy TEXT,
  affiliate_program TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brand (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL,
  merchant_id UUID REFERENCES merchant(id) ON DELETE SET NULL
);

-- ---------- Products --------------------------------------------------------
CREATE TABLE IF NOT EXISTS product (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID NOT NULL REFERENCES merchant(id) ON DELETE CASCADE,
  brand_id      UUID REFERENCES brand(id) ON DELETE SET NULL,
  source_id     TEXT NOT NULL,                      -- stable id from the merchant feed
  title         TEXT NOT NULL,
  category      TEXT NOT NULL,
  subcategory   TEXT,
  description   TEXT,
  product_url   TEXT NOT NULL,
  source_attribution TEXT NOT NULL,
  color         TEXT,
  pattern       TEXT,
  fabric        TEXT,
  fit           TEXT,
  attributes    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at   TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  UNIQUE (merchant_id, source_id)
);
CREATE INDEX IF NOT EXISTS product_category_idx ON product(category) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS product_image (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'front' CHECK (role IN ('front','back','detail','model','other')),
  position   INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_variant (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  sku         TEXT,
  size        TEXT,
  color       TEXT,
  price_inr   NUMERIC(10,2),
  mrp_inr     NUMERIC(10,2),
  UNIQUE (product_id, sku)
);

CREATE TABLE IF NOT EXISTS inventory_snapshot (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID NOT NULL REFERENCES product_variant(id) ON DELETE CASCADE,
  availability TEXT NOT NULL CHECK (availability IN ('in_stock','out_of_stock','unverified')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID NOT NULL REFERENCES product_variant(id) ON DELETE CASCADE,
  price_inr   NUMERIC(10,2) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Embeddings (pgvector) ------------------------------------------
-- Dimension is model-dependent; 768 default (SigLIP). Keep model_id/version with each row.
CREATE TABLE IF NOT EXISTS product_embedding (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  model_id    TEXT NOT NULL,
  model_version TEXT NOT NULL,
  image_role  TEXT NOT NULL DEFAULT 'front',
  dim         INT NOT NULL,
  embedding   vector(768),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_embedding_hnsw
  ON product_embedding USING hnsw (embedding vector_cosine_ops);

-- ---------- Catalogue import bookkeeping -----------------------------------
CREATE TABLE IF NOT EXISTS catalogue_import (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchant(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'running',
  rows_total  INT DEFAULT 0,
  rows_ok     INT DEFAULT 0,
  rows_error  INT DEFAULT 0,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS catalogue_import_error (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id  UUID NOT NULL REFERENCES catalogue_import(id) ON DELETE CASCADE,
  row_ref    TEXT,
  message    TEXT NOT NULL
);

-- ---------- Search jobs & media --------------------------------------------
CREATE TABLE IF NOT EXISTS media_asset (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID REFERENCES app_user(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('image','video')),
  storage_key TEXT NOT NULL,
  mime        TEXT NOT NULL,
  bytes       BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,                          -- media auto-expiry
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS search_job (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID REFERENCES app_user(id) ON DELETE SET NULL,
  input_kind  TEXT NOT NULL,                        -- url | image_url | upload
  input_ref   TEXT NOT NULL,                        -- original url or media id (reference metadata)
  provider    TEXT,                                 -- instagram | youtube | direct | upload
  status      TEXT NOT NULL DEFAULT 'VALIDATING',
  result      JSONB,
  cost_usd    NUMERIC(10,5) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Saved looks / collections --------------------------------------
CREATE TABLE IF NOT EXISTS saved_look (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  job_id     UUID REFERENCES search_job(id) ON DELETE SET NULL,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Commerce tracking (Phase 11) -----------------------------------
CREATE TABLE IF NOT EXISTS product_event (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES product(id) ON DELETE SET NULL,
  user_id    UUID REFERENCES app_user(id) ON DELETE SET NULL,
  job_id     UUID REFERENCES search_job(id) ON DELETE SET NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('impression','click','redirect','conversion')),
  sponsored  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Cost & observability (Phase 12/14) -----------------------------
CREATE TABLE IF NOT EXISTS ai_op_cost (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID REFERENCES search_job(id) ON DELETE SET NULL,
  stage      TEXT NOT NULL,                         -- detect | attributes | embed | rerank | video
  model      TEXT NOT NULL,
  cost_usd   NUMERIC(10,6) NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Safety (Phase 12 F) --------------------------------------------
CREATE TABLE IF NOT EXISTS deletion_request (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES app_user(id) ON DELETE SET NULL,
  media_id   UUID REFERENCES media_asset(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID REFERENCES app_user(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  target     TEXT,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
