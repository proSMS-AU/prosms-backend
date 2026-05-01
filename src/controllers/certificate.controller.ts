import { Request, Response } from "express";
import { CertificateServices } from "../services/certificate.service";
import { SendSuccessResponse } from "../utils";
import { CertificateModel } from "../model/certificate.model";
import { streamFromR2 } from "../services/cloudflare.service";
import { AppError } from "../utils/appError";
import { DATA_NOT_FOUND, httpStatus } from "../constants";
import config from "config";

const generateCertificatesHandler = async (req: Request, res: Response) => {
  const result = await CertificateServices.generateCertificates(req.body, req.user?.organizationId as string);

  SendSuccessResponse.success({
    res,
    message: result.summary.allSuccessful
      ? "All certificates generated successfully!"
      : "Certificate generation completed with some failures",
    data: result
  });
};

const getCertificatesByClassHandler = async (req: Request, res: Response) => {
  const { certificates, meta } = await CertificateServices.getCertificatesByClass(
    req.query as Record<string, string>,
    req.params.classId as string,
    req.user?.organizationId as string
  );
  SendSuccessResponse.success({
    res,
    message: "Certificates by class retrieved successfully!",
    data: certificates,
    meta
  });
};

const verifyCertificatedHandler = async (req: Request, res: Response) => {
  const certificate = await CertificateServices.verifyCertificate(req.params.id);

  const cert = await CertificateModel.findOne({ certificateShortId: req.params.id });

  if (!cert) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Certificate not found");
  }

  await streamFromR2(cert.certificateKey, res, req.query.download as unknown as boolean);

  SendSuccessResponse.success({
    res,
    message: "Certificate Verified!",
    data: certificate
  });
};

const sendCertificateToStudentEmailHandler = async (req: Request, res: Response) => {
  const url = await CertificateServices.sendCertificateToStudentEmail(req.body);
  SendSuccessResponse.success({
    res,
    message: "Certificate sent successfully!",
    data: url
  });
};

const getIssuedCertificatesListHandler = async (req: Request, res: Response) => {
  const { data, meta } = await CertificateServices.getIssuedCertificatesList(
    req.query as Record<string, string>,
    req.user?.organizationId as string
  );
  SendSuccessResponse.success({
    res,
    message: "Certificates list retrieved successfully!",
    data,
    meta
  });
};

const viewCertificateHandler = async (req: Request, res: Response) => {
  const cert = await CertificateModel.findOne({
    certificateShortId: req.params.shortId
  });
  if (!cert) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Certificate not found");
  }
  res.setHeader("Content-Security-Policy", `frame-ancestors ${config.get("server.clientUrl")}`);
  await streamFromR2(cert.certificateKey, res, Boolean(req.query.download));
};

const deleteCertificate = async (req: Request, res: Response) => {
  await CertificateServices.deleteCertificate(req.params.id);
  SendSuccessResponse.deleted({
    res,
    message: "Certificate deleted successfully!",
    data: null
  });
};

export const CertificateController = {
  generateCertificatesHandler,
  getCertificatesByClassHandler,
  verifyCertificatedHandler,
  sendCertificateToStudentEmailHandler,
  getIssuedCertificatesListHandler,
  viewCertificateHandler,
  deleteCertificate
};
