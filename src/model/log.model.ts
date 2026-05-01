import { ModelOptions, Prop, Severity, getModelForClass } from "@typegoose/typegoose";
import { ErrorReportRole } from "../constants";

export enum LogLevel {
  ERROR = "ERROR",
  WARN = "WARN",
  INFO = "INFO",
  DEBUG = "DEBUG",
  TRACE = "TRACE"
}

export enum Environment {
  PRODUCTION = "production",
  STAGING = "staging",
  DEVELOPMENT = "development"
}

class Source {
  @Prop({ required: true, type: String })
  application: string;

  @Prop({ required: true, type: String, enum: Environment })
  environment: Environment;

  @Prop({ required: false, type: String })
  service?: string;

  @Prop({ required: false, type: String })
  host?: string;

  @Prop({ required: false, type: String })
  functionName?: string;

  @Prop({ required: false, type: String })
  endpoint?: string;

  @Prop({ required: false, type: String })
  requestMethod?: string;
}

class ErrorDetails {
  @Prop({ required: false, type: String })
  name?: string;

  @Prop({ required: false, type: String })
  stack?: string;

  @Prop({ required: false, type: String })
  code?: string;

  @Prop({ allowMixed: Severity.ALLOW })
  details?: Record<string, unknown>;
}

@ModelOptions({ schemaOptions: { collection: "logs", timestamps: true }, options: { allowMixed: Severity.ALLOW } })
export class Log {
  @Prop({ required: false, type: String, default: ErrorReportRole.SYSTEM, enum: ErrorReportRole })
  reportedBy?: string;

  @Prop({ required: false, type: String, default: null })
  idForUser?: string | null;

  @Prop({ required: true, type: String, enum: LogLevel, index: true })
  level: LogLevel;

  @Prop({ required: true, type: Source, _id: false })
  source: Source;

  @Prop({ required: true, type: String })
  message: string;

  @Prop({ required: true, type: ErrorDetails, _id: false, allowMixed: Severity.ALLOW })
  error?: ErrorDetails;

  @Prop({ required: false, default: null })
  metadata?: Record<string, unknown> | null;

  @Prop({ required: false, type: () => [String], default: [] })
  tags?: string[];

  @Prop({ required: false, type: () => [String], default: [] })
  screenshotUrls?: string[];

  @Prop({ required: false, default: null })
  additionalData?: Record<string, unknown> | null;
}

export const LogModel = getModelForClass(Log);
