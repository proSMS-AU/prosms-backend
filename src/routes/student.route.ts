import { Router } from "express";
import { validateResource } from "../middleware";
import {
  // StudentRequestSchema,
  UpdateStudentRequestSchema
} from "../schemas/student.schema";
import { asyncWrapper } from "../utils";
import { StudentController } from "../controllers/student.controller";

const router = Router();

// Filter options endpoints (BEFORE /:id routes)
router.get("/filter-options/locations", asyncWrapper(StudentController.getUniqueLocationsHandler));

router.get("/filter-options/states", asyncWrapper(StudentController.getUniqueStatesHandler));

router.get("/filter-options/countries", asyncWrapper(StudentController.getUniqueCountriesHandler));

router.post(
  "/",
  // validateResource(StudentRequestSchema),
  asyncWrapper(StudentController.addNewStudentHandler)
);

router.get("/", asyncWrapper(StudentController.getAllStudentsHandler));

router.get("/:id", asyncWrapper(StudentController.getStudentByIdHandler));

router.patch(
  "/:id",
  validateResource(UpdateStudentRequestSchema),
  asyncWrapper(StudentController.updateStudentHandler)
);

router.delete("/:id", asyncWrapper(StudentController.deleteStudentHandler));

export default router;
