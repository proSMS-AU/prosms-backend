import { Prop, getModelForClass, ModelOptions, Index } from "@typegoose/typegoose";
import mongoose from "mongoose";
import { Organization } from "./organization.model";

@Index({ organizationId: 1, locationId: 1 }, { unique: true })
@ModelOptions({
  schemaOptions: {
    collection: "locations",
    timestamps: true,
    versionKey: false
  }
})
export class Location {
  @Prop({
    ref: () => Organization,
    required: true
  })
  organizationId: mongoose.Types.ObjectId;

  @Prop({ required: true })
  locationId: string;

  @Prop({
    required: true
  })
  addressLine: string;

  @Prop()
  building?: string;

  @Prop()
  unit?: string;

  @Prop()
  street?: string;

  @Prop()
  POBox?: string;

  @Prop()
  city?: string;

  @Prop()
  state?: string;

  @Prop()
  postcode?: string;

  @Prop({
    required: true
  })
  country: string;
}
export const LocationModel = getModelForClass(Location);
