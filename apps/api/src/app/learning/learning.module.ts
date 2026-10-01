import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionModule } from '../auth/session.module';
import { User } from '../users/user.entity';
import { Item } from './item.entity';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { SeedService } from './seed.service';
import { UserItem } from './user-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Item, UserItem]), SessionModule],
  controllers: [ReviewsController],
  providers: [SeedService, ReviewsService],
})
export class LearningModule {}
