import { Router } from "express";
import { asyncWrapper } from "../utils";
import { InvoiceController } from "../controllers/invoice.controller";
import { validateResource } from "../middleware";
import { GenerateAutoInvoiceRequestSchema, GenerateManualInvoiceRequestSchema } from "../schemas/invoice.schema";

const router = Router();

router.post(
  "/auto",
  validateResource(GenerateAutoInvoiceRequestSchema),
  asyncWrapper(InvoiceController.generateAutoInvoiceHandler)
);
router.post(
  "/manual",
  validateResource(GenerateManualInvoiceRequestSchema),
  asyncWrapper(InvoiceController.generateManualInvoiceHandler)
);

router.get("/auto", asyncWrapper(InvoiceController.getAutoInvoicesHandler));
router.get("/manual", asyncWrapper(InvoiceController.getManualInvoicesHandler));
router.get("/created-by/sa", asyncWrapper(InvoiceController.getSAInvoicesHandler));
router.get("/:id", asyncWrapper(InvoiceController.getInvoiceByIdHandler));
router.get("/view/:id", asyncWrapper(InvoiceController.viewInvoiceHandler));

router.delete("/:id", asyncWrapper(InvoiceController.deleteInvoiceByIdHandler));

export default router;
