import axios from "axios";
import config from "config";
import { AppError } from "../utils/appError";
import { BAD_REQUEST, DATA_NOT_FOUND, httpStatus, UNEXPECTED_ERROR } from "../constants";
import { OrganizationModel } from "../model/organization.model";
import { SSIDRequestModel } from "../model/ssid-request.model";
import { StudentModel } from "../model/student.model";

interface USIEnvConfig {
  apiBaseURL: string;
}

const usiServiceBackendHealthCheck = async () => {
  const envConfig = config.get<USIEnvConfig>("usi");
  const response = await axios.get(`${envConfig.apiBaseURL}/usi/health`);

  if (response.status !== 200) {
    return {
      status: "unhealthy",
      data: response.data ? response.data : { status: "unhealthy" }
    };
  }
  return {
    status: "healthy",
    data: response.data
  };
};

const requestForSSIDByRTO = async (organizationId: string) => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  if (!organization.ABN) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      UNEXPECTED_ERROR.code,
      "Organization ABN is missing in database. Please update the organization details with a valid ABN and try again."
    );
  }

  const request = await SSIDRequestModel.create({
    organizationId: organization._id.toString(),
    rtoId: organization.rtoId,
    organizationName: organization.name,
    ABN: organization.ABN || null,
    requestDate: new Date(),
    status: "pending"
  });

  return {
    success: true,
    status: request.status
  };
};

const getAllSSIDRequests = async () => {
  const requests = await SSIDRequestModel.find().sort({ requestDate: -1 });
  return requests.map((request) => ({
    id: request._id.toString(),
    organizationId: request.organizationId,
    rtoId: request.rtoId,
    organizationName: request.organizationName,
    ABN: request.ABN,
    requestDate: request.requestDate,
    status: request.status
  }));
};

const generateAndSaveSSIDBySuperAdmin = async (
  organizationId: string
): Promise<{
  success: boolean;
  ssid: string;
  timestamp: number;
}> => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  if (!organization.ABN) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      UNEXPECTED_ERROR.code,
      "Organization ABN is missing in database. Please update the organization details with a valid ABN and try again."
    );
  }
  const usiConfiguration = organization.usiConfig;

  if (usiConfiguration && usiConfiguration.ssidInfo) {
    return {
      success: true,
      ssid: usiConfiguration.ssidInfo.ssid,
      timestamp: usiConfiguration.ssidInfo.timestamp
    };
  }

  const envConfig = config.get<USIEnvConfig>("usi");
  const response = await axios.get(`${envConfig.apiBaseURL}/usi/generate-ssid`);

  if (response.status !== 200) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      UNEXPECTED_ERROR.code,
      "Failed to generate SSID for RTO. Please try again later."
    );
  }
  if (!response.data || !response.data.ssid || !response.data.success) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      UNEXPECTED_ERROR.code,
      "Failed to generate SSID for RTO. Please try again later."
    );
  }

  if (usiConfiguration) {
    usiConfiguration.ssidInfo = {
      ssid: response.data.ssid,
      timestamp: Date.now()
    };
    organization.usiConfig = usiConfiguration;
  } else {
    organization.usiConfig = {
      ABN: organization.ABN,
      orgCode: organization.rtoId,
      ssidInfo: {
        ssid: response.data.ssid,
        timestamp: Date.now()
      },
      ramRelationshipStatus: "pending",
      ramAuthorizationDate: undefined,
      ramExpiryDate: undefined,
      totalUSIVerifications: 0,
      monthlyUSIVerifications: [],
      configurationDate: undefined,
      configurationStatus: "configuration_pending",
      configurationExpiryDate: undefined,
      lastVerificationDate: undefined,
      lastVerificationStatus: undefined
    };
  }
  organization.markModified("usiConfig");
  await organization.save();

  return {
    success: response.data.success,
    ssid: response.data.ssid,
    timestamp: response.data.timestamp
  };
};

const getSSIDStatus = async (organizationId: string): Promise<{ status: "not_generated" | "generated" }> => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  const usiConfiguration = organization.usiConfig;
  if (!usiConfiguration || !usiConfiguration.ssidInfo) {
    return { status: "not_generated" };
  }
  return { status: "generated" };
};

const configureRTOForUSI = async (
  organizationId: string,
  data: {
    ssid: string;
    ramRelationshipStatus: "active" | "inactive" | "pending" | "terminated";
    ramAuthorizationDate: string;
    ramExpiryDate: string;
  }
) => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  if (!organization.ABN) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      UNEXPECTED_ERROR.code,
      "Organization ABN is missing in database. Please update the organization details with a valid ABN and try again."
    );
  }
  if (!organization.usiConfig?.ssidInfo) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      BAD_REQUEST.code,
      "SSID not generated for the organization. Please request for SSID before configuring for USI."
    );
  }
  if (data.ssid !== organization.usiConfig.ssidInfo.ssid) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      BAD_REQUEST.code,
      "Provided SSID does not match with the generated SSID for the organization. Please provide the correct SSID and try again."
    );
  }
  if (
    organization.usiConfig.configurationStatus === "configured" &&
    organization.usiConfig.configurationExpiryDate &&
    organization.usiConfig.configurationExpiryDate > new Date()
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      BAD_REQUEST.code,
      "USI is already configured for the organization and the configuration is still valid. If you think this is a mistake, please contact support to resolve the issue."
    );
  }
  if (data.ramExpiryDate && new Date(data.ramExpiryDate) < new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      BAD_REQUEST.code,
      "RAM expiry date cannot be in the past. Please provide a valid RAM expiry date and try again."
    );
  }

  organization.usiConfig.ramRelationshipStatus = data.ramRelationshipStatus;
  organization.usiConfig.ramAuthorizationDate = new Date(data.ramAuthorizationDate);
  organization.usiConfig.ramExpiryDate = new Date(data.ramExpiryDate);
  organization.usiConfig.configurationDate = new Date();
  organization.usiConfig.configurationStatus = "configured";
  organization.usiConfig.configurationExpiryDate = new Date(data.ramExpiryDate);
  organization.markModified("usiConfig");
  await organization.save();
};

const getUSIConfig = async (organizationId: string) => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  if (!organization.usiConfig) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      DATA_NOT_FOUND.code,
      "USI configuration not found for the organization. Please configure for USI and try again."
    );
  }
  if (organization.usiConfig.configurationStatus === "expired") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      BAD_REQUEST.code,
      "USI configuration has expired. Please reconfigure for USI and try again."
    );
  }
  if (organization.usiConfig.configurationStatus === "configuration_pending") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      BAD_REQUEST.code,
      "USI configuration is not set. Please configure the USI for the organization and try again."
    );
  }
  if (organization.usiConfig.configurationExpiryDate && organization.usiConfig.configurationExpiryDate < new Date()) {
    organization.usiConfig.configurationStatus = "expired";
    organization.markModified("usiConfig");
    await organization.save();
    throw new AppError(
      httpStatus.BAD_REQUEST,
      BAD_REQUEST.code,
      "USI configuration has expired. Please reconfigure for USI and try again."
    );
  }

  return {
    ABN: organization.usiConfig.ABN,
    orgCode: organization.usiConfig.orgCode,
    ssid: organization.usiConfig.ssidInfo,
    ramRelationshipStatus: organization.usiConfig.ramRelationshipStatus,
    ramAuthorizationDate: organization.usiConfig.ramAuthorizationDate,
    ramExpiryDate: organization.usiConfig.ramExpiryDate,
    configurationDate: organization.usiConfig.configurationDate,
    configurationStatus: organization.usiConfig.configurationStatus,
    configurationExpiryDate: organization.usiConfig.configurationExpiryDate
  };
};

const getUSIConfigurationStatus = async (
  organizationId: string
): Promise<{ status: "not_configured" | "configured" | "expired" }> => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  const usiConfiguration = organization.usiConfig;
  if (!usiConfiguration) {
    return { status: "not_configured" };
  }
  if (usiConfiguration.configurationStatus === "configured") {
    return { status: "configured" };
  }
  if (usiConfiguration.configurationStatus === "expired") {
    return { status: "expired" };
  }
  return { status: "not_configured" };
};

const verifyUSIWithStudentInfo = async (
  organizationId: string,
  studentInfo: {
    usi: string;
    firstName?: string;
    familyName: string; // lastName
    dateOfBirth: string; // yyyy-mm-dd
  }
) => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  if (!organization.usiConfig || organization.usiConfig.configurationStatus !== "configured") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      BAD_REQUEST.code,
      "USI is not configured for the organization. Please configure for USI and try again."
    );
  }
  if (!organization.usiConfig.ssidInfo || !organization.usiConfig.ssidInfo.ssid) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      UNEXPECTED_ERROR.code,
      "SSID information is missing for the organization in database. Please contact support to resolve this issue. USI verification cannot be performed until this issue is resolved."
    );
  }

  const envConfig = config.get<USIEnvConfig>("usi");
  const systemABN = config.get<string>("server.systemABN");

  try {
    const response = await axios.post(`${envConfig.apiBaseURL}/usi/verify`, {
      usi: studentInfo.usi,
      firstName: studentInfo.firstName,
      familyName: studentInfo.familyName,
      dateOfBirth: studentInfo.dateOfBirth,
      firstPartyABN: systemABN,
      secondPartyABN: organization.usiConfig.ABN,
      orgCode: organization.usiConfig.orgCode,
      ssid: organization.usiConfig.ssidInfo.ssid
    });

    if (response.status !== 200) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        UNEXPECTED_ERROR.code,
        "Failed to verify USI with student information. Please try again later."
      );
    }
    if (!response.data) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        UNEXPECTED_ERROR.code,
        "Failed to verify USI with student information. Please try again later."
      );
    }

    // Update verification stats
    organization.usiConfig.totalUSIVerifications += 1;
    const currentMonthName = new Date().toLocaleString("default", { month: "long" });
    const monthlyStats = organization.usiConfig.monthlyUSIVerifications.find(
      (stat) => stat.month === currentMonthName && stat.year === new Date().getFullYear()
    );
    if (monthlyStats) {
      monthlyStats.count += 1;
    } else {
      organization.usiConfig.monthlyUSIVerifications.push({
        month: currentMonthName,
        year: new Date().getFullYear(),
        count: 1
      });
    }
    organization.usiConfig.lastVerificationDate = new Date();
    organization.usiConfig.lastVerificationStatus = response.data.usiStatus;
    organization.markModified("usiConfig");
    await organization.save();

    return {
      usiResponse: response.data
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new AppError(
        error.response.status,
        UNEXPECTED_ERROR.code,
        error.response.data?.message || "Failed to verify USI with student information. Please try again later."
      );
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      UNEXPECTED_ERROR.code,
      "Failed to verify USI with student information. Please try again later."
    );
  }
};

const verifyUSIWithStudentId = async (organizationId: string, usi: string, studentId: string) => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  if (!organization.usiConfig || organization.usiConfig.configurationStatus !== "configured") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      BAD_REQUEST.code,
      "USI is not configured for the organization. Please configure for USI and try again."
    );
  }
  if (!organization.usiConfig.ssidInfo || !organization.usiConfig.ssidInfo.ssid) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      UNEXPECTED_ERROR.code,
      "SSID information is missing for the organization in database. Please contact support to resolve this issue. USI verification cannot be performed until this issue is resolved."
    );
  }

  const student = await StudentModel.findById(studentId);
  if (!student) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Student not found");
  }

  const studentInfo = {
    usi,
    firstName: student.personalInfo.givenName,
    familyName: student.personalInfo.surname,
    dateOfBirth: student.personalInfo.dateOfBirth
  };

  const envConfig = config.get<USIEnvConfig>("usi");
  const systemABN = config.get<string>("server.systemABN");
  try {
    const response = await axios.post(`${envConfig.apiBaseURL}/usi/verify`, {
      usi: studentInfo.usi,
      firstName: studentInfo.firstName,
      familyName: studentInfo.familyName,
      dateOfBirth: studentInfo.dateOfBirth,
      firstPartyABN: systemABN,
      secondPartyABN: organization.usiConfig.ABN,
      orgCode: organization.usiConfig.orgCode,
      ssid: organization.usiConfig.ssidInfo.ssid
    });

    if (response.status !== 200) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        UNEXPECTED_ERROR.code,
        "Failed to verify USI with student information. Please try again later."
      );
    }
    if (!response.data) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        UNEXPECTED_ERROR.code,
        "Failed to verify USI with student information. Please try again later."
      );
    }

    // Update verification stats
    organization.usiConfig.totalUSIVerifications += 1;
    const currentMonthName = new Date().toLocaleString("default", { month: "long" });
    const monthlyStats = organization.usiConfig.monthlyUSIVerifications.find(
      (stat) => stat.month === currentMonthName && stat.year === new Date().getFullYear()
    );
    if (monthlyStats) {
      monthlyStats.count += 1;
    } else {
      organization.usiConfig.monthlyUSIVerifications.push({
        month: currentMonthName,
        year: new Date().getFullYear(),
        count: 1
      });
    }
    organization.usiConfig.lastVerificationDate = new Date();
    organization.usiConfig.lastVerificationStatus = response.data.usiStatus;
    organization.markModified("usiConfig");
    await organization.save();

    return {
      usiResponse: response.data
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new AppError(
        error.response.status,
        UNEXPECTED_ERROR.code,
        error.response.data?.message || "Failed to verify USI with student information. Please try again later."
      );
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      UNEXPECTED_ERROR.code,
      "Failed to verify USI with student information. Please try again later."
    );
  }
};

const getUSIVerificationsCount = async (organizationId: string) => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  if (!organization.usiConfig) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      DATA_NOT_FOUND.code,
      "USI configuration not found for the organization. Please configure for USI and try again."
    );
  }

  return {
    totalUSIVerifications: organization.usiConfig.totalUSIVerifications,
    monthlyUSIVerifications: organization.usiConfig.monthlyUSIVerifications
  };
};

const updateSSIDRequestStatus = async (
  requestId: string,
  status: "approved" | "rejected"
): Promise<{ id: string; status: string; organizationId: string }> => {
  const request = await SSIDRequestModel.findById(requestId);
  if (!request) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "SSID request not found");
  }

  if (request.status !== "pending") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "INVALID_STATUS_TRANSITION",
      `Request is already ${request.status}`
    );
  }

  request.status = status;
  await request.save();

  return {
    id: request._id.toString(),
    status: request.status,
    organizationId: request.organizationId.toString()
  };
};

export const usiService = {
  usiServiceBackendHealthCheck,
  requestForSSIDByRTO,
  getAllSSIDRequests,
  generateAndSaveSSIDBySuperAdmin,
  getSSIDStatus,
  updateSSIDRequestStatus,
  configureRTOForUSI,
  getUSIConfig,
  getUSIConfigurationStatus,
  verifyUSIWithStudentInfo,
  verifyUSIWithStudentId,
  getUSIVerificationsCount
};
