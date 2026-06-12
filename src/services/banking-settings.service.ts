import { BankingSettingsModel } from "../model/banking-settings.model";

type BankingDetailsInput = {
  bankName?: string;
  bsb?: string;
  accountNumber?: string;
  accountName?: string;
  signature?: string;
};

const getBankingSettings = async () => {
  // findOneAndUpdate with upsert=true ensures we always return a document
  // even if one has never been saved yet.
  const doc = await BankingSettingsModel.findOneAndUpdate({}, { $setOnInsert: {} }, { upsert: true, new: true }).lean();
  return doc;
};

const upsertBankingSettings = async (data: BankingDetailsInput) => {
  const update: Record<string, string> = {};
  if (data.bankName !== undefined) update.bankName = data.bankName;
  if (data.bsb !== undefined) update.bsb = data.bsb;
  if (data.accountNumber !== undefined) update.accountNumber = data.accountNumber;
  if (data.accountName !== undefined) update.accountName = data.accountName;
  if (data.signature !== undefined) update.signature = data.signature;

  const doc = await BankingSettingsModel.findOneAndUpdate({}, { $set: update }, { upsert: true, new: true }).lean();
  return doc;
};

export const BankingSettingsService = {
  getBankingSettings,
  upsertBankingSettings
};
