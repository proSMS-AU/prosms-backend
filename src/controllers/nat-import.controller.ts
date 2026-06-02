import { Request, Response } from "express";
import { SendSuccessResponse } from "../utils";
import { AppError } from "../utils/appError";
import { httpStatus } from "../constants";
import { importFromNatZip } from "../services/nat-import.service";

const importNatHandler = async (req: Request, res: Response) => {
  const organizationId = req.params.orgId ?? (req.user?.organizationId as string);
  if (!organizationId) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Organization ID is required");
  }

  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const zipFile = files?.zip?.[0];
  if (!zipFile) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "ZIP file is required");
  }

  const result = await importFromNatZip(organizationId, zipFile.buffer);

  SendSuccessResponse.created({
    res,
    message: `NAT import complete: ${result.students.created} students, ${result.classes.created} classes created`,
    data: result,
  });
};

export const NatImportController = { importNatHandler };
