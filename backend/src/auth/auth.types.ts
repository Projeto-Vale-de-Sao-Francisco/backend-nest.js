export interface AuthenticatedPrincipal {
  id: number;
}

export interface AuthenticatedRequest {
  user?: AuthenticatedPrincipal;
}

export interface PaginationInput {
  page?: string | number;
  limit?: string | number;
}

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
