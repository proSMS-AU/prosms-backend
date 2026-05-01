import { Prop, ModelOptions, getModelForClass } from "@typegoose/typegoose";
import { Qualification } from "./qualification.model";
import { Organization } from "./organization.model";

class UnitLink {
  @Prop({ required: true })
  rel: string;

  @Prop({ required: true })
  href: string;
}

@ModelOptions({
  schemaOptions: {
    collection: "units",
    timestamps: true,
    versionKey: false
  }
})
export class Unit {
  @Prop()
  id?: string;

  @Prop({
    ref: () => Qualification
  })
  qualificationId?: string;

  @Prop({
    ref: () => Organization
  })
  organizationId?: string;

  @Prop({
    required: true
  })
  code: string;

  @Prop({
    required: false,
    default: 10
  })
  hour: number;

  @Prop({
    required: true
  })
  hasPreRequisites: boolean;

  @Prop({
    required: true
  })
  isEssential: boolean;

  @Prop({
    required: true
  })
  isEssentialLabel: "Core" | "Elective";

  @Prop({ type: () => [UnitLink], _id: false, timestamps: false })
  links?: UnitLink[];

  @Prop()
  qualificationCode?: string;

  @Prop({
    required: true
  })
  title: string;

  @Prop({
    required: true
  })
  usageRecommendation: string;

  @Prop({
    required: true
  })
  usageRecommendationLabel: string;

  @Prop({
    required: true
  })
  status: string;

  @Prop({
    required: false,
    enum: ["Core", "Elective", "Custom", "Other"]
  })
  unitType?: "Core" | "Elective" | "Custom" | "Other";

  @Prop()
  fieldOfEducationId?: string;
}

export const UnitModel = getModelForClass(Unit);
