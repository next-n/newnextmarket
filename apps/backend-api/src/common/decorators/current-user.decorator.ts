import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedCustomer } from '../types/auth.types';

type CustomerRequest = Request & {
  user?: AuthenticatedCustomer;
};

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedCustomer | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<CustomerRequest>();
    const user = request.user;

    return data && user ? user[data] : user;
  },
);
