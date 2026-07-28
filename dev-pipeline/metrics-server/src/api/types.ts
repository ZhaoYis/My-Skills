import type { NextFunction, Request, Response } from 'express';

export interface UserPrincipal {
  kind: 'user';
  developerId: number;
  email: string;
  teamId: number | null;
  isAdmin: boolean;
  tokenVersion?: number;
  impersonated?: boolean;
}

export interface ServicePrincipal {
  kind: 'service';
  service: 'api-key';
  keyId: string;
  purposes: Array<'session-exchange' | 'management'>;
  isAdmin: true;
}

export type AuthPrincipal = UserPrincipal | ServicePrincipal;
export type AuthUser = UserPrincipal;
export type AuthedRequest = Request & { user: AuthPrincipal };
export type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;
