import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    email?: string;
    name?: string;
    organizationId?: string;
    accessToken?: string;
    refreshToken?: string;
    isAuthenticated?: boolean;
  }
}

declare module "express" {
  interface Request {
    user?: {
      _id: string;
      name: string;
      email: string;
      password: string;
      organizationId: string;
    };
  }
}
