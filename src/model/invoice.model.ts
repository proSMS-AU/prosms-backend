import { Prop, getModelForClass, ModelOptions } from "@typegoose/typegoose";
import mongoose, { Types } from "mongoose";
import { invoiceTypes } from "../constants";
import { Organization } from "./organization.model";
import { Student } from "./student.model";
import { classModel } from "./class.model";
import { Template } from "./template.model";

class StudentAddress {
  @Prop({ required: true })
  street: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  postcode: string;

  @Prop({ required: true })
  country: string;
}

class StudentSnapshotData {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop({
    required: true,
    type: () => StudentAddress,
    _id: false
  })
  address: StudentAddress;
}

@ModelOptions({
  schemaOptions: {
    collection: "invoices",
    timestamps: true,
    versionKey: false
  }
})
export class Invoice {
  @Prop({
    required: true,
    enum: ["SUPER_ADMIN", "ADMIN"]
  })
  createdBy: "SUPER_ADMIN" | "ADMIN";

  @Prop({
    ref: () => Organization,
    required: false
  })
  organizationId?: mongoose.Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: invoiceTypes
  })
  invoiceType: (typeof invoiceTypes)[number];

  @Prop({
    ref: () => classModel
  })
  classIds?: Types.ObjectId[];

  @Prop({
    ref: () => Student
  })
  studentId?: mongoose.Types.ObjectId;

  @Prop({
    type: () => StudentSnapshotData,
    _id: false
  })
  studentSnapshot?: StudentSnapshotData;

  @Prop({
    required: true
  })
  invoiceId: string;

  @Prop({
    ref: () => Template,
    required: true
  })
  templateId: mongoose.Types.ObjectId;

  @Prop({ required: true })
  invoiceKey: string;
}
export const InvoiceModel = getModelForClass(Invoice);
