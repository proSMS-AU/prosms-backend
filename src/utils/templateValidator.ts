// import { TemplateType } from "../model/template.model";
// import { AppError } from "./appError";
// import { httpStatus } from "../constants";

// const REQUIRED_PLACEHOLDERS = {
//   [TemplateType.ATTAINMENT]: [
//     "CLI_NAME",
//     "U1",
//     "U2",
//     "U3",
//     "U4",
//     "U5",
//     "U6",
//     "U7",
//     "U8",
//     "U9",
//     "U10",
//     "UNAME1",
//     "UNAME2",
//     "UNAME3",
//     "UNAME4",
//     "UNAME5",
//     "UNAME6",
//     "UNAME7",
//     "UNAME8",
//     "UNAME9",
//     "UNAME10",
//     "URES1",
//     "URES2",
//     "URES3",
//     "URES4",
//     "URES5",
//     "URES6",
//     "URES7",
//     "URES8",
//     "URES9",
//     "URES10",
//     "COURSE_ID",
//     "QUAL_LEVEL",
//     "SEPARATOR_NAME",
//     "COURSE_NAME",
//     "STREAM",
//     "QR_CODE",
//     "MAX_DATE",
//     "CERT_NO"
//   ],
//   [TemplateType.CERTIFICATE_SINGLE]: [
//     "CLI_NAME",
//     "U1",
//     "U2",
//     "U3",
//     "U4",
//     "U5",
//     "U6",
//     "U7",
//     "U8",
//     "U9",
//     "U10",
//     "UNAME1",
//     "UNAME2",
//     "UNAME3",
//     "UNAME4",
//     "UNAME5",
//     "UNAME6",
//     "UNAME7",
//     "UNAME8",
//     "UNAME9",
//     "UNAME10",
//     "URES1",
//     "URES2",
//     "URES3",
//     "URES4",
//     "URES5",
//     "URES6",
//     "URES7",
//     "URES8",
//     "URES9",
//     "URES10",
//     "COURSE_ID",
//     "QUAL_LEVEL",
//     "SEPARATOR_NAME",
//     "COURSE_NAME",
//     "STREAM",
//     "QR_CODE",
//     "MAX_DATE",
//     "CERT_NO"
//   ],
//   [TemplateType.CERTIFICATE_DOUBLE]: [
//     "CLI_NAME",
//     "U1",
//     "U2",
//     "U3",
//     "U4",
//     "U5",
//     "U6",
//     "U7",
//     "U8",
//     "U9",
//     "U10",
//     "UNAME1",
//     "UNAME2",
//     "UNAME3",
//     "UNAME4",
//     "UNAME5",
//     "UNAME6",
//     "UNAME7",
//     "UNAME8",
//     "UNAME9",
//     "UNAME10",
//     "URES1",
//     "URES2",
//     "URES3",
//     "URES4",
//     "URES5",
//     "URES6",
//     "URES7",
//     "URES8",
//     "URES9",
//     "URES10",
//     "COURSE_ID",
//     "QUAL_LEVEL",
//     "SEPARATOR_NAME",
//     "COURSE_NAME",
//     "STREAM",
//     "QR_CODE",
//     "MAX_DATE",
//     "CERT_NO"
//   ],
// };

// export const validateTemplatePlaceholders = (
//   templateType: TemplateType,
//   templatePlaceholders: string[]
// ): { isValid: boolean; missingPlaceholders: string[] } => {
//   const requiredPlaceholders = REQUIRED_PLACEHOLDERS[templateType];

//   const missingPlaceholders = requiredPlaceholders.filter((placeholder) => !templatePlaceholders.includes(placeholder));

//   return {
//     isValid: missingPlaceholders.length === 0,
//     missingPlaceholders
//   };
// };

// export const throwIfInvalidTemplate = (templateType: TemplateType, templatePlaceholders: string[]) => {
//   const validation = validateTemplatePlaceholders(templateType, templatePlaceholders);

//   if (!validation.isValid) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "INVALID_TEMPLATE",
//       `Template is missing required placeholders: ${validation.missingPlaceholders.join(", ")}`
//     );
//   }
// };

// // import { TemplateType } from "../model/template.model";
// import { AppError } from "./appError";
// import { httpStatus } from "../constants";

// // Page 1 placeholders (Student & Course Info) - for CERTIFICATE_DOUBLE
// const CERTIFICATE_PAGE1_PLACEHOLDERS = [
//   "CLI_NAME",
//   "COURSE_ID",
//   "QUAL_LEVEL",
//   "SEPARATOR_WORD",
//   // "SEPARATOR_NAME",
//   "COURSE_NAME",
//   "STREAM",
//   "QR_CODE",
//   "_dtCompleted",
//   "CERT_NO",
//   // "MAX_DATE"
// ];

// // Page 2 placeholders (Record of Results) - for CERTIFICATE_DOUBLE
// const CERTIFICATE_PAGE2_PLACEHOLDERS = [
//   "U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9", "U10",
//   "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18", "U19", "U20",
//   "U21", "U22", "U23", "U24", "U25", "U26", "U27", "U28", "U29", "U30",
//   "UNAME1", "UNAME2", "UNAME3", "UNAME4", "UNAME5", "UNAME6", "UNAME7", "UNAME8", "UNAME9", "UNAME10",
//   "UNAME11", "UNAME12", "UNAME13", "UNAME14", "UNAME15", "UNAME16", "UNAME17", "UNAME18", "UNAME19", "UNAME20",
//   "UNAME21", "UNAME22", "UNAME23", "UNAME24", "UNAME25", "UNAME26", "UNAME27", "UNAME28", "UNAME29", "UNAME30",
//   "URES1", "URES2", "URES3", "URES4", "URES5", "URES6", "URES7", "URES8", "URES9", "URES10",
//   "URES11", "URES12", "URES13", "URES14", "URES15", "URES16", "URES17", "URES18", "URES19", "URES20",
//   "URES21", "URES22", "URES23", "URES24", "URES25", "URES26", "URES27", "URES28", "URES29", "URES30",
//   "CLI_NAME",
//   "COURSE_ID",
//   "QUAL_LEVEL",
//   "MAX_DATE"
// ];

// // Full placeholders for single-document templates
// const REQUIRED_PLACEHOLDERS = {
//   [TemplateType.ATTAINMENT]: [
//     "CLI_NAME",
//     "U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9", "U10",
//     "UNAME1", "UNAME2", "UNAME3", "UNAME4", "UNAME5", "UNAME6", "UNAME7", "UNAME8", "UNAME9", "UNAME10",
//     "URES1", "URES2", "URES3", "URES4", "URES5", "URES6", "URES7", "URES8", "URES9", "URES10",
//     "COURSE_ID",
//     "QUAL_LEVEL",
//     "SEPARATOR_NAME",
//     "COURSE_NAME",
//     "STREAM",
//     "QR_CODE",
//     "MAX_DATE",
//     "CERT_NO"
//   ],
//   [TemplateType.CERTIFICATE_SINGLE]: [
//     "CLI_NAME",
//     "COURSE_ID",
//     "QUAL_LEVEL",
//     "SEPARATOR_WORD",
//     "SEPARATOR_NAME",
//     "COURSE_NAME",
//     "STREAM",
//     "QR_CODE",
//     "_dtCompleted",
//     "CERT_NO",
//     "MAX_DATE",
//     "U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9", "U10",
//     "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18", "U19", "U20",
//     "U21", "U22", "U23", "U24", "U25", "U26", "U27", "U28", "U29", "U30",
//     "UNAME1", "UNAME2", "UNAME3", "UNAME4", "UNAME5", "UNAME6", "UNAME7", "UNAME8", "UNAME9", "UNAME10",
//     "UNAME11", "UNAME12", "UNAME13", "UNAME14", "UNAME15", "UNAME16", "UNAME17", "UNAME18", "UNAME19", "UNAME20",
//     "UNAME21", "UNAME22", "UNAME23", "UNAME24", "UNAME25", "UNAME26", "UNAME27", "UNAME28", "UNAME29", "UNAME30",
//     "URES1", "URES2", "URES3", "URES4", "URES5", "URES6", "URES7", "URES8", "URES9", "URES10",
//     "URES11", "URES12", "URES13", "URES14", "URES15", "URES16", "URES17", "URES18", "URES19", "URES20",
//     "URES21", "URES22", "URES23", "URES24", "URES25", "URES26", "URES27", "URES28", "URES29", "URES30"
//   ]
// };

// export const validateTemplatePlaceholders = (
//   templateType: TemplateType,
//   templatePlaceholders: string[]
// ): { isValid: boolean; missingPlaceholders: string[] } => {
//   const requiredPlaceholders = REQUIRED_PLACEHOLDERS[templateType as keyof typeof REQUIRED_PLACEHOLDERS];

//   if (!requiredPlaceholders) {
//     // CERTIFICATE_DOUBLE should not use this function
//     return { isValid: true, missingPlaceholders: [] };
//   }

//   const missingPlaceholders = requiredPlaceholders.filter(
//     (placeholder:any) => !templatePlaceholders.includes(placeholder)
//   );

//   return {
//     isValid: missingPlaceholders.length === 0,
//     missingPlaceholders
//   };
// };

// // Separate validation for CERTIFICATE_DOUBLE pages
// export const validateCertificatePage1 = (
//   templatePlaceholders: string[]
// ): { isValid: boolean; missingPlaceholders: string[] } => {
//   const missingPlaceholders = CERTIFICATE_PAGE1_PLACEHOLDERS.filter(
//     (placeholder) => !templatePlaceholders.includes(placeholder)
//   );

//   return {
//     isValid: missingPlaceholders.length === 0,
//     missingPlaceholders
//   };
// };

// export const validateCertificatePage2 = (
//   templatePlaceholders: string[]
// ): { isValid: boolean; missingPlaceholders: string[] } => {
//   const missingPlaceholders = CERTIFICATE_PAGE2_PLACEHOLDERS.filter(
//     (placeholder) => !templatePlaceholders.includes(placeholder)
//   );

//   return {
//     isValid: missingPlaceholders.length === 0,
//     missingPlaceholders
//   };
// };

// // Main validation function
// export const throwIfInvalidTemplate = (
//   templateType: TemplateType,
//   templatePlaceholders: string[],
//   isPage2: boolean = false
// ) => {
//   if (templateType === TemplateType.CERTIFICATE_DOUBLE) {
//     const validation = isPage2
//       ? validateCertificatePage2(templatePlaceholders)
//       : validateCertificatePage1(templatePlaceholders);

//     if (!validation.isValid) {
//       const pageName = isPage2 ? "Page 2 (Record of Results)" : "Page 1 (Student & Course Info)";
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         "INVALID_TEMPLATE",
//         `${pageName} is missing required placeholders: ${validation.missingPlaceholders.join(", ")}`
//       );
//     }
//   } else {
//     const validation = validateTemplatePlaceholders(templateType, templatePlaceholders);

//     if (!validation.isValid) {
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         "INVALID_TEMPLATE",
//         `Template is missing required placeholders: ${validation.missingPlaceholders.join(", ")}`
//       );
//     }
//   }
// };

import { TemplateType } from "../model/template.model";
import { AppError } from "./appError";
import { httpStatus } from "../constants";

// Page 1 placeholders (Student & Course Info) - for CERTIFICATE_DOUBLE
const CERTIFICATE_PAGE1_PLACEHOLDERS = [
  "CLI_NAME",
  "COURSE_ID",
  "QUAL_LEVEL",
  "SEPARATOR_WORD",
  "COURSE_NAME",
  "STREAM",
  "QR_CODE",
  "_dtCompleted",
  "CERT_NO"
];

// Page 2 placeholders (Record of Results) - for CERTIFICATE_DOUBLE
const CERTIFICATE_PAGE2_PLACEHOLDERS = [
  "U1",
  "U2",
  "U3",
  "U4",
  "U5",
  "U6",
  "U7",
  "U8",
  "U9",
  "U10",
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "U17",
  "U18",
  "U19",
  "U20",
  "U21",
  "U22",
  "U23",
  "U24",
  "U25",
  "U26",
  "U27",
  "U28",
  "U29",
  "U30",
  "UNAME1",
  "UNAME2",
  "UNAME3",
  "UNAME4",
  "UNAME5",
  "UNAME6",
  "UNAME7",
  "UNAME8",
  "UNAME9",
  "UNAME10",
  "UNAME11",
  "UNAME12",
  "UNAME13",
  "UNAME14",
  "UNAME15",
  "UNAME16",
  "UNAME17",
  "UNAME18",
  "UNAME19",
  "UNAME20",
  "UNAME21",
  "UNAME22",
  "UNAME23",
  "UNAME24",
  "UNAME25",
  "UNAME26",
  "UNAME27",
  "UNAME28",
  "UNAME29",
  "UNAME30",
  "URES1",
  "URES2",
  "URES3",
  "URES4",
  "URES5",
  "URES6",
  "URES7",
  "URES8",
  "URES9",
  "URES10",
  "URES11",
  "URES12",
  "URES13",
  "URES14",
  "URES15",
  "URES16",
  "URES17",
  "URES18",
  "URES19",
  "URES20",
  "URES21",
  "URES22",
  "URES23",
  "URES24",
  "URES25",
  "URES26",
  "URES27",
  "URES28",
  "URES29",
  "URES30",
  "CLI_NAME",
  "COURSE_ID",
  "QUAL_LEVEL",
  "SEPARATOR_NAME",
  "MAX_DATE"
];

// Full placeholders for single-document templates
const REQUIRED_PLACEHOLDERS = {
  [TemplateType.ATTAINMENT]: [
    "CLI_NAME",
    "U1",
    "U2",
    "U3",
    "U4",
    "U5",
    "U6",
    "U7",
    "U8",
    "U9",
    "U10",
    "UNAME1",
    "UNAME2",
    "UNAME3",
    "UNAME4",
    "UNAME5",
    "UNAME6",
    "UNAME7",
    "UNAME8",
    "UNAME9",
    "UNAME10",
    "URES1",
    "URES2",
    "URES3",
    "URES4",
    "URES5",
    "URES6",
    "URES7",
    "URES8",
    "URES9",
    "URES10",
    "COURSE_ID",
    "QUAL_LEVEL",
    "SEPARATOR_NAME",
    "COURSE_NAME",
    "STREAM",
    "QR_CODE",
    "MAX_DATE",
    "CERT_NO"
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
    "U1",
    "U2",
    "U3",
    "U4",
    "U5",
    "U6",
    "U7",
    "U8",
    "U9",
    "U10",
    "U11",
    "U12",
    "U13",
    "U14",
    "U15",
    "U16",
    "U17",
    "U18",
    "U19",
    "U20",
    "U21",
    "U22",
    "U23",
    "U24",
    "U25",
    "U26",
    "U27",
    "U28",
    "U29",
    "U30",
    "UNAME1",
    "UNAME2",
    "UNAME3",
    "UNAME4",
    "UNAME5",
    "UNAME6",
    "UNAME7",
    "UNAME8",
    "UNAME9",
    "UNAME10",
    "UNAME11",
    "UNAME12",
    "UNAME13",
    "UNAME14",
    "UNAME15",
    "UNAME16",
    "UNAME17",
    "UNAME18",
    "UNAME19",
    "UNAME20",
    "UNAME21",
    "UNAME22",
    "UNAME23",
    "UNAME24",
    "UNAME25",
    "UNAME26",
    "UNAME27",
    "UNAME28",
    "UNAME29",
    "UNAME30",
    "URES1",
    "URES2",
    "URES3",
    "URES4",
    "URES5",
    "URES6",
    "URES7",
    "URES8",
    "URES9",
    "URES10",
    "URES11",
    "URES12",
    "URES13",
    "URES14",
    "URES15",
    "URES16",
    "URES17",
    "URES18",
    "URES19",
    "URES20",
    "URES21",
    "URES22",
    "URES23",
    "URES24",
    "URES25",
    "URES26",
    "URES27",
    "URES28",
    "URES29",
    "URES30"
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

export const validateTemplatePlaceholders = (
  templateType: TemplateType,
  templatePlaceholders: string[]
): { isValid: boolean; missingPlaceholders: string[] } => {
  const requiredPlaceholders = REQUIRED_PLACEHOLDERS[templateType as keyof typeof REQUIRED_PLACEHOLDERS];

  if (!requiredPlaceholders) {
    // CERTIFICATE_DOUBLE should not use this function
    return { isValid: true, missingPlaceholders: [] };
  }

  const missingPlaceholders = requiredPlaceholders.filter(
    (placeholder: string) => !templatePlaceholders.includes(placeholder)
  );

  return {
    isValid: missingPlaceholders.length === 0,
    missingPlaceholders
  };
};

// Separate validation for CERTIFICATE_DOUBLE pages
export const validateCertificatePage1 = (
  templatePlaceholders: string[]
): { isValid: boolean; missingPlaceholders: string[] } => {
  const missingPlaceholders = CERTIFICATE_PAGE1_PLACEHOLDERS.filter(
    (placeholder) => !templatePlaceholders.includes(placeholder)
  );

  return {
    isValid: missingPlaceholders.length === 0,
    missingPlaceholders
  };
};

export const validateCertificatePage2 = (
  templatePlaceholders: string[]
): { isValid: boolean; missingPlaceholders: string[] } => {
  const missingPlaceholders = CERTIFICATE_PAGE2_PLACEHOLDERS.filter(
    (placeholder) => !templatePlaceholders.includes(placeholder)
  );

  return {
    isValid: missingPlaceholders.length === 0,
    missingPlaceholders
  };
};

// Main validation function
export const throwIfInvalidTemplate = (
  templateType: TemplateType,
  templatePlaceholders: string[],
  isPage2: boolean = false
) => {
  if (templateType === TemplateType.CERTIFICATE_DOUBLE) {
    const validation = isPage2
      ? validateCertificatePage2(templatePlaceholders)
      : validateCertificatePage1(templatePlaceholders);

    if (!validation.isValid) {
      const pageName = isPage2 ? "Page 2 (Record of Results)" : "Page 1 (Student & Course Info)";
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "INVALID_TEMPLATE",
        `${pageName} is missing required placeholders: ${validation.missingPlaceholders.join(", ")}`
      );
    }
  } else {
    const validation = validateTemplatePlaceholders(templateType, templatePlaceholders);

    if (!validation.isValid) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "INVALID_TEMPLATE",
        `Template is missing required placeholders: ${validation.missingPlaceholders.join(", ")}`
      );
    }
  }
};
