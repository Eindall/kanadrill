import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { ReviewResultDto, ReviewSessionDto } from '@kanadrill/shared';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubmitReviewDto } from './review-session.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('session')
  session(@CurrentUserId() userId: string): Promise<ReviewSessionDto> {
    return this.reviews.getSession(userId);
  }

  @Post()
  @HttpCode(200)
  submit(@CurrentUserId() userId: string, @Body() body: SubmitReviewDto): Promise<ReviewResultDto> {
    return this.reviews.submit(userId, body);
  }
}
