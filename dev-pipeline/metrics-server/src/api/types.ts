import type { NextFunction, Request, Response } from 'express';

export interface AuthUser {
  developerId: number;
  email: string;
  teamId: number | null;
  isAdmin: boolean;
}

export type AuthedRequest = Request & { user: AuthUser };
export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;
