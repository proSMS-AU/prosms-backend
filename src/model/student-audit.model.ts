import { Prop, ModelOptions, getModelForClass, Severity } from "@typegoose/typegoose";
import mongoose from "mongoose";
import { Organization } from "./organization.model";

@ModelOptions({
  schemaOptions: {
    collection: "student_audits",
    timestamps: true,
    versionKey: false
  },
  options: { allowMixed: Severity.ALLOW }
})
export class StudentAudit {
  @Prop({ ref: () => Organization, required: true })
  organizationId: mongoose.Types.ObjectId;

  // The student's display ID at time of action (e.g. "STU-0000001")
  @Prop({ required: true, type: String })
  studentId: string;

  // MongoDB _id of the student document (kept even after soft-delete)
  @Prop({ required: true, type: mongoose.Types.ObjectId })
  studentObjectId: mongoose.Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: ["created", "updated", "deleted", "restored", "enrolled", "unenrolled", "class_deleted", "undo"]
  })
  action: "created" | "updated" | "deleted" | "restored" | "enrolled" | "unenrolled" | "class_deleted" | "undo";

  // Snapshot of key student fields at time of action
  @Prop({ type: Object })
  studentSnapshot?: Record<string, unknown>;

  // User who triggered the action
  @Prop({ type: mongoose.Types.ObjectId })
  actorUserId?: mongoose.Types.ObjectId;
}

export const StudentAuditModel = getModelForClass(StudentAudit);
