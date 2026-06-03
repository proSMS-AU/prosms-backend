import { AppError } from "../utils/appError";
import { DATA_NOT_FOUND, httpStatus } from "../constants";
import { SpecificFundingIdentifierModel } from "../model/specific-funding-identifier.model";

const createSFI = async (
  organizationId: string,
  data: { identifier: string; description: string; effectiveFrom?: Date; effectiveTo?: Date }
) => {
  return SpecificFundingIdentifierModel.create({ organizationId, ...data });
};

const listSFIs = async (organizationId: string) => {
  return SpecificFundingIdentifierModel.find({ organizationId }).sort({ createdAt: -1 });
};

const updateSFI = async (
  id: string,
  organizationId: string,
  data: Partial<{ identifier: string; description: string; effectiveFrom: Date; effectiveTo: Date; isActive: boolean }>
) => {
  const sfi = await SpecificFundingIdentifierModel.findOne({ _id: id, organizationId });
  if (!sfi) throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Specific Funding Identifier not found");
  Object.assign(sfi, data);
  return sfi.save();
};

const deleteSFI = async (id: string, organizationId: string) => {
  const sfi = await SpecificFundingIdentifierModel.findOne({ _id: id, organizationId });
  if (!sfi) throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Specific Funding Identifier not found");
  await sfi.deleteOne();
  return { deleted: true };
};

export const SpecificFundingIdentifierService = {
  createSFI,
  listSFIs,
  updateSFI,
  deleteSFI
};
