import { Router, Request, Response } from "express";
import { SendErrorResponse } from "../utils";

const router = Router();

const NOMINATIM_URL = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";

router.get("/autocomplete", async (req: Request, res: Response) => {
  const q = ((req.query.q as string) ?? "").trim();

  if (!q || q.length < 3) {
    return res.json([]);
  }

  const url = `${NOMINATIM_URL}/search?format=jsonv2&addressdetails=1&countrycodes=au&limit=5&q=${encodeURIComponent(q)}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "ProSMS-RTO-App/1.0 (admin@prosms.com.au)",
        "Accept-Language": "en-AU",
        Accept: "application/json"
      }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json([]);
    }

    const data = await upstream.json();
    return res.json(data);
  } catch {
    return SendErrorResponse.internalServer({
      res,
      message: "Address lookup failed",
      data: { clientError: { code: "ADDRESS_LOOKUP_FAILED", message: "Could not reach address service" } }
    });
  }
});

export default router;
