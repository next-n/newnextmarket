import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AdminStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminAuthResponse,
  AdminProfile,
  AuthTokens,
  CustomerAuthResponse,
  CustomerProfile,
  JwtAdminPayload,
  JwtCustomerPayload,
} from '../common/types/auth.types';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';

const PASSWORD_SALT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRES_IN: JwtSignOptions['expiresIn'] = '30d';

type AdminRoleRecord = {
  role: {
    name: string;
    permissions: {
      permission: {
        key: string;
      };
    }[];
  };
};

type AdminWithRoles = {
  id: string;
  email: string;
  password: string;
  firstName: string | null;
  lastName: string | null;
  status: AdminStatus;
  createdAt: Date;
  updatedAt: Date;
  roles: AdminRoleRecord[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async registerCustomer(dto: RegisterDto): Promise<CustomerAuthResponse> {
    const email = this.normalizeEmail(dto.email);
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const password = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email,
        password,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        status: UserStatus.ACTIVE,
      },
      select: this.customerProfileSelect(),
    });

    const tokens = await this.generateCustomerTokens({
      sub: user.id,
      email: user.email,
      type: 'customer',
    });

    await this.storeCustomerRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: this.toCustomerProfile(user),
    };
  }

  async loginCustomer(dto: LoginDto): Promise<CustomerAuthResponse> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        ...this.customerProfileSelect(),
        password: true,
        deletedAt: true,
      },
    });

    if (!user?.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE || user.deletedAt !== null) {
      throw new UnauthorizedException('Customer account is not active');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateCustomerTokens({
      sub: user.id,
      email: user.email,
      type: 'customer',
    });

    await this.storeCustomerRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: this.toCustomerProfile(user),
    };
  }

  async logoutCustomer(customerId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: customerId },
      data: { refreshTokenHash: null },
    });
  }

  async refreshCustomerToken(
    dto: RefreshTokenDto,
  ): Promise<CustomerAuthResponse> {
    let payload: JwtCustomerPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtCustomerPayload>(
        dto.refreshToken,
        { secret: this.getJwtSecret() },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'customer' || payload.tokenUse !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        ...this.customerProfileSelect(),
        refreshTokenHash: true,
        deletedAt: true,
      },
    });

    if (
      !user?.refreshTokenHash ||
      user.status !== UserStatus.ACTIVE ||
      user.deletedAt !== null
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatches = await bcrypt.compare(
      dto.refreshToken,
      user.refreshTokenHash,
    );

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateCustomerTokens({
      sub: user.id,
      email: user.email,
      type: 'customer',
    });

    await this.storeCustomerRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: this.toCustomerProfile(user),
    };
  }

  async forgotPassword(_dto: ForgotPasswordDto): Promise<void> {
    // MVP placeholder: later this should create a one-time reset token and send email.
  }

  async resetPassword(_dto: ResetPasswordDto): Promise<void> {
    // MVP placeholder: later this should verify the reset token and update password.
  }

  async getCustomerProfile(customerId: string): Promise<CustomerProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: this.customerProfileSelect(),
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('Customer profile not found');
    }

    return this.toCustomerProfile(user);
  }

  async updateCustomerProfile(customerId: string, dto: UpdateCustomerProfileDto): Promise<CustomerProfile> {
    const user = await this.prisma.user.update({
      where: { id: customerId },
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim() || null,
      },
      select: this.customerProfileSelect(),
    });

    return this.toCustomerProfile(user);
  }

  async loginAdmin(dto: LoginDto): Promise<AdminAuthResponse> {
    const email = this.normalizeEmail(dto.email);
    const admin = await this.findAdminWithRolesByEmail(email);

    if (!admin) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Admin account is not active');
    }

    const passwordMatches = await bcrypt.compare(dto.password, admin.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const roles = this.extractAdminRoles(admin.roles);
    const permissions = this.extractAdminPermissions(admin.roles);
    const tokens = await this.generateAdminTokens({
      sub: admin.id,
      email: admin.email,
      type: 'admin',
      roles,
      permissions,
    });

    await this.storeAdminRefreshToken(admin.id, tokens.refreshToken);

    return {
      ...tokens,
      admin: this.toAdminProfile(admin, roles, permissions),
    };
  }

  async logoutAdmin(adminId: string): Promise<void> {
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { refreshTokenHash: null },
    });
  }

  async getAdminProfile(adminId: string): Promise<AdminProfile> {
    const admin = await this.findAdminWithRolesById(adminId);

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new NotFoundException('Admin profile not found');
    }

    return this.toAdminProfile(
      admin,
      this.extractAdminRoles(admin.roles),
      this.extractAdminPermissions(admin.roles),
    );
  }

  private async generateCustomerTokens(
    payload: Omit<JwtCustomerPayload, 'iat' | 'exp'>,
  ): Promise<AuthTokens> {
    const accessPayload: JwtCustomerPayload = {
      sub: payload.sub,
      email: payload.email,
      type: 'customer',
    };
    const refreshPayload: JwtCustomerPayload = {
      ...accessPayload,
      tokenUse: 'refresh',
      jti: randomUUID(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.getJwtSecret(),
        expiresIn: this.getJwtExpiresIn(),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.getJwtSecret(),
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async generateAdminTokens(
    payload: Omit<JwtAdminPayload, 'iat' | 'exp'>,
  ): Promise<AuthTokens> {
    const accessPayload: JwtAdminPayload = {
      sub: payload.sub,
      email: payload.email,
      type: 'admin',
      roles: payload.roles,
      permissions: payload.permissions,
    };
    const refreshPayload: JwtAdminPayload = {
      ...accessPayload,
      tokenUse: 'refresh',
      jti: randomUUID(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.getJwtSecret(),
        expiresIn: this.getJwtExpiresIn(),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.getJwtSecret(),
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeCustomerRefreshToken(
    customerId: string,
    refreshToken: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: customerId },
      data: {
        refreshTokenHash: await bcrypt.hash(refreshToken, PASSWORD_SALT_ROUNDS),
      },
    });
  }

  private async storeAdminRefreshToken(
    adminId: string,
    refreshToken: string,
  ): Promise<void> {
    await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        refreshTokenHash: await bcrypt.hash(refreshToken, PASSWORD_SALT_ROUNDS),
      },
    });
  }

  private async findAdminWithRolesByEmail(
    email: string,
  ): Promise<AdminWithRoles | null> {
    return this.prisma.admin.findUnique({
      where: { email },
      select: this.adminWithRolesSelect(),
    });
  }

  private async findAdminWithRolesById(
    id: string,
  ): Promise<AdminWithRoles | null> {
    return this.prisma.admin.findUnique({
      where: { id },
      select: this.adminWithRolesSelect(),
    });
  }

  private customerProfileSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  private adminWithRolesSelect() {
    return {
      id: true,
      email: true,
      password: true,
      firstName: true,
      lastName: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    };
  }

  private toCustomerProfile(user: CustomerProfile): CustomerProfile {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toAdminProfile(
    admin: Omit<AdminWithRoles, 'password'>,
    roles: string[],
    permissions: string[],
  ): AdminProfile {
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      status: admin.status,
      roles,
      permissions,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }

  private extractAdminRoles(adminRoles: AdminRoleRecord[]): string[] {
    return adminRoles.map((adminRole) => adminRole.role.name);
  }

  private extractAdminPermissions(adminRoles: AdminRoleRecord[]): string[] {
    const permissions = adminRoles.flatMap((adminRole) =>
      adminRole.role.permissions.map(
        (rolePermission) => rolePermission.permission.key,
      ),
    );

    return [...new Set(permissions)];
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getJwtSecret(): string {
    return this.configService.get<string>('jwt.secret') ?? 'change-me';
  }

  private getJwtExpiresIn(): JwtSignOptions['expiresIn'] {
    return (this.configService.get<string>('jwt.expiresIn') ??
      '1d') as JwtSignOptions['expiresIn'];
  }
}
