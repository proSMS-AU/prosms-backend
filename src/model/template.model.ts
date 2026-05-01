import { Prop, getModelForClass, ModelOptions } from "@typegoose/typegoose";
import { Organization } from "./organization.model";
import mongoose from "mongoose";

export enum TemplateType {
  ATTAINMENT = "ATTAINMENT",
  CERTIFICATE_SINGLE = "CERTIFICATE_SINGLE",
  CERTIFICATE_DOUBLE = "CERTIFICATE_DOUBLE",
  INVOICE = "INVOICE"
}

@ModelOptions({
  schemaOptions: {
    collection: "templates",
    timestamps: true,
    versionKey: false
  }
})
export class Template {
  @Prop({
    required: true,
    type: String,
    enum: ["SUPER_ADMIN", "ADMIN"]
  })
  createdBy: "SUPER_ADMIN" | "ADMIN";

  @Prop({
    required: true,
    type: String,
    trim: true
  })
  title: string;

  @Prop({
    required: true,
    enum: TemplateType,
    type: String
  })
  templateType: TemplateType;

  // for Main template ( ATTAINMENT and CERTIFICATE_SINGLE)
  @Prop({
    required: true,
    type: String
  })
  templateUrl: string;

  @Prop({
    required: true,
    type: String
  })
  templateKey: string;

  // Second page template (for CERTIFICATE_DOUBLE)
  @Prop({
    required: false,
    type: String
  })
  templatePage2Url?: string;

  @Prop({
    required: false,
    type: String
  })
  templatePage2Key?: string;

  // Indicates if this template requires merging (CERTIFICATE_DOUBLE)
  @Prop({
    required: true,
    type: Boolean,
    default: false
  })
  isMultiPageTemplate: boolean;

  @Prop({
    required: false,
    type: String,
    default: ""
  })
  description?: string;

  @Prop({
    ref: () => Organization,
    required: true
  })
  organizationId: mongoose.Types.ObjectId;

  @Prop({
    required: true,
    type: [String],
    default: []
  })
  placeholders: string[];
}
export const TemplateModel = getModelForClass(Template);
