import { Request, Response } from "express";
import { LocationService } from "../services/location.service";
import { SendSuccessResponse } from "../utils";

const createLocationHandler = async (req: Request, res: Response) => {
  const createLocation = await LocationService.createLocation(req.user?.organizationId as string, req.body);
  SendSuccessResponse.created({
    res,
    message: "Location Created Successfully!",
    data: createLocation
  });
};

const getAllLocationsHandler = async (req: Request, res: Response) => {
  const locations = await LocationService.getAllLocations(req.user?.organizationId as string);
  SendSuccessResponse.success({
    res,
    message: "All Locations retrieved Successfully!",
    data: locations
  });
};

const deleteLocationHandler = async (req: Request, res: Response) => {
  await LocationService.deleteLocation(req.params.id);
  SendSuccessResponse.deleted({
    res,
    message: "Location deleted Successfully!",
    data: null
  });
};

export const LocationController = { createLocationHandler, getAllLocationsHandler, deleteLocationHandler };
