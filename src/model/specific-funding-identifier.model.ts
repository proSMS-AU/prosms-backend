import { Prop, ModelOptions, getModelForClass } from "@typegoose/typegoose";
import mongoose from "mongoose";
import { Organization } from "./organization.model";

// Required when fundingSourceNational is "13" (Commonwealth-funded) or "15" (state-specific).
// Written to NAT00120 pos 100–109 (10 chars). (R-12)
@ModelOptions({
  schemaOptions: {
    collection: "specific_funding_identifiers",
    timestamps: true,
    versionKey: false
  }
})
export class SpecificFundingIdentifier {
  @Prop({ ref: () => Organization, required: true })
  organizationId: mongoose.Types.ObjectId;

  // The 10-char code written to NAT00120
  @Prop({ required: true, type: String, maxlength: 10 })
  identifier: string;

  @Prop({ required: true, type: String })
  description: string;

  @Prop({ type: Date })
  effectiveFrom?: Date;

  @Prop({ type: Date })
  effectiveTo?: Date;

  @Prop({ type: Boolean, default: true })
  isActive?: boolean;
}

export const SpecificFundingIdentifierModel = getModelForClass(SpecificFundingIdentifier);
