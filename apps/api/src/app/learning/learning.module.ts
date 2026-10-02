import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionModule } from '../auth/session.module';
import { User } from '../users/user.entity';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { DictionaryService } from './dictionary.service';
import { Item } from './item.entity';
import { KanjiController } from './kanji.controller';
import { KanjiService } from './kanji.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { SeedService } from './seed.service';
import { UserItem } from './user-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Item, UserItem]), SessionModule],
  controllers: [ReviewsController, CatalogController, KanjiController],
  providers: [SeedService, ReviewsService, CatalogService, KanjiService, DictionaryService],
})
export class LearningModule {}
