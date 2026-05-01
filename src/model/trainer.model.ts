import { Prop, ModelOptions, getModelForClass } from "@typegoose/typegoose";
import { PhoneNumber } from "./common.model";
import { Organization } from "./organization.model";
import mongoose from "mongoose";

class PersonalInfo {
  @Prop({
    required: true,
    type: String
  })
  givenName: string;

  @Prop({
    required: false,
    type: String
  })
  middleName?: string;

  @Prop({
    required: true,
    type: String
  })
  surname: string;

  @Prop({
    required: false,
    type: String
  })
  preferredName?: string;

  @Prop({
    required: true,
    type: String,
    unique: true
  })
  email: string;

  @Prop({ type: () => PhoneNumber, _id: false })
  phone: PhoneNumber;

  @Prop({
    required: true,
    type: Boolean,
    default: true
  })
  currentlyWorking: boolean;

  @Prop({
    required: false,
    type: Date
  })
  startingDate?: Date;

  @Prop({
    required: false,
    type: Date
  })
  endDate?: Date;
}

class Address {
  @Prop({
    required: false,
    type: String
  })
  building?: string;

  @Prop({
    required: false,
    type: String
  })
  unit?: string;

  @Prop({
    required: true,
    type: String
  })
  street: string;

  @Prop({
    required: false,
    type: String
  })
  POBox?: string;

  @Prop({
    required: true,
    type: String
  })
  city: string;

  @Prop({
    required: true,
    type: String
  })
  state: string;

  @Prop({
    required: true,
    type: String
  })
  postCode: string;

  @Prop({
    required: true,
    type: String
  })
  country: string;
}

@ModelOptions({
  schemaOptions: {
    collection: "trainers",
    timestamps: true,
    versionKey: false
  }
})
export class Trainer {
  @Prop({
    ref: () => Organization,
    required: true
  })
  organizationId: mongoose.Types.ObjectId;

  @Prop({
    required: true
  })
  employeeId: string;

  @Prop({
    required: true,
    type: () => PersonalInfo,
    _id: false
  })
  personalInfo: PersonalInfo;

  @Prop({
    required: true,
    type: () => Address,
    _id: false
  })
  address: Address;
}

export const TrainerModel = getModelForClass(Trainer);
