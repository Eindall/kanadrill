import { MigrationInterface, QueryRunner } from "typeorm";

export class AuthSessions1790868949782 implements MigrationInterface {
    name = 'AuthSessions1790868949782'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "auth_sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_used_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "user_agent" character varying(256), CONSTRAINT "PK_641507381f32580e8479efc36cd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a4a11809dcf8cdd5fcceec774e" ON "auth_sessions"  ("expires_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_50ccaa6440288a06f0ba693ccc" ON "auth_sessions"  ("user_id") `);
        await queryRunner.query(`ALTER TABLE "auth_sessions" ADD CONSTRAINT "FK_50ccaa6440288a06f0ba693ccc6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth_sessions" DROP CONSTRAINT "FK_50ccaa6440288a06f0ba693ccc6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_50ccaa6440288a06f0ba693ccc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4a11809dcf8cdd5fcceec774e"`);
        await queryRunner.query(`DROP TABLE "auth_sessions"`);
    }

}
