export type ASQAReportType = "ALL" | "DELIVERY_DATA" | "STUDENT_SURVEY" | "ENROLLMENT_COMPLETION";

export interface ASQAReportParams {
  organizationId: string;
  startDate: Date;
  endDate: Date;
  reportType: ASQAReportType;
  generatedBy: string;
}

export type SurveyEntry = {
  qualCode: string;
  qualTitle: string;
  givenName: string;
  surname: string;
  phone: string;
  enrollmentDate: Date;
  completionDate: Date | null;
  email: string;
};

export type UnitAgg = {
  code: string;
  title: string;
  enrollmentCount: number;
  issuedCount: number;
  locations: Set<string>;
  fundingSources: Set<string>;
  deliveryModes: Set<string>;
  hasPartnership: boolean;
  cohorts: Set<string>;
  comments: Set<string>;
};
