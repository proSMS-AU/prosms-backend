import { ModelOptions, Prop, Severity, getModelForClass } from "@typegoose/typegoose";
import mongoose from "mongoose";
import { Organization } from "./organization.model";

export type ActivityAction = "create" | "update" | "delete" | "restore" | "issue" | "void" | "enroll" | "unenroll";
export type ActivityEntityType =
  | "student"
  | "class"
  | "enrollment"
  | "certificate"
  | "invoice"
  | "trainer"
  | "qualification"
  | "template";

@ModelOptions({
  schemaOptions: {
    collection: "activity_logs",
    timestamps: true,
    versionKey: false
  },
  options: { allowMixed: Severity.ALLOW }
})
export class ActivityLog {
  @Prop({ ref: () => Organization, required: true, index: true })
  organizationId: mongoose.Types.ObjectId;

  @Prop({ type: String, required: false })
  actorUserId?: string;

  @Prop({ type: String, required: true })
  entityType: ActivityEntityType;

  @Prop({ type: String, required: true, index: true })
  entityId: string;

  @Prop({ type: String, required: false })
  entityLabel?: string;

  @Prop({ type: String, required: true })
  action: ActivityAction;

  @Prop({ type: Object, required: false, default: null })
  before?: Record<string, unknown> | null;

  @Prop({ type: Object, required: false, default: null })
  after?: Record<string, unknown> | null;

  @Prop({ type: String, required: false })
  description?: string;

  // Whether this entry can be undone (delete actions on reversible entities).
  // Non-reversible deletes (certificate/invoice — file removed from storage) set this false.
  @Prop({ type: Boolean, required: false, default: false })
  undoable?: boolean;

  // Append-only: set when the action is undone. The log entry itself is never deleted.
  @Prop({ type: Date, required: false, default: null })
  undoneAt?: Date | null;

  // Records who performed the undo (may differ from the original actor).
  @Prop({ type: String, required: false })
  undoneByUserId?: string;

  // Auto-added by timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const ActivityLogModel = getModelForClass(ActivityLog);
