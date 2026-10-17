CREATE TABLE "calendar_events" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "date" DATE NOT NULL,
  "time_zone" VARCHAR(100) NOT NULL, "title" VARCHAR(120) NOT NULL, "occasion" VARCHAR(120) NOT NULL,
  CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("user_id","id"),
  CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "calendar_events_user_id_time_zone_date_idx" ON "calendar_events"("user_id","time_zone","date");
CREATE TABLE "affiliate_clicks" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "product_id" VARCHAR(80) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("user_id","id"),
  CONSTRAINT "affiliate_clicks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "affiliate_clicks_user_id_created_at_idx" ON "affiliate_clicks"("user_id","created_at");
CREATE TABLE "lookbook_shares" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "collection_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL, "title" VARCHAR(80) NOT NULL, "outfit_ids" UUID[] NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lookbook_shares_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lookbook_shares_user_id_collection_id_fkey" FOREIGN KEY ("user_id","collection_id") REFERENCES "outfit_collections"("user_id","id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "lookbook_shares_token_hash_key" ON "lookbook_shares"("token_hash");
CREATE INDEX "lookbook_shares_user_id_expires_at_idx" ON "lookbook_shares"("user_id","expires_at");
