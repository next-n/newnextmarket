import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedAdmin } from '../types/auth.types';

type AdminRequest = Request & {
  admin?: AuthenticatedAdmin;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length && !requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AdminRequest>();
    const admin = request.admin;

    if (!admin) {
      throw new ForbiddenException('Admin context is required');
    }

    const hasRole =
      !requiredRoles?.length ||
      requiredRoles.some((role) => admin.roles.includes(role));
    const hasPermission =
      !requiredPermissions?.length ||
      requiredPermissions.every((permission) =>
        admin.permissions.includes(permission),
      );

    if (!hasRole || !hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
