import { ModelOptions, Prop, getModelForClass, Index } from "@typegoose/typegoose";

@Index({ createdAt: 1 }, { expireAfterSeconds: 600 })
@ModelOptions({
  schemaOptions: {
    collection: "otp_codes",
    timestamps: true,
    versionKey: false
  }
})
export class OtpCode {
  @Prop({ required: true, type: String, index: true })
  userId: string;

  @Prop({ required: true, type: String })
  hashedCode: string;

  @Prop({ required: true, type: String, enum: ["login", "email-otp-verify"] })
  purpose: string;

  @Prop({ required: true, type: Boolean, default: false })
  used: boolean;
}

export const OtpCodeModel = getModelForClass(OtpCode);
