import { Prop, ModelOptions, getModelForClass } from "@typegoose/typegoose";

@ModelOptions({
  schemaOptions: {
    collection: "counters",
    timestamps: true,
    versionKey: false
  }
})
class Counter {
  @Prop({
    required: true,
    type: String,
    unique: true
  })
  key: string;

  @Prop({
    type: Number,
    default: 0
  })
  seq: number;
}
export const CounterModel = getModelForClass(Counter);
