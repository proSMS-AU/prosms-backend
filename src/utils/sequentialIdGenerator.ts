import { CounterModel } from "../model/counter.model";

interface GenerateIdOptions {
  key: string; // e.g. "invoice", "order", "certificate"
  prefix: string; // e.g. "inv", "ord", "cert"
  middleIndicator?: string; // e.g. A for auto , M for manual in invoice
  pad?: number; // default 6
}

// export const generateSequentialId = async ({
//   key,
//   prefix,
//   middleIndicator,
//   pad = 6
// }: GenerateIdOptions): Promise<string> => {
//   const counter = await CounterModel.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true });

//   const number = counter.seq.toString().padStart(pad, "0");
//   return `${prefix}-${middleIndicator ?? ""}${number}`;
// };

export const generateSequentialId = async ({
  key,
  prefix,
  middleIndicator,
  pad = 6
}: GenerateIdOptions): Promise<string> => {
  const counter = await CounterModel.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true });

  const seq = counter.seq;
  const dynamicPad = Math.max(pad, seq.toString().length);
  const number = seq.toString().padStart(dynamicPad, "0");

  return `${prefix}-${middleIndicator ?? ""}${number}`;
};
