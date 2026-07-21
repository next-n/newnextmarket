import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Admin Customers')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Permissions('customers:read')
  @ApiOperation({ summary: 'List registered customers' })
  @ApiOkResponse({ description: 'Customers returned successfully' })
  async list(
    @Query('page') pageParam?: string,
    @Query('limit') limitParam?: string,
    @Query('search') search?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitParam ?? '20', 10) || 20));
    const trimmedSearch = search?.trim();
    const where: any = {
      deletedAt: null,
      ...(trimmedSearch
        ? {
            OR: [
              { email: { contains: trimmedSearch, mode: 'insensitive' } },
              { firstName: { contains: trimmedSearch, mode: 'insensitive' } },
              { lastName: { contains: trimmedSearch, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [customers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          status: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      message: 'Customers returned successfully',
      data: {
        items: customers.map((customer) => ({
          id: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
          status: customer.status,
          orderCount: customer._count.orders,
          createdAt: customer.createdAt,
        })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      },
    };
  }
}
