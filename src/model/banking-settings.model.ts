import { Prop, ModelOptions, getModelForClass } from "@typegoose/typegoose";

// Singleton document — there will always be exactly one record in this collection.
@ModelOptions({
  schemaOptions: {
    collection: "banking_settings",
    timestamps: true,
    versionKey: false
  }
})
export class BankingSettings {
  @Prop({ type: String, default: "" })
  bankName: string;

  @Prop({ type: String, default: "" })
  bsb: string;

  @Prop({ type: String, default: "" })
  accountNumber: string;

  @Prop({ type: String, default: "" })
  accountName: string;

  @Prop({ type: String, default: "" })
  signature: string;
}

export const BankingSettingsModel = getModelForClass(BankingSettings);
