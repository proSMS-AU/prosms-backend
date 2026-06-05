import axios from "axios";
import config from "config";
import { AppError } from "../utils/appError";
import { BAD_REQUEST, DATA_NOT_FOUND, httpStatus, UNEXPECTED_ERROR } from "../constants";
import { OrganizationModel } from "../model/organization.model";
import { SSIDRequestModel } from "../model/ssid-request.model";
import { StudentModel } from "../model/student.model";
import { sendEmail } from "../utils/sendEmail";
import { logger } from "../utils/logger";

const SUPER_ADMIN_EMAIL = "prosms.au@gmail.com";
const CLIENT_BASE_URL = config.get<string>("server.clientUrl") ?? "https://app.prosms.com.au";

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

  // Dedupe: never create a second row while an active request exists. Only a rejected
  // request may be re-submitted (falls through to create a fresh one).
  const existing = await SSIDRequestModel.findOne({
    organizationId: organization._id,
    status: { $in: ["pending", "generated", "sent", "configured"] }
  }).sort({ requestDate: -1 });

  if (existing) {
    // SSID already produced — don't re-create or re-email; point the admin to their inbox.
    if (["generated", "sent", "configured"].includes(existing.status)) {
      return {
        success: true,
        status: existing.status,
        alreadyRequested: true,
        alreadyGenerated: true,
        message: "Your SSID has already been generated. Please follow the instructions sent to your email."
      };
    }

    // Still pending — reuse the row, but nudge the Super Admin (throttled to avoid spam
    // when the admin clicks repeatedly).
    const REMINDER_THROTTLE_MS = 15 * 60 * 1000;
    const lastReminder = existing.lastReminderAt ? new Date(existing.lastReminderAt).getTime() : 0;
    if (Date.now() - lastReminder > REMINDER_THROTTLE_MS) {
      try {
        await sendEmail({
          to: SUPER_ADMIN_EMAIL,
          subject: `Reminder: pending SSID request — ${organization.name}`,
          templateName: "ssid-request-notify-sa",
          templateData: {
            organizationName: organization.name,
            rtoId: organization.rtoId,
            abn: organization.ABN,
            requestDate: new Date(existing.requestDate).toLocaleString("en-AU", { timeZone: "Australia/Sydney" }),
            dashboardUrl: `${CLIENT_BASE_URL}/super-admin/dashboard/ssid/manage`
          }
        });
        existing.lastReminderAt = new Date();
        await existing.save();
      } catch (err) {
        logger.error("[SSID] Failed to re-notify SA by email:", err);
      }
    }

    return {
      success: true,
      status: existing.status,
      alreadyRequested: true,
      alreadyGenerated: false,
      message:
        "Your request is already with the Super Admin and is being validated. Please wait — we'll email you once it's ready."
    };
  }

  const request = await SSIDRequestModel.create({
    organizationId: organization._id.toString(),
    rtoId: organization.rtoId,
    organizationName: organization.name,
    ABN: organization.ABN || null,
    requestDate: new Date(),
    status: "pending"
  });

  // S1: notify Super Admin by email
  try {
    await sendEmail({
      to: SUPER_ADMIN_EMAIL,
      subject: `New SSID Request — ${organization.name}`,
      templateName: "ssid-request-notify-sa",
      templateData: {
        organizationName: organization.name,
        rtoId: organization.rtoId,
        abn: organization.ABN,
        requestDate: new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" }),
        dashboardUrl: `${CLIENT_BASE_URL}/super-admin/dashboard/ssid/manage`
      }
    });
  } catch (err) {
    // Email failure must not break the request flow
    logger.error("[SSID] Failed to notify SA by email:", err);
  }

  return {
    success: true,
    status: request.status,
    alreadyRequested: false,
    alreadyGenerated: false,
    message: "Request sent to the Super Admin. Please wait while we validate and process it."
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

// S2: generate SSID from the request list row + send instruction email to the admin
const generateAndEmailSSID = async (requestId: string): Promise<{ ssid: string; alreadyExisted: boolean }> => {
  const request = await SSIDRequestModel.findById(requestId);
  if (!request) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "SSID request not found");
  }
  if (request.status === "rejected") {
    throw new AppError(httpStatus.BAD_REQUEST, BAD_REQUEST.code, "Cannot generate SSID for a rejected request");
  }

  // Reuse existing generateAndSaveSSIDBySuperAdmin to get / create the SSID
  const orgId = request.organizationId.toString();
  const { ssid } = await generateAndSaveSSIDBySuperAdmin(orgId);
  const alreadyExisted = request.status !== "pending";

  // Update request to "generated"
  request.status = "generated";
  await request.save();

  // Look up admin email from the organization
  const organization = await OrganizationModel.findById(orgId);
  const adminEmail = organization?.email;

  if (adminEmail) {
    try {
      await sendEmail({
        to: adminEmail,
        subject: "Your ProSMS SSID is Ready — Next Steps",
        templateName: "ssid-generated-notify-admin",
        templateData: {
          organizationName: request.organizationName,
          ssid,
          configUrl: `${CLIENT_BASE_URL}/dashboard/settings?tab=usiConfiguration`
        }
      });
      request.status = "sent";
      await request.save();
    } catch (err) {
      logger.error("[SSID] Failed to send instruction email to admin:", err);
      // Stay on "generated" — SA can manually resend
    }
  }

  return { ssid, alreadyExisted };
};

// S4: resend the instruction email for an org that already has an SSID
const resendSSIDEmailToAdmin = async (organizationId: string): Promise<void> => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  const ssid = organization.usiConfig?.ssidInfo?.ssid;
  if (!ssid) {
    throw new AppError(httpStatus.BAD_REQUEST, BAD_REQUEST.code, "No SSID generated for this organization yet");
  }
  const adminEmail = organization.email;
  if (!adminEmail) {
    throw new AppError(httpStatus.BAD_REQUEST, BAD_REQUEST.code, "Organization has no email address on file");
  }

  await sendEmail({
    to: adminEmail,
    subject: "Your ProSMS SSID — Next Steps",
    templateName: "ssid-generated-notify-admin",
    templateData: {
      organizationName: organization.name,
      ssid,
      configUrl: `${CLIENT_BASE_URL}/dashboard/settings?tab=usiConfiguration`
    }
  });

  // Update the request row status to "sent"
  await SSIDRequestModel.findOneAndUpdate(
    { organizationId: organization._id, status: { $in: ["generated", "sent"] } },
    { status: "sent" },
    { sort: { requestDate: -1 } }
  );
};

// S3: return the stored SSID so the config form can pre-fill it (read-only)
const getGeneratedSSID = async (organizationId: string): Promise<{ ssid: string | null }> => {
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");
  }
  return { ssid: organization.usiConfig?.ssidInfo?.ssid ?? null };
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
  // S7: allow re-configuration (edit) — the old block prevented updating valid configs.
  // Admin should always be able to update RAM dates / relationship status.
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

  // Keep the SSID request row in sync so the Super Admin list reflects "configured"
  // (previously it stayed on "sent" after the admin completed configuration).
  await SSIDRequestModel.updateOne(
    { organizationId: organization._id, status: { $in: ["generated", "sent"] } },
    { status: "configured" }
  );
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

// S5: reject only — approve path is now "generate + email" (generateAndEmailSSID)
const updateSSIDRequestStatus = async (
  requestId: string,
  status: "rejected"
): Promise<{ id: string; status: string; organizationId: string }> => {
  const request = await SSIDRequestModel.findById(requestId);
  if (!request) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "SSID request not found");
  }

  if (!["pending", "generated"].includes(request.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "INVALID_STATUS_TRANSITION",
      `Cannot reject a request that is already ${request.status}`
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
  generateAndEmailSSID,
  resendSSIDEmailToAdmin,
  getGeneratedSSID,
  getSSIDStatus,
  updateSSIDRequestStatus,
  configureRTOForUSI,
  getUSIConfig,
  getUSIConfigurationStatus,
  verifyUSIWithStudentInfo,
  verifyUSIWithStudentId,
  getUSIVerificationsCount
};
