import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnQueryDto } from './dto/return-query.dto';
import { ReturnsService } from './returns.service';

@ApiTags('Returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @ApiOperation({ summary: 'Create return request' })
  @ApiCreatedResponse({ description: 'Return request created successfully' })
  async create(
    @CurrentUser() user: AuthenticatedCustomer,
    @Body() dto: CreateReturnDto,
  ) {
    return {
      message: 'Return request created successfully',
      data: await this.returnsService.createCustomerReturn(user.id, dto),
    };
  }

  @Get()
  @ApiOperation({ summary: 'List customer returns' })
  @ApiOkResponse({ description: 'Return requests returned successfully' })
  async list(
    @CurrentUser() user: AuthenticatedCustomer,
    @Query() query: ReturnQueryDto,
  ) {
    return {
      message: 'Return requests returned successfully',
      data: await this.returnsService.listCustomerReturns(user.id, query),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer return detail' })
  @ApiOkResponse({ description: 'Return request returned successfully' })
  async detail(
    @CurrentUser() user: AuthenticatedCustomer,
    @Param('id') id: string,
  ) {
    return {
      message: 'Return request returned successfully',
      data: await this.returnsService.getCustomerReturn(user.id, id),
    };
  }
}
