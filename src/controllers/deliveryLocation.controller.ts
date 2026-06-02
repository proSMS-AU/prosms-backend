import { Request, Response } from "express";
import { SendSuccessResponse } from "../utils";
import { DeliveryLocationService } from "../services/deliveryLocation.service";

const createHandler = async (req: Request, res: Response) => {
  const data = await DeliveryLocationService.createDeliveryLocation(
    req.user?.organizationId as string,
    req.body
  );
  SendSuccessResponse.created({ res, message: "Delivery location created", data });
};

const listHandler = async (req: Request, res: Response) => {
  const data = await DeliveryLocationService.listDeliveryLocations(req.user?.organizationId as string);
  SendSuccessResponse.success({ res, message: "Delivery locations retrieved", data });
};

const updateHandler = async (req: Request, res: Response) => {
  const data = await DeliveryLocationService.updateDeliveryLocation(
    req.params.id,
    req.user?.organizationId as string,
    req.body
  );
  SendSuccessResponse.success({ res, message: "Delivery location updated", data });
};

const deleteHandler = async (req: Request, res: Response) => {
  await DeliveryLocationService.softDeleteDeliveryLocation(
    req.params.id,
    req.user?.organizationId as string
  );
  SendSuccessResponse.deleted({ res, message: "Delivery location deleted", data: null });
};

export const DeliveryLocationController = { createHandler, listHandler, updateHandler, deleteHandler };
