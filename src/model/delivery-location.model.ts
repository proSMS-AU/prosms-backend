import { Prop, ModelOptions, Index, getModelForClass } from "@typegoose/typegoose";
import mongoose from "mongoose";
import { Organization } from "./organization.model";

@Index({ organizationId: 1, locationIdentifier: 1 }, { unique: true })
@ModelOptions({
  schemaOptions: {
    collection: "delivery_locations",
    timestamps: true,
    versionKey: false
  }
})
export class DeliveryLocation {
  @Prop({ ref: () => Organization, required: true })
  organizationId: mongoose.Types.ObjectId;

  // 10-char identifier written to NAT00020 pos 11 and referenced in NAT00120 (R-15)
  // Format: LOC-000001 (LOC + hyphen + 6-digit zero-padded counter = 10 chars)
  @Prop({ required: true, type: String, maxlength: 10 })
  locationIdentifier: string;

  @Prop({ required: true, type: String })
  name: string;

  // Address fields used in NAT00020 (city/state/postcode required per spec)
  @Prop({ type: String })
  address?: string;

  @Prop({ type: String, required: true })
  city: string;

  @Prop({ type: String, required: true })
  state: string;

  @Prop({ type: String, required: true })
  postcode: string;

  @Prop({ type: Boolean, default: false })
  isDeleted?: boolean;

  @Prop({ type: Boolean, default: true })
  isActive?: boolean;
}

export const DeliveryLocationModel = getModelForClass(DeliveryLocation);
