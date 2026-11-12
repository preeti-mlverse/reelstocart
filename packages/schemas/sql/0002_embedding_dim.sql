-- FashionCLIP embeddings are 512-d (the 0001 default of 768 suited SigLIP).
-- No embedding rows exist yet, so we drop + re-add the column at the new dim.
DROP INDEX IF EXISTS product_embedding_hnsw;
ALTER TABLE product_embedding DROP COLUMN IF EXISTS embedding;
ALTER TABLE product_embedding ADD COLUMN embedding vector(512);
CREATE INDEX product_embedding_hnsw
  ON product_embedding USING hnsw (embedding vector_cosine_ops);
