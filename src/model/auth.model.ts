import { getModelForClass, ModelOptions, Prop } from "@typegoose/typegoose";

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
}
export const AuthModel = getModelForClass(Auth);
