/* eslint-disable @typescript-eslint/no-explicit-any */
import { PipelineStage, Types } from "mongoose";
import { httpStatus } from "../constants";
import { TemplateModel, TemplateType } from "../model/template.model";
import { AppError } from "../utils/appError";
import { CloudflareService } from "./cloudflare.service";
import { QueryBuilder } from "../utils/queryBuilder";

interface CreateTemplateInput {
  title: string;
  templateType: TemplateType;
  templateUrl: string;
  templateKey: string;
  templatePage2Url?: string;
  templatePage2Key?: string;
  isMultiPageTemplate: boolean;
  description?: string;
  organizationId?: string;
  placeholders: string[];
}

// Get default placeholders based on template type
const getDefaultPlaceholders = (templateType: TemplateType): string[] => {
  const placeholderSets = {
    [TemplateType.ATTAINMENT]: [
      "CLI_NAME",
      "COURSE_ID",
      "QUAL_LEVEL",
      "SEPARATOR_NAME",
      "COURSE_NAME",
      "STREAM",
      "QR_CODE",
      "MAX_DATE",
      "CERT_NO",
      // Loop placeholders for units
      "units" // This indicates loop-based template
    ],
    [TemplateType.CERTIFICATE_SINGLE]: [
      "CLI_NAME",
      "COURSE_ID",
      "QUAL_LEVEL",
      "SEPARATOR_WORD",
      "SEPARATOR_NAME",
      "COURSE_NAME",
      "STREAM",
      "QR_CODE",
      "_dtCompleted",
      "CERT_NO",
      "MAX_DATE",
      "units"
    ],
    [TemplateType.CERTIFICATE_DOUBLE]: [
      "CLI_NAME",
      "COURSE_ID",
      "QUAL_LEVEL",
      "SEPARATOR_WORD",
      "SEPARATOR_NAME",
      "COURSE_NAME",
      "STREAM",
      "QR_CODE",
      "_dtCompleted",
      "CERT_NO",
      "MAX_DATE",
      "units"
    ],
    [TemplateType.INVOICE]: [
      "inv_date",
      "due_date",
      "inv_no",
      "p_order",
      "name",
      "address",
      "town",
      "postcode",
      "state",
      "text1",
      "text2",
      "text3",
      "text4",
      "text5",
      "text6",
      "text7",
      "text8",
      "text9",
      "text10",
      "text11",
      "text12",
      "text13",
      "text14",
      "text15",
      "text16",
      "text17",
      "text18",
      "text19",
      "text20",
      "uprice1",
      "uprice2",
      "uprice3",
      "uprice4",
      "uprice5",
      "uprice6",
      "uprice7",
      "uprice8",
      "uprice9",
      "uprice10",
      "uprice11",
      "uprice12",
      "uprice13",
      "uprice14",
      "uprice15",
      "uprice16",
      "uprice17",
      "uprice18",
      "uprice19",
      "uprice20",
      "qty1",
      "qty2",
      "qty3",
      "qty4",
      "qty5",
      "qty6",
      "qty7",
      "qty8",
      "qty9",
      "qty10",
      "qty11",
      "qty12",
      "qty13",
      "qty14",
      "qty15",
      "qty16",
      "qty17",
      "qty18",
      "qty19",
      "qty20",
      "tax1",
      "tax2",
      "tax3",
      "tax4",
      "tax5",
      "tax6",
      "tax7",
      "tax8",
      "tax9",
      "tax10",
      "tax11",
      "tax12",
      "tax13",
      "tax14",
      "tax15",
      "tax16",
      "tax17",
      "tax18",
      "tax19",
      "tax20",
      "amt1",
      "amt2",
      "amt3",
      "amt4",
      "amt5",
      "amt6",
      "amt7",
      "amt8",
      "amt9",
      "amt10",
      "amt11",
      "amt12",
      "amt13",
      "amt14",
      "amt15",
      "amt16",
      "amt17",
      "amt18",
      "amt19",
      "amt20",
      "total_val",
      "total_gst",
      "amount"
    ]
  };

  return placeholderSets[templateType] || [];
};

const uploadTemplate = async (data: CreateTemplateInput) => {
  // Check for duplicate template
  const existingTemplate = await TemplateModel.findOne({
    title: data.title,
    templateType: data.templateType,
    organizationId: data.organizationId
  });

  if (existingTemplate) {
    throw new AppError(
      httpStatus.CONFLICT,
      "DUPLICATE_ERROR",
      `Template with title '${data.title}' already exists for this organization`
    );
  }

  const newTemplate = await TemplateModel.create(data);
  return newTemplate;
};

// const getTemplatesGroupedByType = async (
//   query: Record<string, string>,
//   organizationId: string,
//   options?: {
//     templateTypes?: TemplateType[];
//     paginate?: boolean;
//   }
// ) => {
//   const page = Number(query.page) || 1;
//   const limit = Number(query.limit) || 10;
//   const skip = (page - 1) * limit;
//   const search = query.search || "";

//   const matchStage: any = {
//     organizationId
//   };

//   // Template type filter (certificate / invoice / etc.)
//   if (options?.templateTypes?.length) {
//     matchStage.templateType = { $in: options.templateTypes };
//   }

//   // Search support
//   if (search) {
//     matchStage.$or = [
//       { title: { $regex: search, $options: "i" } },
//       { templateType: { $regex: search, $options: "i" } },
//       { description: { $regex: search, $options: "i" } }
//     ];
//   }

//   const pipeline: PipelineStage[] = [
//     { $match: matchStage },
//     { $match: { createdBy: "ADMIN" } },
//     {
//       $lookup: {
//         from: "certificates",
//         let: { templateId: { $toString: "$_id" } },
//         pipeline: [
//           {
//             $match: {
//               $expr: { $eq: ["$templateId", "$$templateId"] }
//             }
//           }
//         ],
//         as: "certificates"
//       }
//     },
//     {
//       $lookup: {
//         from: "invoices",
//         let: { templateId: { $toString: "$_id" } },
//         pipeline: [
//           {
//             $match: {
//               $expr: { $eq: ["$templateId", "$$templateId"] }
//             }
//           }
//         ],
//         as: "invoices"
//       }
//     },
//     { $addFields: { usedCount: { $size: "$certificates" } } },
//     { $addFields: { invoiceCount: { $size: "$invoices" } } },
//     { $project: { certificates: 0 } },
//     { $sort: { createdAt: -1 } }
//   ];

//   // Pagination is optional
//   if (options?.paginate !== false) {
//     pipeline.push({ $skip: skip }, { $limit: limit });
//   }

//   const templates = await TemplateModel.aggregate(pipeline);

//   const total = await TemplateModel.countDocuments(matchStage);
//   const totalPages = options?.paginate === false ? 1 : Math.ceil(total / limit);

//   return {
//     templates,
//     total,
//     page: options?.paginate === false ? 1 : page,
//     limit: options?.paginate === false ? total : limit,
//     totalPages
//   };
// };

const getTemplatesGroupedByType = async (
  query: Record<string, string>,
  organizationId: string,
  options?: {
    templateTypes?: TemplateType[];
    paginate?: boolean;
  }
) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = query.search?.trim();

  const matchStage: any = {
    organizationId: new Types.ObjectId(organizationId),
    createdBy: "ADMIN"
  };

  if (options?.templateTypes?.length) {
    matchStage.templateType = { $in: options.templateTypes };
  }

  if (search) {
    matchStage.$or = [
      { title: { $regex: search, $options: "i" } },
      { templateType: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } }
    ];
  }

  const pipeline: PipelineStage[] = [
    { $match: matchStage },

    {
      $lookup: {
        from: "certificates",
        localField: "_id",
        foreignField: "templateId",
        as: "certificates"
      }
    },

    {
      $lookup: {
        from: "invoices",
        localField: "_id",
        foreignField: "templateId",
        as: "invoices"
      }
    },

    {
      $addFields: {
        certificateUsageCount: { $size: "$certificates" },
        invoiceUsageCount: { $size: "$invoices" }
      }
    },

    {
      $project: {
        certificates: 0,
        invoices: 0
      }
    },

    { $sort: { createdAt: -1 } }
  ];

  if (options?.paginate !== false) {
    pipeline.push({ $skip: skip }, { $limit: limit });
  }

  const templates = await TemplateModel.aggregate(pipeline);
  const total = await TemplateModel.countDocuments(matchStage);

  return {
    templates,
    total,
    page: options?.paginate === false ? 1 : page,
    limit: options?.paginate === false ? total : limit,
    totalPages: options?.paginate === false ? 1 : Math.ceil(total / limit)
  };
};

const getSATemplates = async (query: Record<string, string>) => {
  const queryBuilder = new QueryBuilder(TemplateModel.find({ createdBy: "SUPER_ADMIN" }), query);
  const searchableFields = ["title", "templateType", "description"];
  const templates = await queryBuilder.search(searchableFields).filter().sort().select().pagination().build();
  const meta = await queryBuilder.getMeta();
  return {
    templates,
    ...meta
  };
};

const getTemplateById = async (templateId: string) => {
  const template = await TemplateModel.findById(templateId);
  if (!template) {
    throw new AppError(httpStatus.NOT_FOUND, "NOT_FOUND", "Template not found");
  }
  return template;
};

const updateTemplate = async (templateId: string, updateData: Partial<CreateTemplateInput>) => {
  const template = await TemplateModel.findById(templateId);
  if (!template) {
    throw new AppError(httpStatus.NOT_FOUND, "NOT_FOUND", "Template not found");
  }

  // If updating with new file(s), delete old ones from R2
  if (updateData.templateUrl && updateData.templateKey && template.templateKey) {
    await CloudflareService.deleteFileFromR2(template.templateKey);
  }

  if (updateData.templatePage2Url && updateData.templatePage2Key && template.templatePage2Key) {
    await CloudflareService.deleteFileFromR2(template.templatePage2Key);
  }

  Object.assign(template, updateData);
  await template.save();

  return template;
};

const deleteTemplate = async (templateId: string) => {
  const template = await TemplateModel.findById(templateId);
  if (!template) {
    throw new AppError(httpStatus.NOT_FOUND, "NOT_FOUND", "Template not found");
  }

  // Delete file(s) from R2
  if (template.templateKey) {
    await CloudflareService.deleteFileFromR2(template.templateKey);
  }

  if (template.templatePage2Key) {
    await CloudflareService.deleteFileFromR2(template.templatePage2Key);
  }

  await TemplateModel.findByIdAndDelete(templateId);
};

export const TemplateServices = {
  uploadTemplate,
  getTemplatesGroupedByType,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  getDefaultPlaceholders,
  getSATemplates
};
