import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedCustomer } from '../common/types/auth.types';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List approved product reviews' })
  @ApiOkResponse({ description: 'Reviews returned successfully' })
  async list(@Param('productId') productId: string, @Query() query: ReviewQueryDto) {
    return { message: 'Reviews returned successfully', data: await this.reviewsService.publicProductReviews(productId, query) };
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create product review' })
  @ApiCreatedResponse({ description: 'Review created successfully' })
  async create(@Param('productId') productId: string, @Body() dto: CreateReviewDto, @CurrentUser() user: AuthenticatedCustomer) {
    return { message: 'Review created successfully', data: await this.reviewsService.create(productId, user.id, dto) };
  }
}
