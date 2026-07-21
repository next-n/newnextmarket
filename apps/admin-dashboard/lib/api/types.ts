export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  errors: unknown[];
};

export type PaginatedResponse<T> = {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AdminProfile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  roles: string[];
  permissions: string[];
};

export type AdminAuthResponse = {
  accessToken: string;
  refreshToken: string;
  admin: AdminProfile;
};

export type AdminOverview = {
  totalRevenue: number;
  collectedRevenue: number;
  salesValue: number;
  pendingCod: number;
  totalOrders: number;
  totalCustomers: number;
  pendingOrders: number;
  lowStockProducts: number;
};
