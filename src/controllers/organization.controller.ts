import { OrganizationServices } from "../services/organization.service";
import { SendSuccessResponse } from "../utils";
import { Request, Response } from "express";

const getAllOrganizationsHandler = async (req: Request, res: Response) => {
  const { organizations, total, page, limit, totalPages } = await OrganizationServices.getAllOrganizations(
    req.query as Record<string, string>
  );
  SendSuccessResponse.success({
    res,
    message: "All organizations retrieved successfully!",
    data: organizations,
    meta: {
      total,
      page,
      limit,
      totalPages
    }
  });
};

const getOrganizationHandler = async (req: Request, res: Response) => {
  const organization = await OrganizationServices.getLoggedInOrganization(req.user?.organizationId as string);
  SendSuccessResponse.success({
    res,
    message: "Logged in organization details retrieved successfully!",
    data: organization
  });
};

const getOrganizationByIdHandler = async (req: Request, res: Response) => {
  const organization = await OrganizationServices.getOrganizationById(req.params.id);
  SendSuccessResponse.success({
    res,
    message: "Organization details retrieved successfully!",
    data: organization
  });
};

const getOrganizationStatsHandler = async (req: Request, res: Response) => {
  const stats = await OrganizationServices.getOrganizationStats();
  SendSuccessResponse.success({
    res,
    message: "Organization stats retrieved successfully!",
    data: stats
  });
};

const updateOrganizationHandler = async (req: Request, res: Response) => {
  const organization = await OrganizationServices.updateOrganization(req.params.id, req.body);
  SendSuccessResponse.success({
    res,
    message: "Organization updated successfully!",
    data: organization
  });
};

const deleteOrganizationHandler = async (req: Request, res: Response) => {
  const result = await OrganizationServices.softDeleteOrganization(req.params.id);
  SendSuccessResponse.success({
    res,
    message: "Organization deleted successfully!",
    data: result
  });
};

// Whitelisted for deleted-org tokens — used by the /account-disabled screen.
const getDisabledOrgInfoHandler = async (req: Request, res: Response) => {
  const info = await OrganizationServices.getDisabledOrgInfo(req.user?.organizationId as string);
  SendSuccessResponse.success({
    res,
    message: "Organization info retrieved",
    data: info
  });
};

export const organizationControllers = {
  getAllOrganizationsHandler,
  getOrganizationHandler,
  getOrganizationByIdHandler,
  getOrganizationStatsHandler,
  updateOrganizationHandler,
  deleteOrganizationHandler,
  getDisabledOrgInfoHandler
};
