-- CreateTable
CREATE TABLE "tryon_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "model_photo_id" UUID NOT NULL,
    "garment_ids" UUID[],
    "occasion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider" TEXT NOT NULL,
    "image_model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL DEFAULT 'tryon-v1',
    "error_code" TEXT,
    "generation_started_at" TIMESTAMPTZ(3),
    "result_file_id" TEXT,
    "result_file_path" TEXT,
    "refunded_at" TIMESTAMPTZ(3),
    "deadline_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tryon_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outfits" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tryon_job_id" UUID NOT NULL,
    "imagekit_file_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "advice" JSONB,
    "saved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outfits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tryon_jobs_result_file_id_key" ON "tryon_jobs"("result_file_id");

-- CreateIndex
CREATE INDEX "tryon_jobs_status_deadline_at_idx" ON "tryon_jobs"("status", "deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "tryon_jobs_user_id_idempotency_key_key" ON "tryon_jobs"("user_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "outfits_tryon_job_id_key" ON "outfits"("tryon_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "outfits_imagekit_file_id_key" ON "outfits"("imagekit_file_id");

-- CreateIndex
CREATE INDEX "outfits_user_id_created_at_idx" ON "outfits"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "tryon_jobs" ADD CONSTRAINT "tryon_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "outfits" ADD CONSTRAINT "outfits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "outfits" ADD CONSTRAINT "outfits_tryon_job_id_fkey" FOREIGN KEY ("tryon_job_id") REFERENCES "tryon_jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
