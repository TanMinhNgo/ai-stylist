-- Add collections without rewriting or deleting existing business data.
BEGIN;
CREATE UNIQUE INDEX "outfits_user_id_id_key" ON "outfits"("user_id", "id");
CREATE TABLE "outfit_collections" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "occasion" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "outfit_collections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "outfit_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "outfit_collections_user_id_id_key" ON "outfit_collections"("user_id", "id");
CREATE INDEX "outfit_collections_user_id_created_at_id_idx" ON "outfit_collections"("user_id", "created_at", "id");
CREATE TABLE "collection_outfits" (
  "collection_id" UUID NOT NULL,
  "outfit_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  CONSTRAINT "collection_outfits_pkey" PRIMARY KEY ("collection_id", "outfit_id"),
  CONSTRAINT "collection_outfits_user_id_collection_id_fkey" FOREIGN KEY ("user_id", "collection_id") REFERENCES "outfit_collections"("user_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "collection_outfits_user_id_outfit_id_fkey" FOREIGN KEY ("user_id", "outfit_id") REFERENCES "outfits"("user_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "collection_outfits_user_id_outfit_id_idx" ON "collection_outfits"("user_id", "outfit_id");
COMMIT;
