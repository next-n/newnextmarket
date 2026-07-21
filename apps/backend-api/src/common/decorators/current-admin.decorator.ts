import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedAdmin } from '../types/auth.types';

type AdminRequest = Request & {
  admin?: AuthenticatedAdmin;
};

export const CurrentAdmin = createParamDecorator(
  (data: keyof AuthenticatedAdmin | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AdminRequest>();
    const admin = request.admin;

    return data && admin ? admin[data] : admin;
  },
);
