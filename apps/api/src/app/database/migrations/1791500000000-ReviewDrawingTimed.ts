import { MigrationInterface, QueryRunner } from "typeorm";

export class ReviewDrawingTimed1791500000000 implements MigrationInterface {
    name = 'ReviewDrawingTimed1791500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "review_logs" ADD "drawing_timed" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "review_logs" DROP COLUMN "drawing_timed"`);
    }

}
