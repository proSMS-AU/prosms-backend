import { Router } from "express";
import { validateResource } from "../middleware";
import { certificateSendSchema, GenerateCertificateRequestSchema } from "../schemas/certificate.schema";
import { asyncWrapper } from "../utils";
import { CertificateController } from "../controllers/certificate.controller";

const router = Router();

router.post(
  "/generate",
  validateResource(GenerateCertificateRequestSchema),
  asyncWrapper(CertificateController.generateCertificatesHandler)
);

router.post(
  "/send",
  validateResource(certificateSendSchema),
  asyncWrapper(CertificateController.sendCertificateToStudentEmailHandler)
);

router.get("/issued", asyncWrapper(CertificateController.getIssuedCertificatesListHandler));

router.get("/class/:classId", asyncWrapper(CertificateController.getCertificatesByClassHandler));

router.get("/view/:shortId", asyncWrapper(CertificateController.viewCertificateHandler));

router.get("/:id", asyncWrapper(CertificateController.verifyCertificatedHandler));

router.delete("/:id", asyncWrapper(CertificateController.deleteCertificate));

export default router;
