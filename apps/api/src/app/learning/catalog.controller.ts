import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import type { CatalogItemDto, ItemDetailDto } from '@kanadrill/shared';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CatalogService } from './catalog.service';

@Controller('catalog')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@CurrentUserId() userId: string): Promise<CatalogItemDto[]> {
    return this.catalog.list(userId);
  }

  @Get(':id')
  detail(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<ItemDetailDto> {
    return this.catalog.detail(userId, id);
  }
}
