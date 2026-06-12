import { DATA_NOT_FOUND, httpStatus } from "../constants";
import { AuthModel } from "../model/auth.model";
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

  const ts = Date.now();

  // Tombstone unique-index fields so the same RTO can re-register.
  // Originals are kept in dedicated fields for display/audit/restore.
  organization.originalEmail = organization.email;
  organization.originalRtoId = organization.rtoId;
  organization.originalABN = organization.ABN;

  organization.email = `${organization.email}.deleted.${ts}`;
  organization.rtoId = `${organization.rtoId}.deleted.${ts}`;
  organization.ABN = `${organization.ABN}.deleted.${ts}`;

  organization.isDeleted = true;
  organization.deletedAt = new Date();
  organization.status = "inactive";
  await organization.save();

  // Lock out every user belonging to this org — no login, no API access.
  await AuthModel.updateMany({ organizationId: String(organization._id) }, { $set: { isDeleted: true } });

  return { _id: organization._id };
};

// Return just enough info to render the /account-disabled screen.
// Throws 403 ORG_DISABLED if the org is still active (so the page can redirect active users away).
const getDisabledOrgInfo = async (organizationId: string) => {
  const org = await OrganizationModel.findById(organizationId).select("name originalEmail email logoUrl isDeleted");
  if (!org) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  if (!org.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "ORG_ACTIVE", "Organisation is active");
  }
  return {
    name: org.name,
    email: org.originalEmail ?? org.email,
    logoUrl: org.logoUrl
  };
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
  softDeleteOrganization,
  getDisabledOrgInfo
};
