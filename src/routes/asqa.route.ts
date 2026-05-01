import { Router } from "express";
import { asyncWrapper } from "../utils";
import { AsqaController } from "../controllers/asqa.controller";
import multer from "multer";

const router = Router();

// multer with memory storage — files land in req.files as Buffer
// const upload = multer({ storage: multer.memoryStorage() });

router.post("/generate", asyncWrapper(AsqaController.generateASQAReportHandler));

router.post(
  "/import",
  multer({ storage: multer.memoryStorage() }).array("files", 5),
  asyncWrapper(AsqaController.importASQAHandler)
);

router.get("/", asyncWrapper(AsqaController.getAllReportsHandler));

router.get("/bulk-download", AsqaController.bulkDownloadReportsHandler);

router.get("/:id", AsqaController.downloadReportHandler);

router.delete("/:id", asyncWrapper(AsqaController.deleteReportHandler));

export default router;
