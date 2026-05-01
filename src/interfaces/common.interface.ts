/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";

export interface IPhone {
  countryCode: string;
  number: string;
}

export interface IAddress {
  addressLine1: string;
  addressLine2?: string;
  country: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface IUser {
  _id?: string | Types.ObjectId;
  name: string;
  email: string;
  password: string;
  organizationId: Types.ObjectId | any;
}

export interface AuthTokens {
  accessToken?: string;
  refreshToken?: string;
}
