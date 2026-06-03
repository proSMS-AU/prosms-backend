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

  // S5: full lifecycle — pending → generated → sent → configured; or rejected
  @Prop({
    required: true,
    type: String,
    enum: ["pending", "generated", "sent", "configured", "rejected"]
  })
  status: "pending" | "generated" | "sent" | "configured" | "rejected";
}

export const SSIDRequestModel = getModelForClass(SSIDRequest);
