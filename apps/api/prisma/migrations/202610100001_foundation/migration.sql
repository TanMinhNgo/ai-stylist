CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "clerk_user_id" TEXT NOT NULL,
  "email" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clerk_updated_at" BIGINT NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");
