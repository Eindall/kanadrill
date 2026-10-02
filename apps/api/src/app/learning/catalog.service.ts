import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { KANA_TYPES, type CatalogItemDto, type ItemDetailDto, type JlptLevel, type KanaGroup, type StrokeDto } from '@kanadrill/shared';
import { Item } from './item.entity';
import { masteryLevel } from './mastery';
import { UserItem } from './user-item.entity';

interface CatalogRow {
  item_id: string;
  item_type: Item['type'];
  item_character: string;
  item_readings: string[];
  item_group: KanaGroup | null;
}

/** Le mode « Apprendre » : catalogue des éléments et fiche détail, avec la maîtrise de l'utilisateur. */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Item) private readonly items: Repository<Item>,
    @InjectRepository(UserItem) private readonly userItems: Repository<UserItem>,
  ) {}

  /** Tous les kana, dans l'ordre pédagogique. Sans les tracés (lourds) : ils ne servent qu'à la fiche. */
  async list(userId: string): Promise<CatalogItemDto[]> {
    const rows: CatalogRow[] = await this.items
      .createQueryBuilder('item')
      .select(['item.id', 'item.type', 'item.character', 'item.readings'])
      .addSelect("item.metadata ->> 'group'", 'item_group')
      .where('item.type IN (:...types)', { types: KANA_TYPES })
      .orderBy('item.sortOrder', 'ASC')
      .getRawMany();
    const states = await this.userItems.findBy({ userId, itemId: In(rows.map((row) => row.item_id)) });
    const stateByItem = new Map(states.map((userItem) => [userItem.itemId, userItem]));

    return rows.map((row) => ({
      id: row.item_id,
      type: row.item_type,
      character: row.item_character,
      reading: row.item_readings[0],
      group: row.item_group,
      mastery: masteryLevel(stateByItem.get(row.item_id)),
    }));
  }

  async detail(userId: string, itemId: string): Promise<ItemDetailDto> {
    const item = await this.items.findOneBy({ id: itemId });
    if (!item) throw new NotFoundException('Élément introuvable');
    const userItem = await this.userItems.findOneBy({ userId, itemId });
    const metadata = (item.metadata ?? {}) as {
      group?: KanaGroup;
      strokes?: StrokeDto[];
      jlpt?: JlptLevel | null;
      grade?: number | null;
      frequency?: number | null;
      strokeCount?: number | null;
      language?: 'fr' | 'en';
      on?: string[];
      kun?: string[];
    };

    return {
      id: item.id,
      type: item.type,
      character: item.character,
      reading: item.readings[0] ?? '',
      group: metadata.group ?? null,
      mastery: masteryLevel(userItem),
      readings: item.readings,
      meanings: item.meanings,
      ...(item.type === 'kanji'
        ? {
            kanji: {
              on: metadata.on ?? [],
              kun: metadata.kun ?? [],
              jlpt: metadata.jlpt ?? null,
              grade: metadata.grade ?? null,
              frequency: metadata.frequency ?? null,
              strokeCount: metadata.strokeCount ?? null,
              language: metadata.language ?? 'en',
              inDictionary: userItem !== null,
            },
          }
        : {}),
      strokes: metadata.strokes ?? [],
      reps: userItem?.reps ?? 0,
      lapses: userItem?.lapses ?? 0,
      nextDue: userItem && userItem.reps > 0 ? userItem.due.toISOString() : null,
    };
  }
}
