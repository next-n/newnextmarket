export type ApiSuccessResponse<T = unknown> = {
  success: true;
  message: string;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  errors: unknown[];
};

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
