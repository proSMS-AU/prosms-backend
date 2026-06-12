import { Prop, ModelOptions, getModelForClass } from "@typegoose/typegoose";
import { PhoneNumber } from "./common.model";

class OrganizationAddress {
  @Prop() country: string;
  @Prop() state: string;
  @Prop() city: string;
  @Prop() postCode: string;
  @Prop() street: string;

  @Prop() building?: string;
  @Prop() unit?: string;
  @Prop() POBox?: string;
}
class MonthlyUSIVerification {
  @Prop() month: string;
  @Prop() year: number;
  @Prop() count: number;
}
class SSIDInformation {
  @Prop() ssid: string;
  @Prop() timestamp: number;
}
class USIConfiguration {
  @Prop() ABN: string;
  @Prop() orgCode: string;
  @Prop({ type: () => SSIDInformation, _id: false }) ssidInfo: SSIDInformation;
  @Prop() ramRelationshipStatus: "active" | "inactive" | "pending" | "terminated";
  @Prop() ramAuthorizationDate?: Date; // * set when configured for USI
  @Prop() ramExpiryDate?: Date; // * set when configured for USI
  @Prop() totalUSIVerifications: number;
  @Prop({ type: () => [MonthlyUSIVerification], _id: false })
  monthlyUSIVerifications: MonthlyUSIVerification[];
  @Prop() configurationDate?: Date; // * set when configured for USI
  @Prop() lastVerificationDate?: Date;
  @Prop() lastVerificationStatus?: string;
  @Prop() configurationExpiryDate?: Date; // * set when configured for USI - the date of ramExpiry
  @Prop() configurationStatus: "configured" | "configuration_pending" | "expired";
}

@ModelOptions({
  schemaOptions: {
    collection: "organizations",
    timestamps: true,
    versionKey: false
  }
})
export class Organization {
  @Prop({
    required: true,
    type: String
  })
  name: string;

  @Prop({
    required: true,
    type: String,
    unique: true
  })
  rtoId: string;

  @Prop({
    required: true,
    unique: true,
    type: String
  })
  ABN: string;

  @Prop({ type: () => PhoneNumber, _id: false })
  phone: PhoneNumber;

  @Prop({ type: () => PhoneNumber, _id: false })
  alternatePhone?: PhoneNumber;

  @Prop({
    required: false,
    type: String
  })
  website?: string;

  @Prop({
    required: false,
    type: String
  })
  logoUrl?: string;

  @Prop({
    required: true,
    type: String,
    unique: true
  })
  email: string;

  @Prop({ type: () => OrganizationAddress, _id: false })
  address: OrganizationAddress;

  @Prop({
    type: String,
    enum: ["active", "inactive", "pending", "reported"],
    default: "active"
  })
  status: "active" | "inactive" | "pending" | "reported";

  @Prop({ type: () => USIConfiguration, _id: false })
  usiConfig?: USIConfiguration;

  // Soft delete: when an org is "deleted" by a super admin we keep the record
  // (and all its compliance data) but flag it so it disappears from lists/stats.
  @Prop({ type: Boolean, default: false })
  isDeleted?: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  // Tombstone originals — unique-index fields are mangled on delete so the same
  // RTO can re-register. Originals stored here for display/audit/restore.
  @Prop({ type: String })
  originalEmail?: string;

  @Prop({ type: String })
  originalRtoId?: string;

  @Prop({ type: String })
  originalABN?: string;
}

export const OrganizationModel = getModelForClass(Organization);
