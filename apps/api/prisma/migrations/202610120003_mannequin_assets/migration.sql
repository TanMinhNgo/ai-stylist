-- AlterTable
ALTER TABLE "garments" ADD COLUMN     "asset_body_key" TEXT NOT NULL DEFAULT 'f',
ADD COLUMN     "asset_error_code" TEXT,
ADD COLUMN     "current_asset_id" UUID,
ADD COLUMN     "deleting_at" TIMESTAMPTZ(3),
ADD COLUMN     "generate_asset" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requested_type" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'user_photo';

-- CreateTable
CREATE TABLE "asset_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "batch_key" TEXT NOT NULL,
    "item_index" INTEGER NOT NULL,
    "request_hash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "body_key" TEXT NOT NULL,
    "garment_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider" TEXT NOT NULL,
    "image_model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL DEFAULT 'asset-v1',
    "error_code" TEXT,
    "generation_started_at" TIMESTAMPTZ(3),
    "quota_day" TEXT NOT NULL,
    "refunded_at" TIMESTAMPTZ(3),
    "result_file_id" TEXT,
    "result_file_path" TEXT,
    "render_meta" JSONB,
    "proposals" JSONB,
    "deadline_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_jobs_result_file_id_key" ON "asset_jobs"("result_file_id");

-- CreateIndex
CREATE INDEX "asset_jobs_user_id_quota_day_kind_refunded_at_idx" ON "asset_jobs"("user_id", "quota_day", "kind", "refunded_at");

-- CreateIndex
CREATE INDEX "asset_jobs_status_deadline_at_idx" ON "asset_jobs"("status", "deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "asset_jobs_user_id_batch_key_item_index_key" ON "asset_jobs"("user_id", "batch_key", "item_index");

-- AddForeignKey
ALTER TABLE "garments" ADD CONSTRAINT "garments_current_asset_id_fkey" FOREIGN KEY ("current_asset_id") REFERENCES "asset_jobs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asset_jobs" ADD CONSTRAINT "asset_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asset_jobs" ADD CONSTRAINT "asset_jobs_garment_id_fkey" FOREIGN KEY ("garment_id") REFERENCES "garments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
