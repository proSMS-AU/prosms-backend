/**
 * Endpoints:
 * USI Service health check - A basic endpoint to check if the USI service is up and running
 * generate SSID for the RTO - Endpoint used by the Super Admin
 * configure for USI operation - Endpoint used by the RTO Admin
 * get configuration for USI operation - Endpoint used by the RTO Admin and the RTO Staff
 * get USI verification status - Endpoint used by the RTO Admin and the RTO Staff
 * verify USI - Endpoint used by the RTO Admin and the RTO Staff
 * get number of USI verifications done - Endpoint used by the RTO Admin and the RTO Staff
 */
import { Router } from "express";
import { validateResource } from "../middleware";
import { asyncWrapper } from "../utils";
import { usiControllers } from "../controllers/usi.controller";
import {
  configureRTOForUSISchema,
  verifyUSIWithStudentIdSchema,
  verifyUSIWithStudentInfoSchema
} from "../schemas/usi.schema";

const router = Router();

const SUPER_ADMIN_BASE_URL = "/super-admin";
const RTO_BASE_URL = "/rto";

router
  .get("/backend-service/health-check", asyncWrapper(usiControllers.usiServiceBackendHealthCheckHandler))
  .post(`${RTO_BASE_URL}/request-for-ssid/:organizationId`, asyncWrapper(usiControllers.requestForSSIDHandler))
  .get(`${SUPER_ADMIN_BASE_URL}/requests-for-ssid`, asyncWrapper(usiControllers.getAllSSIDRequestsHandler))
  .get(
    `${SUPER_ADMIN_BASE_URL}/generate-ssid/:organizationId`,
    asyncWrapper(usiControllers.generateSSIDBySuperAdminHandler)
  )
  .get(`${RTO_BASE_URL}/ssid-status/:organizationId`, asyncWrapper(usiControllers.getSSIDStatusHandler))
  .post(
    `${RTO_BASE_URL}/configure-for-usi/:organizationId`,
    validateResource(configureRTOForUSISchema),
    asyncWrapper(usiControllers.configureRTOForUSIHandler)
  )
  .get(`${RTO_BASE_URL}/get-usi-config/:organizationId`, asyncWrapper(usiControllers.getUSIConfigHandler))
  .get(
    `${RTO_BASE_URL}/usi-configuration-status/:organizationId`,
    asyncWrapper(usiControllers.getUSIConfigurationStatusHandler)
  )
  .post(
    `${RTO_BASE_URL}/verify-usi-with-student-info/:organizationId`,
    validateResource(verifyUSIWithStudentInfoSchema),
    asyncWrapper(usiControllers.verifyUSIWithStudentInfoHandler)
  )
  .post(
    `${RTO_BASE_URL}/verify-usi-with-student-id/:organizationId`,
    validateResource(verifyUSIWithStudentIdSchema),
    asyncWrapper(usiControllers.verifyUSIWithStudentIdHandler)
  )
  .get(
    `${RTO_BASE_URL}/usi-verifications-stats/:organizationId`,
    asyncWrapper(usiControllers.getUSIVerificationsStatsHandler)
  );

export default router;
