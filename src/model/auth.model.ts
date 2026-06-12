import { getModelForClass, ModelOptions, Prop } from "@typegoose/typegoose";

class TotpDevice {
  @Prop({ required: true, type: String })
  encryptedSecret: string;

  @Prop({ required: true, type: String })
  label: string;

  @Prop({ required: true, type: Date, default: Date.now })
  addedAt: Date;
}

class TwoFactorAuth {
  @Prop({ type: Boolean, default: false })
  twoFaEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  enabled: boolean;

  @Prop({ type: () => [TotpDevice], default: [], _id: false })
  devices: TotpDevice[];

  @Prop({ type: Boolean, default: false })
  emailOtpEnabled: boolean;
}

@ModelOptions({
  schemaOptions: {
    collection: "auth",
    timestamps: true,
    versionKey: false
  }
})
export class Auth {
  @Prop({
    required: true,
    type: String,
    trim: true
  })
  name: string;

  @Prop({
    required: true,
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  })
  email: string;

  @Prop({
    required: false
  })
  password?: string;

  @Prop({
    required: true,
    type: String
  })
  organizationId: string;

  @Prop({
    type: () => TwoFactorAuth,
    _id: false,
    default: () => ({ enabled: false, devices: [], emailOtpEnabled: false })
  })
  twoFactorAuth?: TwoFactorAuth;

  // Set to true when the org is soft-deleted — blocks login and all API access.
  @Prop({ type: Boolean, default: false })
  isDeleted?: boolean;
}
export const AuthModel = getModelForClass(Auth);
