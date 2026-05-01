import { Router } from "express";
import { asyncWrapper } from "../utils";
import { validateResource } from "../middleware";
import { GenerateAvetmissReportRequestSchema } from "../schemas/avetmiss-report.schema";
import { AvetmissController } from "../controllers/avetmiss.controller";
import multer from "multer";

const router = Router();
// POST /report/avetmiss — generate a new AVETMISS report
router.post(
  "/generate",
  validateResource(GenerateAvetmissReportRequestSchema),
  asyncWrapper(AvetmissController.generateAvetmissReportHandler)
);

// POST /report/import — import AVETMISS reports from ZIP files
router.post(
  "/import",
  multer({ storage: multer.memoryStorage() }).array("files", 5),
  asyncWrapper(AvetmissController.importAvetmissHandler)
);

// GET /report — list reports with pagination and date filter
router.get("/", asyncWrapper(AvetmissController.getReportsHandler));

router.get("/bulk-download", asyncWrapper(AvetmissController.bulkDownloadReportsHandler));

// GET /report/:id — stream/download the ZIP file
router.get("/:id", asyncWrapper(AvetmissController.downloadReportHandler));

// DELETE /report/:id — delete a report
router.delete("/:id", asyncWrapper(AvetmissController.deleteReportHandler));

export default router;
