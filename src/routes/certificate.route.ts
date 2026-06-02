import { Router } from "express";
import { validateResource } from "../middleware";
import {
  certificateSendSchema,
  BulkGenerateCertificateSchema,
  GenerateCertificateRequestSchema
} from "../schemas/certificate.schema";
import { asyncWrapper } from "../utils";
import { CertificateController } from "../controllers/certificate.controller";

const router = Router();

router.post(
  "/generate",
  validateResource(GenerateCertificateRequestSchema),
  asyncWrapper(CertificateController.generateCertificatesHandler)
);

// F-02: Bulk generate — no student count cap
router.post(
  "/bulk-generate",
  validateResource(BulkGenerateCertificateSchema),
  asyncWrapper(CertificateController.bulkGenerateCertificatesHandler)
);

// E-01: Generate certs for one student across multiple class enrollments
router.post("/bulk-generate-by-student", asyncWrapper(CertificateController.generateCertificatesForStudentHandler));

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
