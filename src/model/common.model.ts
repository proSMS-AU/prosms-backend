import { Prop } from "@typegoose/typegoose";

export class Phone {
  @Prop({ type: String, required: true })
  countryCode: string;

  @Prop({ type: String, required: true })
  number: string;

  @Prop({ required: true, type: String })
  e164: string;
}

export class Address {
  @Prop({ type: String, required: true })
  addressLine1: string;

  @Prop({ type: String, required: false, default: null })
  addressLine2?: string | null;

  @Prop({ type: String, required: false, default: null })
  country?: string | null;

  @Prop({ type: String, required: false, default: null })
  city?: string | null;

  @Prop({ type: String, required: false, default: null })
  state?: string | null;

  @Prop({ type: String, required: false, default: null })
  zipCode?: string | null;
}

export class PhoneNumber {
  @Prop()
  countryCode?: string;

  @Prop()
  number?: string;

  @Prop()
  formattedNumber?: string;
}
