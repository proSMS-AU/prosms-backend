import { Request, Response } from "express";
import { SendSuccessResponse } from "../utils";
import { usiService } from "../services/usi.service";
import { ConfigureRTOForUSIInputType, VerifyUSIWithStudentInfoInputType } from "../schemas/usi.schema";

const usiServiceBackendHealthCheckHandler = async (req: Request, res: Response) => {
  const response = await usiService.usiServiceBackendHealthCheck();
  SendSuccessResponse.success({
    res,
    message: response.status === "healthy" ? "USI Service is up and running!" : "USI Service is down",
    data: response.data
  });
};

const requestForSSIDHandler = async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const serviceResponse = await usiService.requestForSSIDByRTO(organizationId);

  SendSuccessResponse.success({
    res,
    message: `SSID request received for organization ID: ${organizationId}. Please wait while we process your request.`,
    data: {
      organizationId,
      ...serviceResponse
    }
  });
};

const getAllSSIDRequestsHandler = async (req: Request, res: Response) => {
  // TODO: check the requested user is a super admin before processing the request
  const serviceResponse = await usiService.getAllSSIDRequests();
  SendSuccessResponse.success({
    res,
    message: "SSID requests fetched successfully!",
    data: serviceResponse
  });
};

const generateSSIDBySuperAdminHandler = async (req: Request, res: Response) => {
  // TODO: check the requested user is a super admin before processing the request
  const { organizationId } = req.params;
  const ssidGenerateServiceResponse = await usiService.generateAndSaveSSIDBySuperAdmin(organizationId);

  SendSuccessResponse.success({
    res,
    message: "SSID generated successfully!",
    data: {
      ...ssidGenerateServiceResponse
    }
  });
};

const getSSIDStatusHandler = async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const usiServiceResponse = await usiService.getSSIDStatus(organizationId);

  SendSuccessResponse.success({
    res,
    message: `SSID status fetched successfully!`,
    data: {
      organizationId,
      ...usiServiceResponse
    }
  });
};

const configureRTOForUSIHandler = async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const data: ConfigureRTOForUSIInputType = req.body;
  await usiService.configureRTOForUSI(organizationId, data);
  SendSuccessResponse.created({
    res,
    message: "RTO configured for USI successfully!",
    data: null
  });
};

const getUSIConfigHandler = async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const serviceResponse = await usiService.getUSIConfig(organizationId);
  SendSuccessResponse.success({
    res,
    message: "USI configuration fetched successfully!",
    data: {
      configuration: serviceResponse
    }
  });
};

const getUSIConfigurationStatusHandler = async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const serviceResponse = await usiService.getUSIConfigurationStatus(organizationId);
  SendSuccessResponse.success({
    res,
    message: "USI configuration status fetched successfully!",
    data: {
      status: serviceResponse.status
    }
  });
};

const verifyUSIWithStudentInfoHandler = async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const data: VerifyUSIWithStudentInfoInputType = req.body;
  const serviceResponse = await usiService.verifyUSIWithStudentInfo(organizationId, data);
  SendSuccessResponse.success({
    res,
    message: "USI verified successfully with student info!",
    data: serviceResponse
  });
};

const verifyUSIWithStudentIdHandler = async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { usi, studentId } = req.body;
  const serviceResponse = await usiService.verifyUSIWithStudentId(organizationId, usi, studentId);
  SendSuccessResponse.success({
    res,
    message: "USI verified successfully with student ID!",
    data: serviceResponse
  });
};

const getUSIVerificationsStatsHandler = async (req: Request, res: Response) => {
  SendSuccessResponse.success({
    res,
    message: "USI verifications stats fetched successfully!",
    data: {
      totalVerifications: 100,
      monthlyVerifications: [
        { month: "January", year: 2024, count: 10 },
        { month: "February", year: 2024, count: 20 },
        { month: "March", year: 2024, count: 30 },
        { month: "April", year: 2024, count: 40 }
      ]
    }
  });
};

export const usiControllers = {
  usiServiceBackendHealthCheckHandler,
  requestForSSIDHandler,
  getAllSSIDRequestsHandler,
  generateSSIDBySuperAdminHandler,
  getSSIDStatusHandler,
  configureRTOForUSIHandler,
  getUSIConfigHandler,
  getUSIConfigurationStatusHandler,
  verifyUSIWithStudentInfoHandler,
  verifyUSIWithStudentIdHandler,
  getUSIVerificationsStatsHandler
};
