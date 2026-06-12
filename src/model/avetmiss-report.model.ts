import { Prop, ModelOptions, getModelForClass, Index } from "@typegoose/typegoose";
import { Organization } from "./organization.model";
import mongoose from "mongoose";

@Index({ organizationId: 1, reportId: 1 }, { unique: true })
@ModelOptions({
  schemaOptions: {
    collection: "avetmiss_reports",
    timestamps: true,
    versionKey: false
  }
})
export class AvetmissReport {
  @Prop({ required: true })
  title: string;

  @Prop({
    ref: () => Organization,
    required: true
  })
  organizationId: mongoose.Types.ObjectId;

  @Prop({ required: true })
  reportId: string;

  @Prop({ required: true })
  reportType: string; // "AVETMISS" (extendable for future report types)
  @Prop({ required: true })
  startDate: Date;
  @Prop({ required: true })
  endDate: Date;
  @Prop({ required: true })
  periodLabel: string; // e.g. "Jan – Jun 2025", "Custom: 01/03/2025 – 30/09/2025"
  @Prop({ required: true })
  reportKey: string; // Cloudflare R2 key for the ZIP file containing all NAT files
  @Prop({ required: true })
  generatedBy: string; // userId who triggered the report
  @Prop()
  totalStudents?: number;
  @Prop()
  totalEnrolments?: number;
  @Prop()
  totalCompletions?: number;
  @Prop({
    enum: ["generating", "completed", "failed"],
    default: "completed"
  })
  status: string;

  @Prop({ required: true, default: false })
  isImported: boolean;

  @Prop({ required: true, default: "NCVER", enum: ["NCVER", "STA"] })
  destination: string;

  @Prop()
  destinationState?: string;
}
export const AvetmissReportModel = getModelForClass(AvetmissReport);

/*
nat00010
nat00010A
nat00020
nat00030
nat00030A
nat00060
nat00080
nat00085
nat00090
nat00100
nat00120
nat00130

*/
