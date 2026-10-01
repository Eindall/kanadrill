import { MigrationInterface, QueryRunner } from "typeorm";

export class LearningSchema1790863719553 implements MigrationInterface {
    name = 'LearningSchema1790863719553'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "type" character varying(16) NOT NULL, "character" character varying(16) NOT NULL, "readings" text array NOT NULL, "meanings" text array NOT NULL DEFAULT '{}', "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_a0ba91dc8096e4448571e3ddd0" CHECK ("type" IN ('hiragana', 'katakana', 'kanji')), CONSTRAINT "PK_ba5885359424c15ca6b9e79bcf6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1f5766deb363ea3c888e4a2a4b" ON "items"  ("type", "character") `);
        await queryRunner.query(`CREATE TABLE "review_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "item_id" uuid NOT NULL, "rating" smallint NOT NULL, "duration_ms" integer NOT NULL, "reviewed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "state" smallint NOT NULL, "due" TIMESTAMP WITH TIME ZONE NOT NULL, "stability" double precision NOT NULL, "difficulty" double precision NOT NULL, "elapsed_days" integer NOT NULL, "last_elapsed_days" integer NOT NULL, "scheduled_days" integer NOT NULL, "learning_steps" integer NOT NULL, CONSTRAINT "CHK_a95c09c67e3495df3fcf6085dd" CHECK ("rating" BETWEEN 1 AND 4), CONSTRAINT "PK_50f4c1ba68709ee9db5e55caace" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_139badefb7f5c9c0391b772b2d" ON "review_logs"  ("user_id", "reviewed_at") `);
        await queryRunner.query(`CREATE TABLE "user_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "item_id" uuid NOT NULL, "due" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "stability" double precision NOT NULL DEFAULT '0', "difficulty" double precision NOT NULL DEFAULT '0', "elapsed_days" integer NOT NULL DEFAULT '0', "scheduled_days" integer NOT NULL DEFAULT '0', "learning_steps" integer NOT NULL DEFAULT '0', "reps" integer NOT NULL DEFAULT '0', "lapses" integer NOT NULL DEFAULT '0', "state" smallint NOT NULL DEFAULT '0', "last_review" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_73bc2ecd8f15ae345af4d8c3c09" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4f7fb75f8b85722c61cddfce2e" ON "user_items"  ("user_id", "due") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_66e6a222459453e55a71bde6d8" ON "user_items"  ("user_id", "item_id") `);
        await queryRunner.query(`ALTER TABLE "review_logs" ADD CONSTRAINT "FK_b8b0075cc11fddb64e84a987026" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "review_logs" ADD CONSTRAINT "FK_e1285737e3b747a99c31fcd1b09" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_items" ADD CONSTRAINT "FK_020e818d4ac25c16e4906f27d8b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_items" ADD CONSTRAINT "FK_9a25434e868cc98a8401560adc8" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_items" DROP CONSTRAINT "FK_9a25434e868cc98a8401560adc8"`);
        await queryRunner.query(`ALTER TABLE "user_items" DROP CONSTRAINT "FK_020e818d4ac25c16e4906f27d8b"`);
        await queryRunner.query(`ALTER TABLE "review_logs" DROP CONSTRAINT "FK_e1285737e3b747a99c31fcd1b09"`);
        await queryRunner.query(`ALTER TABLE "review_logs" DROP CONSTRAINT "FK_b8b0075cc11fddb64e84a987026"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_66e6a222459453e55a71bde6d8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f7fb75f8b85722c61cddfce2e"`);
        await queryRunner.query(`DROP TABLE "user_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_139badefb7f5c9c0391b772b2d"`);
        await queryRunner.query(`DROP TABLE "review_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1f5766deb363ea3c888e4a2a4b"`);
        await queryRunner.query(`DROP TABLE "items"`);
    }

}
