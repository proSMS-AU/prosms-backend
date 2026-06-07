/* eslint-disable @typescript-eslint/no-explicit-any */
import { Model } from "mongoose";

import { ActivityLogModel, ActivityEntityType } from "../model/activity-log.model";
import { StudentModel } from "../model/student.model";
import { ClassModel } from "../model/class.model";
import { TrainerModel } from "../model/trainer.model";
import { QualificationModel } from "../model/qualification.model";
import { AppError } from "../utils/appError";
import { httpStatus } from "../constants";
import { logActivity } from "../utils/activityLogger";

const UNDO_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

type UndoResult = { undone: true; entityType: string; entityId: string };

type LogDoc = {
  _id: any;
  organizationId: any;
  entityType: ActivityEntityType;
  entityId: string;
  entityLabel?: string;
  action: string;
  before?: Record<string, unknown> | null;
  undoable?: boolean;
  undoneAt?: Date | null;
  createdAt?: Date;
};

// A preflight result either clears the undo or returns the human-readable reasons
// it can't proceed. Reasons are surfaced verbatim in the UI.
type Preflight = { ok: true } | { ok: false; reasons: string[] };

interface UndoHandler {
  preflight: (log: LogDoc) => Promise<Preflight>;
  execute: (log: LogDoc) => Promise<void>;
}

// ── Generic re-insert handler for hard-deleted root documents ────────────────
// Restores the full `before` snapshot with its original _id. Used for entities
// whose delete is a hard delete with no external side effects.
const reinsertHandler = (model: Model<any>, label: string): UndoHandler => ({
  preflight: async (log) => {
    if (!log.before || typeof log.before !== "object") {
      return {
        ok: false,
        reasons: [`The original ${label} data wasn't captured at delete time, so it can't be restored automatically.`]
      };
    }
    const existing = await model.findById(log.entityId).lean();
    if (existing) {
      return { ok: false, reasons: [`This ${label} already exists — it looks like it was already restored.`] };
    }
    return { ok: true };
  },
  execute: async (log) => {
    // insertOne preserves the exact _id, timestamps and nested types from the snapshot.
    await model.collection.insertOne({ ...(log.before as any) });
  }
});

// ── Student: soft-delete, undo just clears the flag ─────────────────────────
const studentHandler: UndoHandler = {
  preflight: async (log) => {
    const student = await StudentModel.findById(log.entityId);
    if (!student) {
      return { ok: false, reasons: ["This student no longer exists in the database and can't be restored."] };
    }
    if (!student.isDeleted) {
      return { ok: false, reasons: ["This student is already active — there's nothing to undo."] };
    }
    return { ok: true };
  },
  execute: async (log) => {
    await StudentModel.findByIdAndUpdate(log.entityId, {
      $set: { isDeleted: false },
      $unset: { deletedAt: "" }
    });
  }
};

// ── Enrollment: embedded sub-doc, undo re-pushes it into the parent class ────
const enrollmentHandler: UndoHandler = {
  preflight: async (log) => {
    const before = log.before as any;
    if (!before?.enrollment || !before?.studentId) {
      return { ok: false, reasons: ["The removed enrollment data wasn't captured, so it can't be restored."] };
    }
    const cls = await ClassModel.findById(log.entityId);
    if (!cls) {
      return { ok: false, reasons: ["The class this student was enrolled in no longer exists."] };
    }
    const alreadyEnrolled = cls.enrollments.some((e: any) => e?.studentInfo?.id === before.studentId);
    if (alreadyEnrolled) {
      return { ok: false, reasons: ["This student is already enrolled in the class."] };
    }
    return { ok: true };
  },
  execute: async (log) => {
    const before = log.before as any;
    await ClassModel.findByIdAndUpdate(log.entityId, { $push: { enrollments: before.enrollment } });
  }
};

// ── Non-undoable entities: explain exactly why, so the UI can show it ────────
const nonUndoableHandler = (reason: string): UndoHandler => ({
  preflight: async () => ({ ok: false, reasons: [reason] }),

  execute: async () => {}
});

const undoHandlers: Partial<Record<ActivityEntityType, UndoHandler>> = {
  student: studentHandler,
  class: reinsertHandler(ClassModel, "class"),
  trainer: reinsertHandler(TrainerModel, "trainer"),
  qualification: reinsertHandler(QualificationModel, "qualification"),
  enrollment: enrollmentHandler,
  certificate: nonUndoableHandler(
    "Certificates can't be undone — the PDF was permanently removed from storage when it was deleted. Re-issue the certificate instead."
  ),
  invoice: nonUndoableHandler(
    "Invoices can't be undone — the PDF was permanently removed from storage when it was deleted. Recreate the invoice instead."
  )
};

const undoActivity = async (logId: string, orgId: string, actorUserId?: string): Promise<UndoResult> => {
  const log = (await ActivityLogModel.findOne({ _id: logId, organizationId: orgId })) as unknown as
    | (LogDoc & { save: () => Promise<unknown> })
    | null;
  if (!log) {
    throw new AppError(httpStatus.NOT_FOUND, "ACTIVITY_LOG_NOT_FOUND", "Activity log entry not found");
  }

  // Already undone — append-only entries keep their undoneAt marker.
  if (log.undoneAt) {
    throw new AppError(httpStatus.CONFLICT, "ALREADY_UNDONE", "This action has already been undone.");
  }

  // Explicitly non-undoable (e.g. certificate/invoice) — give the precise reason.
  if (log.undoable === false) {
    const handler = undoHandlers[log.entityType];
    const pre = handler ? await handler.preflight(log) : null;
    const reason = pre && !pre.ok ? pre.reasons.join(" ") : "This action can't be undone.";
    throw new AppError(httpStatus.BAD_REQUEST, "UNDO_NOT_SUPPORTED", reason);
  }

  const ageMs = Date.now() - new Date(log.createdAt as Date).getTime();
  if (ageMs > UNDO_WINDOW_MS) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "UNDO_WINDOW_EXPIRED",
      "The 30-minute undo window has passed for this action."
    );
  }

  const handler = undoHandlers[log.entityType];
  if (!handler) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "UNDO_NOT_SUPPORTED",
      `Undo isn't supported for "${log.action}" on "${log.entityType}".`
    );
  }

  // Pre-flight: validate the undo can complete safely. If not, return every
  // blocking reason so the UI can explain exactly what went wrong.
  const pre = await handler.preflight(log);
  if (!pre.ok) {
    throw new AppError(httpStatus.BAD_REQUEST, "UNDO_BLOCKED", `Couldn't undo this action: ${pre.reasons.join(" ")}`);
  }

  await handler.execute(log);

  // Append-only: mark the entry undone instead of deleting it.
  log.undoneAt = new Date();
  (log as any).undoneByUserId = actorUserId;
  await log.save();

  // Record the restore itself so the timeline stays complete.
  logActivity({
    organizationId: String(log.organizationId),
    actorUserId,
    entityType: log.entityType,
    entityId: log.entityId,
    entityLabel: log.entityLabel,
    action: "restore",
    description: `Undid ${log.action} of ${log.entityType}`
  });

  return { undone: true, entityType: log.entityType, entityId: log.entityId };
};

export const UndoService = { undoActivity };
