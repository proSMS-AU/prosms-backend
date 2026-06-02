import { Request, Response } from "express";
import { SendSuccessResponse } from "../utils";
import { SpecificFundingIdentifierService } from "../services/specificFundingIdentifier.service";

const listHandler = async (req: Request, res: Response) => {
  const data = await SpecificFundingIdentifierService.listSFIs(req.user!.organizationId as string);
  SendSuccessResponse.success({ res, message: "SFIs retrieved", data });
};

const createHandler = async (req: Request, res: Response) => {
  const data = await SpecificFundingIdentifierService.createSFI(req.user!.organizationId as string, req.body);
  SendSuccessResponse.created({ res, message: "SFI created", data });
};

const updateHandler = async (req: Request, res: Response) => {
  const data = await SpecificFundingIdentifierService.updateSFI(req.params.id, req.user!.organizationId as string, req.body);
  SendSuccessResponse.updated({ res, message: "SFI updated", data });
};

const deleteHandler = async (req: Request, res: Response) => {
  const data = await SpecificFundingIdentifierService.deleteSFI(req.params.id, req.user!.organizationId as string);
  SendSuccessResponse.deleted({ res, message: "SFI deleted", data });
};

export const SpecificFundingIdentifierControllers = {
  listHandler,
  createHandler,
  updateHandler,
  deleteHandler,
};
