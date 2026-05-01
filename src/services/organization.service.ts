import { DATA_NOT_FOUND, httpStatus } from "../constants";
import { OrganizationModel } from "../model/organization.model";
import { AppError } from "../utils/appError";
import { QueryBuilder } from "../utils/queryBuilder";

const getAllOrganizations = async (query: Record<string, string>) => {
  const queryBuilder = new QueryBuilder(OrganizationModel.find(), query);
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

export const OrganizationServices = {
  getAllOrganizations,
  getLoggedInOrganization,
  getOrganizationById
};
