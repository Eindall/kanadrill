import { MigrationInterface, QueryRunner } from "typeorm";

export class LeaderboardVisibility1790900000000 implements MigrationInterface {
    name = 'LeaderboardVisibility1790900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "leaderboard_visible" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "leaderboard_visible"`);
    }

}
