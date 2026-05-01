import { NextFunction, Request, Response } from "express";
import { ZodObject, ZodError } from "zod";
import { httpStatus } from "../constants";

const validateResource =
  (schema: ZodObject) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (e: unknown) {
      if (e instanceof ZodError) {
        const errorMessages = e.issues.map((issue) => issue.message);
        res.status(httpStatus.BAD_REQUEST).send({
          message: errorMessages[0],
          success: false,
          data: { clientError: { code: "wrong_input_data", message: errorMessages[0] } }
        });
        return;
      }
      res.status(httpStatus.BAD_REQUEST).send({
        error: (e as Error).message,
        success: false,
        data: { clientError: { code: "unexpected_error", message: (e as Error).message } }
      });
      return;
    }
  };

export default validateResource;
