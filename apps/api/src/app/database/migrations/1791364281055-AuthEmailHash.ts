import { MigrationInterface, QueryRunner } from "typeorm";

export class AuthEmailHash1791364281055 implements MigrationInterface {
    name = 'AuthEmailHash1791364281055'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth_identities" ADD "email_hash" character varying(64)`);
        await queryRunner.query(`CREATE INDEX "IDX_8e930034f0cfd49b05bed33a89" ON "auth_identities"  ("email_hash") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_8e930034f0cfd49b05bed33a89"`);
        await queryRunner.query(`ALTER TABLE "auth_identities" DROP COLUMN "email_hash"`);
    }

}
