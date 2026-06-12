import { Router } from "express";
import { validateResource } from "../middleware";
import {
  // StudentRequestSchema,
  UpdateStudentRequestSchema
} from "../schemas/student.schema";
import { asyncWrapper } from "../utils";
import { StudentController } from "../controllers/student.controller";

const router = Router();

// Lightweight dropdown options — id + name only, no pagination (BEFORE /:id routes)
router.get("/options", asyncWrapper(StudentController.getStudentOptionsHandler));

// Filter options endpoints (BEFORE /:id routes)
router.get("/filter-options/locations", asyncWrapper(StudentController.getUniqueLocationsHandler));

router.get("/filter-options/states", asyncWrapper(StudentController.getUniqueStatesHandler));

router.get("/filter-options/countries", asyncWrapper(StudentController.getUniqueCountriesHandler));

// C.12 — Deleted students audit
router.get("/deleted", asyncWrapper(StudentController.getDeletedStudentsHandler));
router.post("/:id/restore", asyncWrapper(StudentController.restoreStudentHandler));

router.post(
  "/",
  // validateResource(StudentRequestSchema),
  asyncWrapper(StudentController.addNewStudentHandler)
);

router.get("/", asyncWrapper(StudentController.getAllStudentsHandler));

router.get("/:id", asyncWrapper(StudentController.getStudentByIdHandler));

// E-01 — All enrollments for a student (must come before generic /:id patch/delete)
router.get("/:id/enrollments", asyncWrapper(StudentController.getStudentEnrollmentsHandler));

router.patch(
  "/:id",
  validateResource(UpdateStudentRequestSchema),
  asyncWrapper(StudentController.updateStudentHandler)
);

router.delete("/:id", asyncWrapper(StudentController.deleteStudentHandler));

export default router;
