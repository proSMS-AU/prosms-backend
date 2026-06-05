/* eslint-disable @typescript-eslint/no-explicit-any */
import { CONFLICT_ERROR, DATA_NOT_FOUND, httpStatus } from "../constants";
import { LocationModel } from "../model/location.model";
import { ClassModel } from "../model/class.model";
import { OrganizationModel } from "../model/organization.model";
import { LocationT } from "../schemas/location.schema";
import { AppError } from "../utils/appError";
import { generateSequentialId } from "../utils/sequentialIdGenerator";

const createLocation = async (organizationId: string, locationData: LocationT) => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  const locationId = await generateSequentialId({
    key: `location:${organizationId}`,
    prefix: "LO"
  });

  // Catch any remaining compound key collision gracefully
  try {
    const location = await LocationModel.create({ organizationId, ...locationData, locationId });
    return location;
  } catch (err: any) {
    if (err?.code === 11000 && err?.keyPattern?.locationId) {
      throw new AppError(httpStatus.CONFLICT, CONFLICT_ERROR.code, "Location ID conflict, please try again");
    }
    throw err;
  }
};

const getAllLocations = async (organizationId: string) => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  const locations = await LocationModel.find({ organizationId });
  return locations;
};

const deleteLocation = async (id: string) => {
  // Guard: deleting a location still referenced by a class left `classDetails.location`
  // dangling (populate → null), which crashed the enrolment/class views. Block it.
  const referencedClass = await ClassModel.findOne({
    $or: [{ "classDetails.location": id }, { "classDetails.additionalLocations": id }]
  });
  if (referencedClass) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "LOCATION_IN_USE",
      `Cannot delete this location — it is referenced by class "${referencedClass.classDetails.classTitle}". Remove the reference first.`
    );
  }

  const location = await LocationModel.findByIdAndDelete(id);
  if (!location) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Location not found");
  }
};

export const LocationService = {
  createLocation,
  getAllLocations,
  deleteLocation
};
