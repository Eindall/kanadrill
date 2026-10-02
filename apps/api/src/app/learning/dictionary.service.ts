import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { KanjiLevel } from '@kanadrill/shared';

/**
 * Le dictionnaire perso : les kana y sont d'office, les kanji sur ajout explicite. Ajouter un kanji crée son
 * `UserItem` (carte neuve, à réviser tout de suite) ; le retirer le supprime avec sa progression (l'historique
 * des réponses, lui, reste).
 */
@Injectable()
export class DictionaryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Ajoute des kanji ; les identifiants qui n'en sont pas (kana, inconnus) sont ignorés. Renvoie le nombre ajouté. */
  async add(userId: string, itemIds: readonly string[]): Promise<number> {
    const rows: unknown[] = await this.dataSource.query(
      `INSERT INTO user_items (user_id, item_id)
       SELECT $1, i.id FROM items i WHERE i.id = ANY($2::uuid[]) AND i.type = 'kanji'
       ON CONFLICT (user_id, item_id) DO NOTHING RETURNING id`,
      [userId, itemIds],
    );
    return rows.length;
  }

  /** Ajoute tous les kanji d'un niveau JLPT (ou de « autres »). */
  async addLevel(userId: string, level: KanjiLevel): Promise<number> {
    const rows: unknown[] = await this.dataSource.query(
      `INSERT INTO user_items (user_id, item_id)
       SELECT $1, i.id FROM items i
       WHERE i.type = 'kanji' AND ${level === 'other' ? `i.metadata ->> 'jlpt' IS NULL` : `i.metadata ->> 'jlpt' = $2`}
       ON CONFLICT (user_id, item_id) DO NOTHING RETURNING id`,
      level === 'other' ? [userId] : [userId, level],
    );
    return rows.length;
  }

  async remove(userId: string, itemId: string): Promise<void> {
    // TypeORM renvoie [lignes, nombre] pour un DELETE.
    const [deleted]: [unknown[], number] = await this.dataSource.query(
      `DELETE FROM user_items ui USING items i
       WHERE ui.item_id = i.id AND ui.user_id = $1 AND i.id = $2 AND i.type = 'kanji' RETURNING ui.id`,
      [userId, itemId],
    );
    if (deleted.length === 0) throw new NotFoundException("Ce kanji n'est pas dans ton dictionnaire");
  }
}
