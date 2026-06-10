import { DATA_NOT_FOUND, httpStatus } from "../constants";
import { OrganizationModel } from "../model/organization.model";
import { AppError } from "../utils/appError";
import { QueryBuilder } from "../utils/queryBuilder";

const getAllOrganizations = async (query: Record<string, string>) => {
  // Soft-deleted organizations must never appear in the super-admin list.
  const queryBuilder = new QueryBuilder(OrganizationModel.find({ isDeleted: { $ne: true } }), query);
  const searchableFields = [
    "name",
    "rtoId",
    "phone.number",
    "address.city",
    "address.state",
    "address.postCode",
    "address.country",
    "address.street",
    "address.building",
    "address.unit"
  ];
  const organizations = await queryBuilder.search(searchableFields).filter().sort().select().pagination().build();

  const meta = await queryBuilder.getMeta();
  return {
    organizations,
    ...meta
  };
};

const getLoggedInOrganization = async (organizationId: string) => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  return organization;
};

const getOrganizationById = async (id: string) => {
  const organization = await OrganizationModel.findById(id);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  return organization;
};

const getOrganizationStats = async () => {
  // Exclude soft-deleted orgs from every count.
  const notDeleted = { isDeleted: { $ne: true } };
  const [total, active, inactive, pending, reported] = await Promise.all([
    OrganizationModel.countDocuments(notDeleted),
    OrganizationModel.countDocuments({ ...notDeleted, status: "active" }),
    OrganizationModel.countDocuments({ ...notDeleted, status: "inactive" }),
    OrganizationModel.countDocuments({ ...notDeleted, status: "pending" }),
    OrganizationModel.countDocuments({ ...notDeleted, status: "reported" })
  ]);

  return { total, active, inactive, pending, reported };
};

const softDeleteOrganization = async (id: string) => {
  const organization = await OrganizationModel.findById(id);
  if (!organization || organization.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }

  organization.isDeleted = true;
  organization.deletedAt = new Date();
  organization.status = "inactive";
  await organization.save();

  return { _id: organization._id };
};

const updateOrganization = async (id: string, data: Record<string, unknown>) => {
  const organization = await OrganizationModel.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true }
  );
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  return organization;
};

export const OrganizationServices = {
  getAllOrganizations,
  getLoggedInOrganization,
  getOrganizationById,
  getOrganizationStats,
  updateOrganization,
  softDeleteOrganization
};
