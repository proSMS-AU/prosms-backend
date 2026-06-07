import { Request, Response } from "express";
import { InvoiceServices } from "../services/invoice.service";
import { SendSuccessResponse } from "../utils";
import { AppError } from "../utils/appError";
import { DATA_NOT_FOUND, httpStatus } from "../constants";
import { InvoiceModel } from "../model/invoice.model";
import { streamFromR2 } from "../services/cloudflare.service";
import config from "config";

const generateManualInvoiceHandler = async (req: Request, res: Response) => {
  const result = await InvoiceServices.generateManualInvoice(req.body, req.user?.organizationId);

  SendSuccessResponse.created({
    res,
    message: "Manual invoice generated successfully!",
    data: result
  });
};

const generateAutoInvoiceHandler = async (req: Request, res: Response) => {
  const { templateId, studentId, studentSnapshot, classIds, createdBy } = req.body;

  if (!templateId || !studentId || !studentSnapshot || !classIds || !Array.isArray(classIds) || classIds.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "BAD_REQUEST",
      "templateId, studentId, studentSnapshot, classIds (array) are required"
    );
  }

  const result = await InvoiceServices.generateAutoInvoice(
    templateId,
    studentId,
    studentSnapshot,
    classIds,
    createdBy,
    req.user?.organizationId as string // auto invoice is always org-scoped (admin only)
  );

  SendSuccessResponse.created({
    res,
    message: "Auto invoice generated successfully!",
    data: result
  });
};

const getAutoInvoicesHandler = async (req: Request, res: Response) => {
  const { invoices, ...meta } = await InvoiceServices.getAutoInvoices(
    req.query as Record<string, string>,
    req.user?.organizationId as string
  );
  SendSuccessResponse.success({
    res,
    message: "Auto invoices retrieved successfully!",
    meta,
    data: invoices
  });
};

const getManualInvoicesHandler = async (req: Request, res: Response) => {
  const { invoices, ...meta } = await InvoiceServices.getManualInvoices(
    req.query as Record<string, string>,
    req.user?.organizationId as string
  );
  SendSuccessResponse.success({
    res,
    message: "Manual invoices retrieved successfully!",
    meta,
    data: invoices
  });
};

const getInvoiceByIdHandler = async (req: Request, res: Response) => {
  const invoice = await InvoiceServices.getInvoiceById(req.params.id);
  SendSuccessResponse.success({
    res,
    message: "Invoice retrieved successfully!",
    data: invoice
  });
};

const getSAInvoicesHandler = async (req: Request, res: Response) => {
  const { invoices, ...meta } = await InvoiceServices.getSAInvoices(req.query as Record<string, string>);
  SendSuccessResponse.success({
    res,
    message: "Super admin invoices retrieved successfully!",
    meta,
    data: invoices
  });
};

const viewInvoiceHandler = async (req: Request, res: Response) => {
  const invoice = await InvoiceModel.findOne({
    invoiceId: req.params.id
  });

  if (!invoice) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Invoice not found");
  }
  res.setHeader("Content-Security-Policy", `frame-ancestors ${config.get("server.clientUrl")}`);
  await streamFromR2(invoice.invoiceKey, res, Boolean(req.query.download));
};

const deleteInvoiceByIdHandler = async (req: Request, res: Response) => {
  const result = await InvoiceServices.deleteInvoiceById(req.params.id, req.user?._id);
  SendSuccessResponse.deleted({
    res,
    message: "Invoice deleted successfully!",
    data: result
  });
};

const bulkCreateInvoicesHandler = async (req: Request, res: Response) => {
  const { classId, studentIds, templateId } = req.body as { classId: string; studentIds: string[]; templateId: string };
  const results = await InvoiceServices.bulkCreateInvoices(
    classId,
    studentIds,
    templateId,
    req.user!.organizationId as string,
    String(req.user!._id ?? "")
  );
  const successCount = results.filter((r) => r.success).length;
  SendSuccessResponse.created({
    res,
    message: `Bulk invoice: ${successCount}/${results.length} created`,
    data: results
  });
};

export const InvoiceController = {
  generateManualInvoiceHandler,
  generateAutoInvoiceHandler,
  bulkCreateInvoicesHandler,
  getManualInvoicesHandler,
  getAutoInvoicesHandler,
  getInvoiceByIdHandler,
  viewInvoiceHandler,
  deleteInvoiceByIdHandler,
  getSAInvoicesHandler
};
