import { MigrationInterface, QueryRunner } from "typeorm";

export class DailyGoal1790867345952 implements MigrationInterface {
    name = 'DailyGoal1790867345952'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_e69b99c7f33a0ac4cf14d6f7c7"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "daily_new_limit" TO "daily_goal"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "daily_goal" SET DEFAULT '30'`);
        // L'ancienne valeur (nouvelles cartes par jour, 0 possible) n'a pas le même sens que l'objectif : on repart du défaut.
        await queryRunner.query(`UPDATE "users" SET "daily_goal" = 30`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "CHK_bedeb58f5c9d01fd1c40788d2c" CHECK ("daily_goal" BETWEEN 1 AND 500)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_bedeb58f5c9d01fd1c40788d2c"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "daily_goal" SET DEFAULT '10'`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "daily_goal" TO "daily_new_limit"`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "CHK_e69b99c7f33a0ac4cf14d6f7c7" CHECK (((daily_new_limit >= 0) AND (daily_new_limit <= 100)))`);
    }

}
