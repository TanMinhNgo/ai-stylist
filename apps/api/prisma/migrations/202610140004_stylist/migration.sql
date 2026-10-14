-- AlterTable
ALTER TABLE "outfits" ADD COLUMN     "advice_error_code" TEXT,
ADD COLUMN     "advice_job_id" UUID,
ADD COLUMN     "advice_knowledge_version" TEXT,
ADD COLUMN     "advice_prompt_version" TEXT,
ADD COLUMN     "advice_provider" TEXT,
ADD COLUMN     "advice_status" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMPTZ(3),
ADD COLUMN     "embedding" vector(1024),
ADD COLUMN     "feedback_at" TIMESTAMPTZ(3),
ADD COLUMN     "garment_snapshot" JSONB,
ADD COLUMN     "liked" BOOLEAN;

-- CreateTable
CREATE TABLE "style_profiles" (
    "user_id" UUID NOT NULL,
    "styles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "occasions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budget" INTEGER,
    "preferred_colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avoided_colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "body_shape" TEXT,
    "skin_tone" TEXT,
    "taste_vector" vector(1024),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "style_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "stylist_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "outfit_id" UUID,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error_code" TEXT,
    "started_at" TIMESTAMPTZ(3),
    "result" JSONB,
    "deadline_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stylist_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stylist_jobs_status_deadline_at_idx" ON "stylist_jobs"("status", "deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "stylist_jobs_user_id_key_key" ON "stylist_jobs"("user_id", "key");

-- AddForeignKey
ALTER TABLE "style_profiles" ADD CONSTRAINT "style_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stylist_jobs" ADD CONSTRAINT "stylist_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stylist_jobs" ADD CONSTRAINT "stylist_jobs_outfit_id_fkey" FOREIGN KEY ("outfit_id") REFERENCES "outfits"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
