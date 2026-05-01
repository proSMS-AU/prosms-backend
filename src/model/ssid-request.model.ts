import { Prop, ModelOptions, getModelForClass } from "@typegoose/typegoose";
import mongoose from "mongoose";
import { Organization } from "./organization.model";

@ModelOptions({
  schemaOptions: {
    collection: "ssid_requests",
    timestamps: true,
    versionKey: false
  }
})
export class SSIDRequest {
  @Prop({
    ref: () => Organization,
    required: true
  })
  organizationId: mongoose.Types.ObjectId;

  @Prop({
    required: true,
    type: String
  })
  rtoId: string;

  @Prop({
    required: true,
    type: String
  })
  organizationName: string;

  @Prop({
    required: true
  })
  ABN: string;

  @Prop({
    required: true,
    type: Date
  })
  requestDate: Date;

  @Prop({
    required: true,
    type: String,
    enum: ["pending", "approved", "rejected"]
  })
  status: "pending" | "approved" | "rejected";
}

export const SSIDRequestModel = getModelForClass(SSIDRequest);
