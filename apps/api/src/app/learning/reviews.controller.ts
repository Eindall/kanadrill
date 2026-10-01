import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import type { ReviewOverviewDto, ReviewResultDto, ReviewSessionDto } from '@kanadrill/shared';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubmitReviewDto } from './review-session.dto';
import { SessionQueryDto } from './session-query.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('overview')
  overview(@CurrentUserId() userId: string): Promise<ReviewOverviewDto> {
    return this.reviews.getOverview(userId);
  }

  @Get('session')
  session(@CurrentUserId() userId: string, @Query() query: SessionQueryDto): Promise<ReviewSessionDto> {
    return this.reviews.getSession(userId, query);
  }

  @Post()
  @HttpCode(200)
  submit(@CurrentUserId() userId: string, @Body() body: SubmitReviewDto): Promise<ReviewResultDto> {
    return this.reviews.submit(userId, body);
  }
}
