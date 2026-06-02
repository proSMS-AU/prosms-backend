import { Router } from "express";
import { asyncWrapper } from "../utils";
import { TwoFactorController } from "../controllers/twoFactor.controller";

const router = Router();

router.get("/setup", asyncWrapper(TwoFactorController.setupHandler));
router.post("/verify-setup", asyncWrapper(TwoFactorController.verifySetupHandler));
router.get("/devices", asyncWrapper(TwoFactorController.getDevicesHandler));
router.delete("/devices/:index", asyncWrapper(TwoFactorController.removeDeviceHandler));

router.post("/email/send", asyncWrapper(TwoFactorController.sendEmailOtpHandler));
router.post("/email/verify", asyncWrapper(TwoFactorController.verifyEmailOtpHandler));
router.patch("/email/toggle", asyncWrapper(TwoFactorController.toggleEmailOtpHandler));
router.patch("/toggle", asyncWrapper(TwoFactorController.toggleGlobal2FAHandler));

export default router;
