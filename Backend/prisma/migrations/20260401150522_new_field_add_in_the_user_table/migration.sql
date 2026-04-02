-- AlterTable
ALTER TABLE "users" ADD COLUMN     "report_to_id" INTEGER;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_report_to_id_fkey" FOREIGN KEY ("report_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
