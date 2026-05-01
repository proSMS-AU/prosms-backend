/* eslint-disable @typescript-eslint/no-namespace */

import { JwtPayload } from "jsonwebtoken";

export interface UserPayload {
  _id: string;
  name: string;
  email: string;
  password: string;
  organizationId: string;
}

export interface CustomJwtPayload extends JwtPayload {
  userId: string;
  name: string;
  email: string;
}

// Express Request type extension for req.user
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}
