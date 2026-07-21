import { AdminStatus, UserStatus } from '@prisma/client';

export type AuthEntityType = 'customer' | 'admin';

export type JwtCustomerPayload = {
  sub: string;
  email: string;
  type: 'customer';
  tokenUse?: 'access' | 'refresh';
  jti?: string;
  iat?: number;
  exp?: number;
};

export type JwtAdminPayload = {
  sub: string;
  email: string;
  type: 'admin';
  roles: string[];
  permissions: string[];
  tokenUse?: 'access' | 'refresh';
  jti?: string;
  iat?: number;
  exp?: number;
};

export type AuthenticatedCustomer = {
  id: string;
  email: string;
  type: 'customer';
};

export type AuthenticatedAdmin = {
  id: string;
  email: string;
  type: 'admin';
  roles: string[];
  permissions: string[];
};

export type CustomerProfile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminProfile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: AdminStatus;
  roles: string[];
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type CustomerAuthResponse = AuthTokens & {
  user: CustomerProfile;
};

export type AdminAuthResponse = AuthTokens & {
  admin: AdminProfile;
};
