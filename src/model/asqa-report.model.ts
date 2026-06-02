import { Prop, ModelOptions, getModelForClass, Index, Severity } from "@typegoose/typegoose";
import { Organization } from "./organization.model";
import mongoose from "mongoose";

@Index({ reportId: 1, organizationId: 1 }, { unique: true })
@ModelOptions({
  schemaOptions: {
    collection: "asqa_reports",
    timestamps: true,
    versionKey: false
  },
  options: { allowMixed: Severity.ALLOW }
})
export class ASQAReport {
  @Prop({ required: true })
  title: string;

  @Prop({
    ref: () => Organization,
    required: true
  })
  organizationId: mongoose.Types.ObjectId;

  @Prop({ required: true })
  reportId: string;

  @Prop({
    required: true,
    enum: ["ALL", "DELIVERY_DATA", "STUDENT_SURVEY", "ENROLLMENT_COMPLETION"]
  })
  reportType: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ required: true })
  generatedBy: string;

  @Prop({ required: true })
  reportKey: string;

  @Prop({ required: true, default: false })
  isImported: boolean;

  // R-02: Light snapshot of class IDs used so the report can be re-identified even after data changes
  @Prop({ type: Object })
  snapshotData?: Record<string, unknown>;
}
export const ASQAReportModel = getModelForClass(ASQAReport);
