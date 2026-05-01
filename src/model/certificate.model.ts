import { Prop, getModelForClass, ModelOptions, Index } from "@typegoose/typegoose";
import mongoose from "mongoose";
import { Organization } from "./organization.model";
import { classModel } from "./class.model";
import { Student } from "./student.model";
import { Template } from "./template.model";

@Index({ organizationId: 1, certificateShortId: 1 }, { unique: true })
@ModelOptions({
  schemaOptions: {
    collection: "certificates",
    timestamps: true,
    versionKey: false
  }
})
export class Certificate {
  @Prop({
    ref: () => Organization,
    required: true
  })
  organizationId: mongoose.Types.ObjectId;

  @Prop({
    ref: () => classModel,
    required: true
  })
  classId: mongoose.Types.ObjectId;

  @Prop({
    ref: () => Student,
    required: true
  })
  studentId: mongoose.Types.ObjectId;

  @Prop({
    required: true
  })
  certificateShortId: string;

  @Prop({
    ref: () => Template,
    required: true
  })
  templateId: mongoose.Types.ObjectId;

  @Prop({
    required: true
  })
  certificateKey: string;

  @Prop({
    required: true
  })
  qrCodeUrl: string;

  @Prop({
    required: true
  })
  issuedDate: Date;
}
export const CertificateModel = getModelForClass(Certificate);
