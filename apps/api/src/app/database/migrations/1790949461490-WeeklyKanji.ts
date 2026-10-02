import { MigrationInterface, QueryRunner } from "typeorm";

export class WeeklyKanji1790949461490 implements MigrationInterface {
    name = 'WeeklyKanji1790949461490'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "weekly_kanji" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "item_id" uuid NOT NULL, "week_start" date NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0bc136c9c32c6fc2fc05042ff2d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2f54b2704fbc491a6f77d8cdd4" ON "weekly_kanji"  ("user_id", "week_start") `);
        await queryRunner.query(`ALTER TABLE "weekly_kanji" ADD CONSTRAINT "FK_2e32ae38814125b8dc82958ed16" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "weekly_kanji" ADD CONSTRAINT "FK_0b03044e4445ac6ce29c0ae6a72" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "weekly_kanji" DROP CONSTRAINT "FK_0b03044e4445ac6ce29c0ae6a72"`);
        await queryRunner.query(`ALTER TABLE "weekly_kanji" DROP CONSTRAINT "FK_2e32ae38814125b8dc82958ed16"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2f54b2704fbc491a6f77d8cdd4"`);
        await queryRunner.query(`DROP TABLE "weekly_kanji"`);
    }

}
