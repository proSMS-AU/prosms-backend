/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import PizZip from "pizzip";
import { AppError } from "../utils/appError";
import { httpStatus } from "../constants";
import { CloudflareService } from "../services/cloudflare.service";
import { TemplateType } from "../model/template.model";
import { TemplateServices } from "../services/template.service";
import { SendSuccessResponse } from "../utils";
import { logger } from "../utils";
import { extractPlaceholdersFromDocx } from "../utils/extractPlaceholders";
import { throwIfInvalidTemplate } from "../utils/templateValidator";

// Function to replace placeholder in template
const replaceQRPlaceholder = (buffer: Buffer): Buffer => {
  try {
    const zip = new PizZip(buffer);
    let documentXml = zip.file("word/document.xml")?.asText();

    if (!documentXml) {
      logger.warn("Could not read document.xml, skipping placeholder replacement");
      return buffer;
    }

    const replacements = [
      { from: "«QR_CODE QR Code»", to: "«QR_CODE»" },
      { from: "<<QR_CODE QR Code>>", to: "<<QR_CODE>>" },
      { from: "{{QR_CODE QR Code}}", to: "{{QR_CODE}}" }
    ];

    let modified = false;
    replacements.forEach(({ from, to }) => {
      if (documentXml!.includes(from)) {
        documentXml = documentXml!.replace(new RegExp(from, "g"), to);
        modified = true;
        logger.info(`Replaced '${from}' with '${to}'`);
      }
    });

    if (!modified) {
      logger.info("No QR_CODE placeholder found to replace");
      return buffer;
    }

    zip.file("word/document.xml", documentXml);

    return zip.generate({
      type: "nodebuffer",
      compression: "DEFLATE"
    });
  } catch (error) {
    logger.error("Failed to replace placeholder:", error);
    return buffer;
  }
};

const templateTypeMap: Record<string, TemplateType> = {
  ATTAINMENT: TemplateType.ATTAINMENT,
  CERTIFICATE_SINGLE: TemplateType.CERTIFICATE_SINGLE,
  CERTIFICATE_DOUBLE: TemplateType.CERTIFICATE_DOUBLE,
  INVOICE: TemplateType.INVOICE
};

const uploadTemplateHandler = async (req: Request, res: Response) => {
  const templateType = templateTypeMap[req.body.templateType];
  if (!templateType) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Invalid template type");
  }

  // Handle files based on template type
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  let templateFile: Express.Multer.File | undefined;
  let templatePage2File: Express.Multer.File | undefined;

  if (templateType === TemplateType.CERTIFICATE_DOUBLE) {
    // Expect templatePage1 and templatePage2
    templateFile = files?.templatePage1?.[0];
    templatePage2File = files?.templatePage2?.[0];

    if (!templateFile || !templatePage2File) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "BAD_REQUEST",
        "Both Page 1 and Page 2 template files are required for Certificate Double"
      );
    }
  } else {
    // Expect single template file
    templateFile = files?.template?.[0];

    if (!templateFile) {
      throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Template file is required");
    }
  }

  // Process main template file (Page 1 for CERTIFICATE_DOUBLE)
  const modifiedBuffer = replaceQRPlaceholder(templateFile.buffer);
  const extractedPlaceholders = extractPlaceholdersFromDocx(modifiedBuffer);
  throwIfInvalidTemplate(templateType, extractedPlaceholders, false);

  // Upload main template to R2
  const uploadResult = await CloudflareService.uploadBufferToR2(
    modifiedBuffer,
    templateFile.originalname,
    "templates",
    false
  );

  if (!uploadResult.success) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "UPLOAD_FAILED",
      uploadResult.message || "Failed to upload template"
    );
  }

  // Prepare template data
  const templateData: any = {
    title: req.body.title,
    createdBy: req.body.createdBy,
    templateType: templateType,
    templateUrl: uploadResult.publicUrl!,
    templateKey: uploadResult.key!,
    description: req.body.description || "",
    organizationId: req.user?.organizationId as string,
    placeholders: TemplateServices.getDefaultPlaceholders(templateType),
    isMultiPageTemplate: templateType === TemplateType.CERTIFICATE_DOUBLE
  };

  // Handle second page if CERTIFICATE_DOUBLE
  if (templatePage2File) {
    const modifiedBuffer2 = replaceQRPlaceholder(templatePage2File.buffer);
    const extractedPlaceholders2 = extractPlaceholdersFromDocx(modifiedBuffer2);

    // Validate page 2 with isPage2 = true
    throwIfInvalidTemplate(templateType, extractedPlaceholders2, true);

    const uploadResult2 = await CloudflareService.uploadBufferToR2(
      modifiedBuffer2,
      templatePage2File.originalname,
      "templates",
      false
    );

    if (!uploadResult2.success) {
      // Cleanup: delete first file if second upload fails
      await CloudflareService.deleteFileFromR2(uploadResult.key!);
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Failed to upload page 2 template");
    }

    templateData.templatePage2Url = uploadResult2.publicUrl;
    templateData.templatePage2Key = uploadResult2.key;
  }

  const template = await TemplateServices.uploadTemplate(templateData);

  SendSuccessResponse.created({
    res,
    message: "Template created successfully!",
    data: template
  });
};

const getTemplatesGroupedByTypeHandler = async (req: Request, res: Response) => {
  const parseTemplateTypes = (input?: string | string[]): TemplateType[] => {
    if (!input) return [];

    const rawValues = Array.isArray(input) ? input.flatMap((v) => v.split(",")) : input.split(",");

    const validTypes = Object.values(TemplateType);

    return rawValues.filter((v): v is TemplateType => validTypes.includes(v as TemplateType));
  };

  const parseBoolean = (value?: string): boolean => value === "true";

  const templateTypes = parseTemplateTypes(req.query.templateTypes as string | string[]);
  const paginate = parseBoolean(req.query.paginate as string);

  const { templates, total, page, limit, totalPages } = await TemplateServices.getTemplatesGroupedByType(
    req.query as Record<string, string>,
    req.user?.organizationId as string,
    {
      templateTypes,
      paginate
    }
  );
  SendSuccessResponse.success({
    res,
    message: "Templates retrieved successfully!",
    meta: { total, page, limit, totalPages },
    data: templates
  });
};

const getTemplateByIdHandler = async (req: Request, res: Response) => {
  const { templateId } = req.params;
  const template = await TemplateServices.getTemplateById(templateId);

  SendSuccessResponse.success({
    res,
    message: "Template retrieved successfully!",
    data: template
  });
};

const getSATemplatesHandler = async (req: Request, res: Response) => {
  const { templates, ...meta } = await TemplateServices.getSATemplates(req.query as Record<string, string>);
  SendSuccessResponse.success({
    res,
    message: "Super admin templates retrieved successfully!",
    meta,
    data: templates
  });
};

const updateTemplateHandler = async (req: Request, res: Response) => {
  const { templateId } = req.params;
  const updateData: any = { ...req.body };

  // Get existing template
  const existingTemplate = await TemplateServices.getTemplateById(templateId);

  let templateType: TemplateType;
  if (req.body.templateType) {
    templateType = templateTypeMap[req.body.templateType];
    if (!templateType) {
      throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Invalid template type");
    }
    updateData.templateType = templateType;
    updateData.isMultiPageTemplate = templateType === TemplateType.CERTIFICATE_DOUBLE;
  } else {
    templateType = existingTemplate.templateType;
  }

  // Handle file uploads if present
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  if (files) {
    const templateFile = files?.template?.[0];
    const templatePage1File = files?.templatePage1?.[0];
    const templatePage2File = files?.templatePage2?.[0];

    // Update main template (Page 1 for CERTIFICATE_DOUBLE)
    if (templateFile || templatePage1File) {
      const fileToProcess = templateFile || templatePage1File;
      const modifiedBuffer = replaceQRPlaceholder(fileToProcess!.buffer);
      const extractedPlaceholders = extractPlaceholdersFromDocx(modifiedBuffer);
      throwIfInvalidTemplate(templateType, extractedPlaceholders, false);

      const uploadResult = await CloudflareService.uploadBufferToR2(
        modifiedBuffer,
        fileToProcess!.originalname,
        "templates",
        false
      );

      if (!uploadResult.success) {
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Failed to upload template");
      }

      updateData.templateUrl = uploadResult.publicUrl;
      updateData.templateKey = uploadResult.key;
    }

    // Update page 2 if provided (with Page 2 validation)
    if (templatePage2File) {
      const modifiedBuffer2 = replaceQRPlaceholder(templatePage2File.buffer);
      const extractedPlaceholders2 = extractPlaceholdersFromDocx(modifiedBuffer2);
      throwIfInvalidTemplate(templateType, extractedPlaceholders2, true);

      const uploadResult2 = await CloudflareService.uploadBufferToR2(
        modifiedBuffer2,
        templatePage2File.originalname,
        "templates",
        false
      );

      if (!uploadResult2.success) {
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Failed to upload page 2");
      }

      updateData.templatePage2Url = uploadResult2.publicUrl;
      updateData.templatePage2Key = uploadResult2.key;
    }

    updateData.placeholders = TemplateServices.getDefaultPlaceholders(templateType);
  }

  const template = await TemplateServices.updateTemplate(templateId, updateData);

  SendSuccessResponse.success({
    res,
    message: "Template updated successfully!",
    data: template
  });
};

const deleteTemplateHandler = async (req: Request, res: Response) => {
  const { templateId } = req.params;
  await TemplateServices.deleteTemplate(templateId);

  SendSuccessResponse.success({
    res,
    message: "Template deleted successfully!",
    data: null
  });
};

export const TemplateController = {
  uploadTemplateHandler,
  getTemplatesGroupedByTypeHandler,
  getTemplateByIdHandler,
  getSATemplatesHandler,
  updateTemplateHandler,
  deleteTemplateHandler
};
