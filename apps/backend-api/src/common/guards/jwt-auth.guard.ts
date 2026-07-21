import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuthenticatedCustomer,
  JwtCustomerPayload,
} from '../types/auth.types';

type CustomerRequest = Request & {
  user?: AuthenticatedCustomer;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CustomerRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtCustomerPayload>(
        token,
        {
          secret: this.configService.get<string>('jwt.secret'),
        },
      );

      if (payload.type !== 'customer' || payload.tokenUse === 'refresh') {
        throw new UnauthorizedException('Invalid authentication token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          status: true,
          deletedAt: true,
        },
      });

      if (
        !user ||
        user.status !== UserStatus.ACTIVE ||
        user.deletedAt !== null
      ) {
        throw new UnauthorizedException('Invalid authentication token');
      }

      request.user = {
        id: user.id,
        email: user.email,
        type: 'customer',
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    return type === 'Bearer' ? token : undefined;
  }
}
