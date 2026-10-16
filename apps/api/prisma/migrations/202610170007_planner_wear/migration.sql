BEGIN;
CREATE TABLE "planner_days" (
 "id" UUID NOT NULL PRIMARY KEY, "user_id" UUID NOT NULL,
 "date" DATE NOT NULL, "time_zone" VARCHAR(100) NOT NULL, "occasion" VARCHAR(120) NOT NULL,
 "outfit_id" UUID, "outfit_unavailable" BOOLEAN NOT NULL DEFAULT false,
 CONSTRAINT "planner_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
 CONSTRAINT "planner_days_user_id_outfit_id_fkey" FOREIGN KEY ("user_id", "outfit_id") REFERENCES "outfits"("user_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "planner_days_user_id_time_zone_date_key" ON "planner_days"("user_id", "time_zone", "date");
CREATE INDEX "planner_days_user_id_outfit_id_idx" ON "planner_days"("user_id", "outfit_id");
CREATE TABLE "wear_records" (
 "id" UUID NOT NULL PRIMARY KEY, "user_id" UUID NOT NULL, "date" DATE NOT NULL,
 "time_zone" VARCHAR(100) NOT NULL, "outfit_id" UUID, "garment_ids" UUID[] NOT NULL,
 "request_hash" TEXT NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "wear_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
 CONSTRAINT "wear_records_user_id_outfit_id_fkey" FOREIGN KEY ("user_id", "outfit_id") REFERENCES "outfits"("user_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "wear_records_user_id_date_outfit_id_key" ON "wear_records"("user_id", "date", "outfit_id");
CREATE INDEX "wear_records_user_id_date_idx" ON "wear_records"("user_id", "date");
CREATE INDEX "wear_records_user_id_outfit_id_idx" ON "wear_records"("user_id", "outfit_id");
COMMIT;
