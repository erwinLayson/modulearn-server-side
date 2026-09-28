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

const router: Router = Router();

// Grading Weights
router.get("/gradebook/weights/:classId/:subjectId", authMiddleware, roleMiddleware("faculty", "student"), getGradingWeights);
router.put("/gradebook/weights/:classId/:subjectId", authMiddleware, roleMiddleware("faculty"), updateGradingWeights);

// Grade Items
router.get("/gradebook/items/:classId/:subjectId", authMiddleware, roleMiddleware("faculty", "student"), getGradeItems);
router.post("/gradebook/items/:classId/:subjectId", authMiddleware, roleMiddleware("faculty"), createGradeItem);
router.put("/gradebook/items/:id", authMiddleware, roleMiddleware("faculty"), updateGradeItem);
router.delete("/gradebook/items/:id", authMiddleware, roleMiddleware("faculty"), deleteGradeItem);

// Grades (Faculty)
router.get("/gradebook/grades/:classId/:subjectId", authMiddleware, roleMiddleware("faculty"), getGradesForSubject);
router.post("/gradebook/grades/:gradeItemId", authMiddleware, roleMiddleware("faculty"), upsertGrades);

// Finalization
router.post("/gradebook/finalize", authMiddleware, roleMiddleware("faculty", "school_admin"), finalizePeriod);
router.put("/gradebook/finalizations/:id", authMiddleware, roleMiddleware("school_admin"), correctFinalization);

// Student Grade APIs
router.get("/gradebook/student/:classId/:subjectId", authMiddleware, roleMiddleware("student"), getStudentGradesForSubject);
router.get("/gradebook/student-summary", authMiddleware, roleMiddleware("student"), getStudentSummary);

export default router;
