import { Router } from "express";
import { ClassRequestSchema, DeleteUnitsFromClassEnrollmentRequestSchema } from "../schemas/class.schema";
import { asyncWrapper } from "../utils";
import { validateResource } from "../middleware";
import { ClassControllers } from "../controllers/class.controller";

const router = Router();

// Filter options endpoints (should come BEFORE /:id routes)
router.get("/filter-options/locations", asyncWrapper(ClassControllers.getUniqueLocationsHandler));

router.get("/filter-options/trainers", asyncWrapper(ClassControllers.getUniqueTrainersHandler));

router.get("/certificate-generated-classes", asyncWrapper(ClassControllers.getCertificateGeneratedClassesHandler));

router.get("/:id/student-enrolled-classes", asyncWrapper(ClassControllers.getStudentEnrolledClassesHandler));

// Main CRUD routes
router.post("/", validateResource(ClassRequestSchema), asyncWrapper(ClassControllers.addClassHandler));

router.get("/", asyncWrapper(ClassControllers.getAllClassesHandler));

router.patch(
  "/delete-units-from-enrollment",
  validateResource(DeleteUnitsFromClassEnrollmentRequestSchema),
  asyncWrapper(ClassControllers.deleteUnitsFromClassEnrollmentHandler)
);

router.get("/:id", asyncWrapper(ClassControllers.getClassByIdHandler));

router.patch("/:id", asyncWrapper(ClassControllers.updateClassHandler));

router.delete("/:id", asyncWrapper(ClassControllers.deleteClassHandler));

// D.3 — Bulk enrol multiple students into a class
router.post("/:id/enrollments/bulk", asyncWrapper(ClassControllers.bulkEnrollStudentsHandler));

export default router;
