import { AppError } from "../utils/appError";
import { DATA_NOT_FOUND, httpStatus } from "../constants";
import { DeliveryLocationModel } from "../model/delivery-location.model";
import { ClassModel } from "../model/class.model";
import { generateSequentialId } from "../utils/sequentialIdGenerator";

const createDeliveryLocation = async (
  organizationId: string,
  data: { name: string; address?: string; city: string; state: string; postcode: string }
) => {
  const locationIdentifier = await generateSequentialId({
    key: `delivery-location:${organizationId}`,
    prefix: "LOC",
    pad: 6
  });

  return DeliveryLocationModel.create({
    organizationId,
    locationIdentifier,
    name: data.name,
    address: data.address,
    city: data.city,
    state: data.state,
    postcode: data.postcode
  });
};

const listDeliveryLocations = async (organizationId: string) => {
  return DeliveryLocationModel.find({ organizationId, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
};

const updateDeliveryLocation = async (
  id: string,
  organizationId: string,
  data: Partial<{ name: string; address: string; city: string; state: string; postcode: string; isActive: boolean }>
) => {
  const loc = await DeliveryLocationModel.findOne({ _id: id, organizationId, isDeleted: { $ne: true } });
  if (!loc) throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Delivery location not found");

  Object.assign(loc, data);
  return loc.save();
};

const softDeleteDeliveryLocation = async (id: string, organizationId: string) => {
  const loc = await DeliveryLocationModel.findOne({ _id: id, organizationId, isDeleted: { $ne: true } });
  if (!loc) throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Delivery location not found");

  const referencedClass = await ClassModel.findOne({ deliveryLocationId: loc._id });
  if (referencedClass) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "DELIVERY_LOCATION_IN_USE",
      `Cannot delete this delivery location — it is referenced by class "${referencedClass.classDetails.classTitle}". Remove the reference first.`
    );
  }

  loc.isDeleted = true;
  loc.isActive = false;
  return loc.save();
};

export const DeliveryLocationService = {
  createDeliveryLocation,
  listDeliveryLocations,
  updateDeliveryLocation,
  softDeleteDeliveryLocation
};
