import Sqids from "sqids";
import { CounterModel } from "../model/counter.model";

interface GenerateIdOptions {
  key: string; // e.g. "invoice", "order", "certificate"
  prefix: string; // e.g. "inv", "ord", "cert"
  middleIndicator?: string; // e.g. A for auto , M for manual in invoice
  pad?: number; // default 6
}

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

// Deterministic alphabet shuffle seeded by orgId — same org always gets the same shuffle,
// so the same seq always produces the same studentId within that org.
const shuffleAlphabet = (alphabet: string, seed: string): string => {
  const chars = alphabet.split("");
  let hash = 0;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  for (let i = chars.length - 1; i > 0; i--) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const j = hash % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
};

export const generateStudentId = async (organizationId: string): Promise<string> => {
  const counter = await CounterModel.findOneAndUpdate(
    { key: `student:${organizationId}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const alphabet = shuffleAlphabet(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    organizationId.slice(-8)
  );
  const sqids = new Sqids({ alphabet, minLength: 6 });
  return `STU-${sqids.encode([counter.seq])}`;
};
