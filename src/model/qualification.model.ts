import { Prop, ModelOptions, getModelForClass } from "@typegoose/typegoose";
import { Organization } from "./organization.model";
import mongoose from "mongoose";

class LatestReleaseInfo {
  id: string;
  releaseDate: string;
  releaseNumber: string;
  packageInformation?: {
    core: string;
    elective: string;
    measure: string;
  } | null;
  workPlacementHours?: number | null;
}

@ModelOptions({
  schemaOptions: {
    collection: "qualifications",
    timestamps: true,
    versionKey: false
  }
})
export class Qualification {
  @Prop({
    ref: () => Organization,
    required: true
  })
  organizationId: mongoose.Types.ObjectId;

  @Prop({
    required: true
  })
  code: string;

  @Prop({
    required: true
  })
  title: string;

  @Prop({
    required: true
  })
  status: string;

  @Prop({
    default: " "
  })
  stream?: string;

  @Prop({
    type: () => LatestReleaseInfo,
    _id: false
  })
  latestReleaseInfo?: LatestReleaseInfo;

  @Prop()
  nominalHours?: number;
}
export const QualificationModel = getModelForClass(Qualification);
