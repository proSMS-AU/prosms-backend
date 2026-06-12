import { Router } from "express";
import { Request, Response } from "express";
import { asyncWrapper, SendSuccessResponse } from "../utils";
import { BankingSettingsService } from "../services/banking-settings.service";

const router = Router();

router.get(
  "/",
  asyncWrapper(async (_req: Request, res: Response) => {
    const data = await BankingSettingsService.getBankingSettings();
    SendSuccessResponse.success({ res, message: "Banking settings retrieved", data });
  })
);

router.put(
  "/",
  asyncWrapper(async (req: Request, res: Response) => {
    const data = await BankingSettingsService.upsertBankingSettings(req.body);
    SendSuccessResponse.success({ res, message: "Banking settings updated", data });
  })
);

export default router;
