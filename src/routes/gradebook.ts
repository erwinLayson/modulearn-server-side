import { Router } from "express";
import {
    getGradingWeights,
    updateGradingWeights,
    getGradeItems,
    createGradeItem,
    updateGradeItem,
    deleteGradeItem,
    getGradesForSubject,
    upsertGrades,
    getStudentGradesForSubject,
    getStudentSummary,
    finalizePeriod,
    correctFinalization,
} from "../controller/gradebook.js";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { requireFeature } from "../middleware/requireFeature.js";

const router: Router = Router();

// Per-school feature switch controlled by the super admin.
const gradebookOn = requireFeature("gradebook");

// Grading Weights
router.get("/gradebook/weights/:classId/:subjectId", authMiddleware, roleMiddleware("faculty", "student"), gradebookOn, getGradingWeights);
router.put("/gradebook/weights/:classId/:subjectId", authMiddleware, roleMiddleware("faculty"), gradebookOn, updateGradingWeights);

// Grade Items
router.get("/gradebook/items/:classId/:subjectId", authMiddleware, roleMiddleware("faculty", "student"), gradebookOn, getGradeItems);
router.post("/gradebook/items/:classId/:subjectId", authMiddleware, roleMiddleware("faculty"), gradebookOn, createGradeItem);
router.put("/gradebook/items/:id", authMiddleware, roleMiddleware("faculty"), gradebookOn, updateGradeItem);
router.delete("/gradebook/items/:id", authMiddleware, roleMiddleware("faculty"), gradebookOn, deleteGradeItem);

// Grades (Faculty)
router.get("/gradebook/grades/:classId/:subjectId", authMiddleware, roleMiddleware("faculty"), gradebookOn, getGradesForSubject);
router.post("/gradebook/grades/:gradeItemId", authMiddleware, roleMiddleware("faculty"), gradebookOn, upsertGrades);

// Finalization
router.post("/gradebook/finalize", authMiddleware, roleMiddleware("faculty", "school_admin"), gradebookOn, finalizePeriod);
router.put("/gradebook/finalizations/:id", authMiddleware, roleMiddleware("school_admin"), gradebookOn, correctFinalization);

// Student Grade APIs
router.get("/gradebook/student/:classId/:subjectId", authMiddleware, roleMiddleware("student"), gradebookOn, getStudentGradesForSubject);
router.get("/gradebook/student-summary", authMiddleware, roleMiddleware("student"), gradebookOn, getStudentSummary);

export default router;
