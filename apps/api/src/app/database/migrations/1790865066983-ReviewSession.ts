import { MigrationInterface, QueryRunner } from "typeorm";

export class ReviewSession1790865066983 implements MigrationInterface {
    name = 'ReviewSession1790865066983'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "items" ADD "sort_order" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "daily_new_limit" smallint NOT NULL DEFAULT '10'`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "CHK_e69b99c7f33a0ac4cf14d6f7c7" CHECK ("daily_new_limit" BETWEEN 0 AND 100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_e69b99c7f33a0ac4cf14d6f7c7"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "daily_new_limit"`);
        await queryRunner.query(`ALTER TABLE "items" DROP COLUMN "sort_order"`);
    }

}
