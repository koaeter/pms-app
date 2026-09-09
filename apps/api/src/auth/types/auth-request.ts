import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  employeeId: string;
  username: string;
  accountStatus: string;
  employee: {
    id: string;
    organizationId: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
  };
  roles: Array<{
    id: string;
    code: string;
    name: string;
    organizationId: string | null;
    organizationalUnitId: string | null;
    permissions: Array<{ code: string; scope: string }>;
  }>;
}

export type AuthRequest = Request & { user: AuthenticatedUser; sessionId: string };
