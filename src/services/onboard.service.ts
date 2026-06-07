/* eslint-disable @typescript-eslint/no-explicit-any */
import jwt from "jsonwebtoken";
import config from "config";
import { ObjectId } from "mongodb";
import { hashPassword } from "better-auth/crypto";
import { sendEmail } from "../utils/sendEmail";
import { RegisterOrganizationInput, SendOnboardUrlInput, TokenPayload } from "../schemas/super-admin/onboard.schema";
import { OrganizationModel } from "../model/organization.model";
import { QualificationModel } from "../model/qualification.model";
import { UnitModel } from "../model/unit.model";
import mongoose from "mongoose";
import { AppError } from "../utils/appError";
import { CONFLICT_ERROR, httpStatus } from "../constants";
import { CloudflareService } from "./cloudflare.service";

// generate onboard token
const generateOnboardToken = (data: SendOnboardUrlInput) => {
  const tokenPayload = {
    rto: data.rto,
    email: data.email
  };

  return jwt.sign(tokenPayload, config.get("server.onboardTokenSecret") as string, {
    expiresIn: config.get("server.onboardTokenExpiry")
  });
};

const sendOnboardTokenToUser = async (data: SendOnboardUrlInput) => {
  const isOrganizationExistWithEmail = await OrganizationModel.findOne({ email: data.email });
  if (isOrganizationExistWithEmail) {
    throw new AppError(httpStatus.CONFLICT, CONFLICT_ERROR.code, "Organization already exist with this email");
  }

  const isOrganizationExistWithRTO = await OrganizationModel.findOne({ rtoId: data.rto });
  if (isOrganizationExistWithRTO) {
    throw new AppError(httpStatus.CONFLICT, CONFLICT_ERROR.code, "Organization already exist with this RTO");
  }
  const token = generateOnboardToken(data);

  const onboardUrl = `${config.get("server.clientUrl")}/organization/onboarding?token=${token}`;

  // Sends via Resend.
  sendEmail({
    to: data.email,
    subject: "Onboard Verification",
    templateName: "onboardToken.template",
    templateData: {
      onboardUrl
    }
  });

  return { url: onboardUrl };
};

export const verifyOnboardToken = async (token: string) => {
  try {
    const decoded = jwt.verify(token, config.get("server.onboardTokenSecret") as string) as TokenPayload;

    return {
      rto: decoded.rto,
      email: decoded.email
    };
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw new AppError(httpStatus.UNAUTHORIZED, "INVALID_TOKEN", "Onboarding token has expired");
    }

    // For any other JWT error
    throw new AppError(httpStatus.UNAUTHORIZED, "INVALID_TOKEN", "Invalid onboarding token");
  }
};

export const registerOrganization = async (data: RegisterOrganizationInput) => {
  // Validate required organization fields
  if (!data.organization.rtoId || !data.organization.name || !data.organization.email) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Organization RTO ID, name, and email are required");
  }

  // Validate phone number
  if (!data.organization.phone?.countryCode || !data.organization.phone?.number) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Valid phone number with country code is required");
  }

  // Validate address
  const address = data.organization.address;
  if (!address?.country || !address?.state || !address?.city || !address?.postCode || !address?.street) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Complete address information is required");
  }

  // Validate auth fields
  if (!data.auth.email || !data.auth.password || !data.auth.name) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Auth email, password, and name are required");
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.organization.email) || !emailRegex.test(data.auth.email)) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Invalid email format");
  }

  // Validate password strength (minimum 6 characters)
  if (data.auth.password.length < 6) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Password must be at least 6 characters long");
  }

  // Check if organization with same RTO ID already exists
  const existingOrg = await OrganizationModel.findOne({ rtoId: data.organization.rtoId });
  if (existingOrg) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Organization with this RTO ID already exists");
  }

  // Check if organization with same ABN already exists
  const isExistingABN = await OrganizationModel.findOne({ ABN: data.organization.ABN });
  if (isExistingABN) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Organization with this ABN already exists");
  }

  // Check if email already exists
  const existingEmail = await OrganizationModel.findOne({ email: data.organization.email });
  if (existingEmail) {
    // If organization exists and has a new logo, delete the old one
    if (existingEmail.logoUrl && data.organization.logoUrl && existingEmail.logoUrl !== data.organization.logoUrl) {
      const oldLogoKey = CloudflareService.extractKeyFromUrl(existingEmail.logoUrl);
      if (oldLogoKey) {
        await CloudflareService.deleteFileFromR2(oldLogoKey);
      }
    }
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Organization with this email already exists");
  }

  // Check if auth email already exists
  const db = mongoose.connection.db;
  const collection = db!.collection("user");
  const existingAuthEmail = await collection.findOne({ email: data.auth.email });
  if (existingAuthEmail) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "An account with this email already exists");
  }

  // TRANSACTION
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create Organization
    const organization = await OrganizationModel.create([data.organization], { session });
    const org = organization[0];

    // Create Qualifications with organizationId
    let qualifications: any[] = [];
    if (data.qualifications && data.qualifications.length > 0) {
      qualifications = await QualificationModel.insertMany(
        data.qualifications.map((q) => ({
          ...q,
          organizationId: org._id
        })),
        { session }
      );
    }

    // ========== CREATE MAPPING: QUALIFICATION CODE -> DATABASE ID ==========
    const qualificationCodeToIdMap = new Map(qualifications.map((q) => [q.code, q._id]));

    // Create Units with organizationId and mapped qualificationId
    let units: any[] = [];
    if (data.units && data.units.length > 0) {
      const unitsToInsert = data.units.map((u) => {
        // Check if unit is not attached to any qualification (qualificationCode starts with "NA-")
        const isStandalone = u.qualificationCode?.startsWith("NA-");

        // Map qualificationCode to database ID (null if not attached to any qualification)
        const qualificationId = isStandalone ? null : qualificationCodeToIdMap.get(u.qualificationCode) || null;

        return {
          ...u,
          organizationId: org._id,
          qualificationId: qualificationId
        };
      });

      units = await UnitModel.insertMany(unitsToInsert, { session });
    }

    // ========== CREATE ADMIN LOGIN (better-auth user + credential account) ==========
    // The admin's email is already proven: the SA-issued onboard token embedded this
    // email and the form is locked to it, so the account is created emailVerified=true.
    // Created server-side here (instead of a public sign-up call) so verification is
    // tied to the onboard token and stays atomic with the organization.
    const now = new Date();
    const userId = new ObjectId();
    const hashedPassword = await hashPassword(data.auth.password);

    await db!.collection("user").insertOne(
      {
        _id: userId,
        name: data.auth.name,
        email: data.auth.email,
        emailVerified: true,
        role: "ADMIN",
        organizationId: org._id.toString(),
        image: data.organization.logoUrl || null,
        createdAt: now,
        updatedAt: now
      },
      { session }
    );

    await db!.collection("account").insertOne(
      {
        _id: new ObjectId(),
        userId,
        accountId: data.auth.email,
        providerId: "credential",
        password: hashedPassword,
        createdAt: now,
        updatedAt: now
      },
      { session }
    );

    await session.commitTransaction();
    await session.endSession();

    return {
      organization: org,
      qualifications,
      units,
      stats: {
        totalQualifications: qualifications.length,
        totalUnits: units.length,
        unitsLinked: units.filter((u) => u.qualificationId).length,
        standaloneUnits: units.filter((u) => !u.qualificationId && u.qualificationCode?.startsWith("NA-")).length
      }
    };
  } catch (err) {
    await session.abortTransaction();
    await session.endSession();
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", `Registration failed: ${(err as Error).message}`);
  }
};

export const OnboardServices = {
  generateOnboardToken,
  sendOnboardTokenToUser,
  verifyOnboardToken,
  registerOrganization
};
