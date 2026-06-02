import express from "express";
import config from "config";

import authRouter from "./auth.routes";
import demoRouter from "./demo.router";
import onboardRouter from "./onboard.routes";
import studentRouter from "./student.route";
import trainerRouter from "./trainer.route";
import certificateRouter from "./certificate.route";
import qualificationRouter from "./qualification.route";
import classRouter from "./class.route";
import enrollmentRouter from "./enrollment.route";
import { asyncWrapper, SendSuccessResponse } from "../utils";
import unitRouter from "./unit.route";
import organizationRouter from "./organization.route";
import { sessionValidator } from "../middleware/session-validator";
import { QualificationControllers } from "../controllers/qualification.controller";
import templateRouter from "./template.route";
import statisticsRouter from "./statistics.route";
import invoiceRouter from "./invoice.route";
import usiRouter from "./usi.routes";
import asqaRoutes from "./asqa.route";
import locationRouter from "./location.route";
import deliveryLocationRouter from "./deliveryLocation.route";
import avetmissRoutes from "./avetmiss.route";
import specificFundingIdentifierRouter from "./specificFundingIdentifier.route";
import activityLogRouter from "./activityLog.route";
import twoFactorRouter from "./twoFactor.route";
const router = express.Router();

const PROJECT_NAME: string = config.get<string>("server.projectName") || "Pro SMS";

router.get("/", (req, res): void => {
  SendSuccessResponse.success({ res, message: `${PROJECT_NAME} - v1 API root directory`, data: null });
});

// unauthenticated routes
router.get(
  "/qualification/owned-qualifications-units/:organisationCode",
  asyncWrapper(QualificationControllers.getQualificationsAndUnitsOfOrganisationHandler)
);
router.use("/auth", authRouter);
router.use("/demo", demoRouter);
router.use("/onboard", onboardRouter);
router.use("/certificate/verify", certificateRouter);
router.use("/certificate/file", certificateRouter);
router.use("/invoice/file", invoiceRouter);
router.use("/qualification/verify-abn", qualificationRouter);

// authenticated routes
router.use("/organization", sessionValidator(), organizationRouter);
router.use("/student", sessionValidator(), studentRouter);
router.use("/trainer", sessionValidator(), trainerRouter);
router.use("/certificate", sessionValidator(), certificateRouter);
router.use("/qualification", sessionValidator(), qualificationRouter);
router.use("/class", sessionValidator(), classRouter);
router.use("/enrollment", sessionValidator(), enrollmentRouter);
router.use("/unit", sessionValidator(), unitRouter);
router.use("/template", sessionValidator(), templateRouter);
router.use("/statistics", sessionValidator(), statisticsRouter);
router.use("/invoice", sessionValidator(), invoiceRouter);
router.use("/usi", sessionValidator(), usiRouter);
router.use("/report/asqa", sessionValidator(), asqaRoutes);
router.use("/report/avetmiss", sessionValidator(), avetmissRoutes);
router.use("/location", sessionValidator(), locationRouter);
router.use("/delivery-location", sessionValidator(), deliveryLocationRouter);
router.use("/specific-funding-identifier", sessionValidator(), specificFundingIdentifierRouter);
router.use("/activity-log", sessionValidator(), activityLogRouter);
router.use("/auth/2fa", sessionValidator(), twoFactorRouter);

export default router;
