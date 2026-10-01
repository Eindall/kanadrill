import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1790847081144 implements MigrationInterface {
    name = 'InitSchema1790847081144'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "username" character varying(32) NOT NULL, "avatar_url" character varying(512), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "auth_identities" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "provider" character varying(32) NOT NULL, "provider_id" character varying(64) NOT NULL, "display_name" character varying(128), "user_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_63a29aebcddd09448dbeee4666b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b4756e087ec67d0abe2f53792a" ON "auth_identities"  ("provider", "provider_id") `);
        await queryRunner.query(`ALTER TABLE "auth_identities" ADD CONSTRAINT "FK_c06a980d83c42611d27a294e55c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth_identities" DROP CONSTRAINT "FK_c06a980d83c42611d27a294e55c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b4756e087ec67d0abe2f53792a"`);
        await queryRunner.query(`DROP TABLE "auth_identities"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
