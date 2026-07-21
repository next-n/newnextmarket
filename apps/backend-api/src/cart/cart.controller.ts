import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedCustomer } from '../common/types/auth.types';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartService } from './cart.service';

@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get or create active customer cart' })
  @ApiOkResponse({ description: 'Cart returned successfully' })
  async getCart(@CurrentUser() user: AuthenticatedCustomer) {
    return {
      message: 'Cart returned successfully',
      data: await this.cartService.getCart(user.id),
    };
  }

  @Post('items')
  @ApiOperation({ summary: 'Add an item to the active cart' })
  @ApiCreatedResponse({ description: 'Cart item added successfully' })
  async addItem(
    @CurrentUser() user: AuthenticatedCustomer,
    @Body() dto: AddCartItemDto,
  ) {
    return {
      message: 'Cart item added successfully',
      data: await this.cartService.addItem(user.id, dto),
    };
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiOkResponse({ description: 'Cart item updated successfully' })
  async updateItem(
    @CurrentUser() user: AuthenticatedCustomer,
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return {
      message: 'Cart item updated successfully',
      data: await this.cartService.updateItem(user.id, id, dto),
    };
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Remove cart item' })
  @ApiOkResponse({ description: 'Cart item removed successfully' })
  async removeItem(
    @CurrentUser() user: AuthenticatedCustomer,
    @Param('id') id: string,
  ) {
    return {
      message: 'Cart item removed successfully',
      data: await this.cartService.removeItem(user.id, id),
    };
  }

  @Delete()
  @ApiOperation({ summary: 'Clear active cart' })
  @ApiOkResponse({ description: 'Cart cleared successfully' })
  async clearCart(@CurrentUser() user: AuthenticatedCustomer) {
    return {
      message: 'Cart cleared successfully',
      data: await this.cartService.clearCart(user.id),
    };
  }

  @Post('apply-coupon')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply coupon to active cart' })
  @ApiOkResponse({ description: 'Coupon applied successfully' })
  async applyCoupon(
    @CurrentUser() user: AuthenticatedCustomer,
    @Body() dto: ApplyCouponDto,
  ) {
    return {
      message: 'Coupon applied successfully',
      data: await this.cartService.applyCoupon(user.id, dto),
    };
  }

  @Delete('remove-coupon')
  @ApiOperation({ summary: 'Remove coupon from active cart' })
  @ApiOkResponse({ description: 'Coupon removed successfully' })
  async removeCoupon(@CurrentUser() user: AuthenticatedCustomer) {
    return {
      message: 'Coupon removed successfully',
      data: await this.cartService.removeCoupon(user.id),
    };
  }
}
