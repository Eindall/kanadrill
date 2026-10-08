import { MigrationInterface, QueryRunner } from "typeorm";

export class ReviewDrawingPrecision1791400000000 implements MigrationInterface {
    name = 'ReviewDrawingPrecision1791400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "review_logs" ADD "drawing_precision" smallint`);
        await queryRunner.query(`ALTER TABLE "review_logs" ADD CONSTRAINT "CHK_review_logs_drawing_precision" CHECK ("drawing_precision" IS NULL OR "drawing_precision" BETWEEN 0 AND 100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "review_logs" DROP CONSTRAINT "CHK_review_logs_drawing_precision"`);
        await queryRunner.query(`ALTER TABLE "review_logs" DROP COLUMN "drawing_precision"`);
    }

}
