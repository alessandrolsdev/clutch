-- CreateTable
CREATE TABLE "game_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "game_title" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "hours_played" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "emotion" TEXT NOT NULL,
    "review" TEXT,
    "finished_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "game_logs" ADD CONSTRAINT "game_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
