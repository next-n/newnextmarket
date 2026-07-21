import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  AuditAction,
  OrderStatus,
  ShipmentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ShipmentQueryDto } from './dto/shipment-query.dto';
import { ShippingCalculateDto } from './dto/shipping-calculate.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';

type ShippingSettings = {
  currency: string;
  defaultShippingFee: number;
  freeShippingThreshold: number;
};

type ShippingMethodsResponse = {
  methods: Array<{
    id: string;
    name: string;
    estimatedDeliveryDays: { min: number; max: number };
  }>;
};

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async methods() {
    const cached = await this.redis?.get<ShippingMethodsResponse>('shipping:methods');

    if (cached) {
      return cached;
    }

    const response: ShippingMethodsResponse = {
      methods: [
        {
          id: 'standard',
          name: 'Standard Shipping',
          estimatedDeliveryDays: { min: 3, max: 7 },
        },
        {
          id: 'express',
          name: 'Express Shipping',
          estimatedDeliveryDays: { min: 1, max: 3 },
        },
      ],
    };
    await this.redis?.set('shipping:methods', response, 1800);
    return response;
  }

  async calculate(dto: ShippingCalculateDto) {
    const settings = await this.getSettings();
    const subtotal = dto.subtotal ?? 0;
    const standard = this.money(
      subtotal > 0 &&
        settings.freeShippingThreshold > 0 &&
        subtotal >= settings.freeShippingThreshold
        ? 0
        : settings.defaultShippingFee,
    );
    const express = this.money(Math.max(settings.defaultShippingFee * 2, 0));

    return {
      currency: settings.currency,
      destination: {
        country: dto.country,
        state: dto.state,
        city: dto.city,
      },
      methods: [
        {
          id: 'standard',
          name: 'Standard Shipping',
          amount: standard,
          estimatedDeliveryDays: { min: 3, max: 7 },
          isFree: standard === 0 && subtotal > 0,
        },
        {
          id: 'express',
          name: 'Express Shipping',
          amount: express,
          estimatedDeliveryDays: { min: 1, max: 3 },
          isFree: false,
        },
      ],
    };
  }

  async listAdminShipments(query: ShipmentQueryDto) {
    const { skip, take, page, limit } = this.getPagination(query);
    const where: any = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.carrier
        ? { carrier: { contains: query.carrier, mode: 'insensitive' } }
        : {}),
      ...(query.trackingNumber
        ? {
            trackingNumber: {
              contains: query.trackingNumber,
              mode: 'insensitive',
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: this.shipmentInclude(),
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return this.paginate(
      items.map((shipment) => this.toShipmentResponse(shipment)),
      total,
      page,
      limit,
    );
  }

  async getAdminShipment(id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: this.shipmentInclude(),
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    return this.toShipmentResponse(shipment);
  }

  async updateShipment(id: string, dto: UpdateShipmentDto, adminId?: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: this.shipmentInclude(),
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const updatedShipment = await this.prisma.$transaction(
      async (transaction) => {
        const tx: any = transaction;
        const updated = await tx.shipment.update({
          where: { id },
          data: {
            ...(dto.carrier !== undefined ? { carrier: dto.carrier } : {}),
            ...(dto.trackingNumber !== undefined
              ? { trackingNumber: dto.trackingNumber }
              : {}),
            ...(dto.shippingMethod !== undefined
              ? { shippingMethod: dto.shippingMethod }
              : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.shippedAt !== undefined
              ? { shippedAt: new Date(dto.shippedAt) }
              : {}),
            ...(dto.deliveredAt !== undefined
              ? { deliveredAt: new Date(dto.deliveredAt) }
              : {}),
          },
          include: this.shipmentInclude(),
        });

        if (dto.status === ShipmentStatus.SHIPPED) {
          await tx.order.update({
            where: { id: updated.orderId },
            data: { status: OrderStatus.SHIPPED },
          });
        }

        if (dto.status === ShipmentStatus.DELIVERED) {
          await tx.order.update({
            where: { id: updated.orderId },
            data: { status: OrderStatus.DELIVERED },
          });
        }

        await this.audit(tx, adminId, AuditAction.UPDATE, 'Shipment', id, {
          from: shipment.status,
          to: dto.status,
        });

        return updated;
      },
    );

    return this.toShipmentResponse(updatedShipment);
  }

  private shipmentInclude(): any {
    return {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          userId: true,
        },
      },
    };
  }

  private toShipmentResponse(shipment: any) {
    return {
      id: shipment.id,
      orderId: shipment.orderId,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      shippingMethod: shipment.shippingMethod,
      status: shipment.status,
      shippedAt: shipment.shippedAt,
      deliveredAt: shipment.deliveredAt,
      order: shipment.order
        ? {
            id: shipment.order.id,
            orderNumber: shipment.order.orderNumber,
            status: shipment.order.status,
            userId: shipment.order.userId,
          }
        : null,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    };
  }

  private async getSettings(): Promise<ShippingSettings> {
    const version = (await this.redis?.getVersion('settings')) ?? 1;
    const cacheKey = `settings:public:${version}`;
    const cached = await this.redis?.get<Record<string, unknown>>(cacheKey);

    if (cached) {
      return {
        currency: this.readString(cached.currency, 'USD'),
        defaultShippingFee: this.readNumber(cached.default_shipping_fee, 0),
        freeShippingThreshold: this.readNumber(cached.free_shipping_threshold, 0),
      };
    }

    const settings = await this.prisma.setting.findMany({
      where: {
        key: {
          in: ['currency', 'default_shipping_fee', 'free_shipping_threshold'],
        },
      },
    });
    const settingValue = (key: string) =>
      settings.find((setting) => setting.key === key)?.value;

    return {
      currency: this.readString(settingValue('currency'), 'USD'),
      defaultShippingFee: this.readNumber(
        settingValue('default_shipping_fee'),
        0,
      ),
      freeShippingThreshold: this.readNumber(
        settingValue('free_shipping_threshold'),
        0,
      ),
    };
  }

  private readString(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim().length > 0
      ? value
      : fallback;
  }

  private readNumber(value: unknown, fallback: number) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
  }

  private getPagination(query: ShipmentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return {
      page,
      limit,
      skip: (page - 1) * limit,
      take: limit,
    };
  }

  private paginate<T>(items: T[], total: number, page: number, limit: number) {
    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private async audit(
    tx: any,
    adminId: string | undefined,
    action: AuditAction,
    entity: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    if (!adminId) {
      return;
    }

    await tx.auditLog.create({
      data: {
        adminId,
        action,
        entity,
        entityId,
        metadata,
      },
    });
  }

  private money(value: number) {
    return Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
  }
}
