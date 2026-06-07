import { Request, Response } from "express";
import { SendSuccessResponse } from "../utils";
import {
  COUNTRY_INDEX_VERSION,
  COUNTRY_OPTIONS,
  LANGUAGE_INDEX_VERSION,
  LANGUAGE_OPTIONS
} from "../services/referenceData.service";

// SACC country list (country of birth / citizenship). Static classification data —
// `version` lets the frontend cache aggressively and only refetch when it changes.
const countriesHandler = async (_req: Request, res: Response) =>
  SendSuccessResponse.success({
    res,
    message: "Country reference data retrieved successfully!",
    data: { version: COUNTRY_INDEX_VERSION, options: COUNTRY_OPTIONS }
  });

// ASCL language list (language identifier).
const languagesHandler = async (_req: Request, res: Response) =>
  SendSuccessResponse.success({
    res,
    message: "Language reference data retrieved successfully!",
    data: { version: LANGUAGE_INDEX_VERSION, options: LANGUAGE_OPTIONS }
  });

export const referenceDataController = {
  countriesHandler,
  languagesHandler
};
