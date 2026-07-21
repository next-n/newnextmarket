import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminStatus } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedAdmin, JwtAdminPayload } from '../types/auth.types';

type AdminRequest = Request & {
  admin?: AuthenticatedAdmin;
};

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Admin authentication token is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtAdminPayload>(
        token,
        {
          secret: this.configService.get<string>('jwt.secret'),
        },
      );

      if (payload.type !== 'admin' || payload.tokenUse === 'refresh') {
        throw new UnauthorizedException('Invalid admin authentication token');
      }

      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          status: true,
          deletedAt: true,
        },
      });

      if (
        !admin ||
        admin.status !== AdminStatus.ACTIVE ||
        admin.deletedAt !== null
      ) {
        throw new UnauthorizedException('Invalid admin authentication token');
      }

      request.admin = {
        id: admin.id,
        email: admin.email,
        type: 'admin',
        roles: payload.roles ?? [],
        permissions: payload.permissions ?? [],
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid admin authentication token');
    }
  }

  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    return type === 'Bearer' ? token : undefined;
  }
}
