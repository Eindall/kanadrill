import { MigrationInterface, QueryRunner } from "typeorm";

export class ReviewPoints1791600000000 implements MigrationInterface {
    name = 'ReviewPoints1791600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Le rythme chronométré concerne désormais tous les exercices, pas seulement le tracé.
        await queryRunner.query(`ALTER TABLE "review_logs" RENAME COLUMN "drawing_timed" TO "timed"`);
        await queryRunner.query(`ALTER TABLE "review_logs" ADD "points" smallint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "review_logs" ADD CONSTRAINT "CHK_review_logs_points" CHECK ("points" BETWEEN 0 AND 120)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "review_logs" DROP CONSTRAINT "CHK_review_logs_points"`);
        await queryRunner.query(`ALTER TABLE "review_logs" DROP COLUMN "points"`);
        await queryRunner.query(`ALTER TABLE "review_logs" RENAME COLUMN "timed" TO "drawing_timed"`);
    }

}
