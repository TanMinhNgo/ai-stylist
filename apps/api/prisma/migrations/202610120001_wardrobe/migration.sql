CREATE TABLE "upload_grants" (
  "token" UUID NOT NULL PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "folder" TEXT NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "used_at" TIMESTAMPTZ(3),
  "imagekit_file_id" TEXT UNIQUE
);
CREATE INDEX "upload_grants_user_id_idx" ON "upload_grants"("user_id");

CREATE TABLE "model_photos" (
  "id" UUID NOT NULL PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "imagekit_file_id" TEXT NOT NULL UNIQUE,
  "file_path" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','ready','failed')),
  "error_code" TEXT,
  "analysis" JSONB,
  "prompt_version" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "model_photos_user_id_created_at_id_idx" ON "model_photos"("user_id", "created_at", "id");

CREATE TABLE "garments" (
  "id" UUID NOT NULL PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "imagekit_file_id" TEXT NOT NULL UNIQUE,
  "file_path" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','ready','failed')),
  "error_code" TEXT,
  "category" TEXT,
  "tags" JSONB,
  "embedding" vector(1024),
  "prompt_version" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "garments_user_id_created_at_id_idx" ON "garments"("user_id", "created_at", "id");
CREATE INDEX "garments_user_id_category_idx" ON "garments"("user_id", "category");
