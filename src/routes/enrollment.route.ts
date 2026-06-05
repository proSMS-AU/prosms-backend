import { Router } from "express";
import { EnrollmentController } from "../controllers/enrollment.controller";
import { asyncWrapper } from "../utils";
import { validateResource } from "../middleware";
import { enrollmentRequestSchema } from "../schemas/enrollment.schema";

const router = Router();

router.post(
  "/:id",
  validateResource(enrollmentRequestSchema.enrollment),
  asyncWrapper(EnrollmentController.addEnrollmentHandler)
);
router.post(
  "/:id/notify",
  validateResource(enrollmentRequestSchema.enrollmentWithNotify),
  asyncWrapper(EnrollmentController.addEnrollmentWithNotifyHandler)
);

router.patch(
  "/:classId/student/:studentId/unit/:unitId/status",
  asyncWrapper(EnrollmentController.updateStatusOfUnitCompletionHandler)
);

router.patch(
  "/:classId/student/:studentId/unit/:unitId/enrolled-unit-update",
  asyncWrapper(EnrollmentController.enrolledUnitUpdateHandler)
);

router.patch(
  "/:classId/student/:studentId/enrolled-units-update",
  asyncWrapper(EnrollmentController.enrolledUnitsBulkUpdateHandler)
);

// E-03 — Bulk enrol multiple students into one class
router.post("/:id/bulk", asyncWrapper(EnrollmentController.bulkEnrollStudentsHandler));

router.patch("/bulk-update", asyncWrapper(EnrollmentController.unitsStatusBulkUpdateHandler));
router.patch("/bulk-update-dates", asyncWrapper(EnrollmentController.bulkUpdateDatesHandler));
router.patch(
  "/update-course-enroll-and-complete-date",
  asyncWrapper(EnrollmentController.updateCourseEnrollAndCompleteDateHandler)
);

// Withdraw / remove a single student from a class (hard delete, blocked if a certificate was issued)
router.delete("/:classId/student/:studentId", asyncWrapper(EnrollmentController.removeEnrollmentHandler));

export default router;
