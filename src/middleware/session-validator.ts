/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// import { fromNodeHeaders } from "better-auth/node";
// import { NextFunction, Request, Response } from "express";
// import { auth, SendErrorResponse } from "../utils";

// type ROLE = "SUPER_ADMIN" | "ADMIN";

// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// const setRequestUser = (req: Request, session: any) => {
//   req.user = {
//     _id: session.user.id,
//     name: session.user.name,
//     email: session.user.email,
//     password: "",
//     // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//     // @ts-ignore
//     role: session.user.role,
//     organizationId: session.user.organizationId
//   };
// };

// const createErrorContext = (req: Request, code: string, message: string) => ({
//   clientError: { code, message },
//   endpoint: req.originalUrl,
//   method: req.method
// });

// export const sessionValidator =
//   (...roles: ROLE[]) =>
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const headers = fromNodeHeaders(req.headers);
//       const session = await auth.api.getSession({ headers });

//       if (!session) {
//         return SendErrorResponse.unauthorized({
//           res,
//           message: "Unauthorized",
//           data: createErrorContext(req, "SESSION_NOT_FOUND", "No active session found")
//         });
//       }

//       // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//       // @ts-ignore
//       const userRole = session.user.role;

//       // Check if user has required role
//       if (roles.length > 0 && !roles.includes(userRole)) {
//         return SendErrorResponse.forbidden({
//           res,
//           message: "Forbidden",
//           data: createErrorContext(req, "INSUFFICIENT_PERMISSIONS", `Required role: ${roles.join(" or ")}`)
//         });
//       }

//       // Organization validation for non-super-admins
//       // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//       // @ts-ignore
//       if (userRole !== "SUPER_ADMIN" && !session.user.organizationId) {
//         return SendErrorResponse.unauthorized({
//           res,
//           message: "Unauthorized",
//           data: createErrorContext(req, "ORGANIZATION_REQUIRED", "Organization ID is required")
//         });
//       }

//       setRequestUser(req, session);
//       next();
//     } catch (error) {
//       return SendErrorResponse.internalServer({
//         res,
//         message: "Internal Server Error",
//         data: createErrorContext(
//           req,
//           "SESSION_VALIDATION_FAILED",
//           error instanceof Error ? error.message : "Unknown error during session validation"
//         )
//       });
//     }
//   };

import { fromNodeHeaders } from "better-auth/node";
import { NextFunction, Request, Response } from "express";
import { auth, SendErrorResponse } from "../utils";
import { AuthModel } from "../model/auth.model";

type ROLE = "SUPER_ADMIN" | "ADMIN";

const setRequestUser = async (req: Request, session: any) => {
  const email = session.user.email as string;

  // Resolve to the AuthModel ObjectId so controllers/services can use findById
  const authDoc = await AuthModel.findOneAndUpdate(
    { email },
    {
      $setOnInsert: {
        name: (session.user.name as string) || email,
        email,
        // @ts-ignore
        organizationId: (session.user.organizationId as string) || "unassigned",
      },
    },
    { upsert: true, new: true }
  );

  req.user = {
    _id: authDoc._id.toString(),
    name: session.user.name,
    email,
    password: "",
    // @ts-ignore
    role: session.user.role,
    organizationId: authDoc.organizationId
  };
};

const createErrorContext = (req: Request, code: string, message: string) => ({
  clientError: { code, message },
  endpoint: req.originalUrl,
  method: req.method
});

export const sessionValidator =
  (...roles: ROLE[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const headers = fromNodeHeaders(req.headers);
      const session = await auth.api.getSession({ headers });

      if (!session) {
        return SendErrorResponse.unauthorized({
          res,
          message: "Unauthorized",
          data: createErrorContext(req, "SESSION_NOT_FOUND", "No active session found")
        });
      }

      // @ts-ignore
      const userRole = session.user.role;

      if (roles.length > 0 && !roles.includes(userRole)) {
        return SendErrorResponse.forbidden({
          res,
          message: "Forbidden",
          data: createErrorContext(req, "INSUFFICIENT_PERMISSIONS", `Required role: ${roles.join(" or ")}`)
        });
      }

      // @ts-ignore
      if (userRole !== "SUPER_ADMIN" && !session.user.organizationId) {
        return SendErrorResponse.unauthorized({
          res,
          message: "Unauthorized",
          data: createErrorContext(req, "ORGANIZATION_REQUIRED", "Organization ID is required")
        });
      }

      await setRequestUser(req, session);
      next();
    } catch (error) {
      return SendErrorResponse.internalServer({
        res,
        message: "Internal Server Error",
        data: createErrorContext(
          req,
          "SESSION_VALIDATION_FAILED",
          error instanceof Error ? error.message : "Unknown error during session validation"
        )
      });
    }
  };
