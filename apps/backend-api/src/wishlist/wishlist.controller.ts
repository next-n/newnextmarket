import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedCustomer } from '../common/types/auth.types';
import { WishlistService } from './wishlist.service';

@ApiTags('Wishlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get customer wishlist' })
  async get(@CurrentUser() user: AuthenticatedCustomer) {
    return { message: 'Wishlist returned successfully', data: await this.wishlistService.get(user.id) };
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Add product to wishlist' })
  async add(@CurrentUser() user: AuthenticatedCustomer, @Param('productId') productId: string) {
    return { message: 'Wishlist item added successfully', data: await this.wishlistService.add(user.id, productId) };
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove product from wishlist' })
  async remove(@CurrentUser() user: AuthenticatedCustomer, @Param('productId') productId: string) {
    return { message: 'Wishlist item removed successfully', data: await this.wishlistService.remove(user.id, productId) };
  }
}
