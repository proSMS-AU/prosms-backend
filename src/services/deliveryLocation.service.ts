import { AppError } from "../utils/appError";
import { DATA_NOT_FOUND, httpStatus } from "../constants";
import { DeliveryLocationModel, DeliveryLocation } from "../model/delivery-location.model";
import { LocationModel } from "../model/location.model";
import { ClassModel } from "../model/class.model";
import { generateSequentialId } from "../utils/sequentialIdGenerator";

/**
 * Mirror a DeliveryLocation into the legacy `Location` collection (keyed by the
 * same identifier) so that everything still reading legacy Location — class
 * `classDetails.location`, ASQA venues, certificates, class filtering — stays in
 * sync with the single management surface (Settings → Delivery Locations).
 *
 * This is the SAME upsert the NAT import already performs (nat-import.service →
 * upsertDeliveryLocations), now applied to manual create/update so the two
 * collections can no longer diverge. Legacy Location is retired in a later cycle.
 */
const mirrorToLegacyLocation = async (organizationId: string, loc: DeliveryLocation) => {
  const addressLine = (loc.address || loc.name || loc.city || loc.locationIdentifier).trim();
  await LocationModel.findOneAndUpdate(
    { organizationId, locationId: loc.locationIdentifier },
    {
      $set: {
        addressLine,
        street: loc.address,
        city: loc.city,
        state: loc.state,
        postcode: loc.postcode,
        country: "Australia"
      }
    },
    { upsert: true, new: true }
  );
};

const createDeliveryLocation = async (
  organizationId: string,
  data: { name: string; address?: string; city: string; state: string; postcode: string }
) => {
  const locationIdentifier = await generateSequentialId({
    key: `delivery-location:${organizationId}`,
    prefix: "LOC",
    pad: 6
  });

  const created = await DeliveryLocationModel.create({
    organizationId,
    locationIdentifier,
    name: data.name,
    address: data.address,
    city: data.city,
    state: data.state,
    postcode: data.postcode
  });

  await mirrorToLegacyLocation(organizationId, created);
  return created;
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
  const saved = await loc.save();

  // Propagate the edit to the legacy mirror so class/ASQA/certificate views stay in sync.
  await mirrorToLegacyLocation(organizationId, saved);
  return saved;
};

const softDeleteDeliveryLocation = async (id: string, organizationId: string) => {
  const loc = await DeliveryLocationModel.findOne({ _id: id, organizationId, isDeleted: { $ne: true } });
  if (!loc) throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Delivery location not found");

  // Guard against deleting a location still in use — check BOTH the new reference
  // (deliveryLocationId) and the legacy reference (classDetails.location via the mirror).
  const mirror = await LocationModel.findOne({ organizationId, locationId: loc.locationIdentifier });
  const referencedClass = await ClassModel.findOne({
    $or: [{ deliveryLocationId: loc._id }, ...(mirror ? [{ "classDetails.location": mirror._id }] : [])]
  });
  if (referencedClass) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "DELIVERY_LOCATION_IN_USE",
      `Cannot delete this delivery location — it is referenced by class "${referencedClass.classDetails.classTitle}". Remove the reference first.`
    );
  }

  loc.isDeleted = true;
  loc.isActive = false;
  const saved = await loc.save();

  // Remove the now-unreferenced legacy mirror so it disappears from the legacy pickers too.
  if (mirror) await LocationModel.deleteOne({ _id: mirror._id });
  return saved;
};

export const DeliveryLocationService = {
  createDeliveryLocation,
  listDeliveryLocations,
  updateDeliveryLocation,
  softDeleteDeliveryLocation
};
