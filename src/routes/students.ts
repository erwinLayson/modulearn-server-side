import {Router} from "express";
import type { RequestHandler } from "express";

// =========== Controllers =============
import {registerStudent, getStudentsBySchoolId, getStudentById, updateStudent, deleteStudent, importStudents, previewImportStudents, getStudentAcademicRecord} from "../controller/students.js";
import {authMiddleware, roleMiddleware} from "../middleware/auth.js";
import {upload} from "../middleware/upload.js";
import {enforceSchoolScope, enforceSchoolParam, verifyOwnership, verifyAdviserOfStudent} from "../middleware/schoolScope.js";
import {requireFeature} from "../middleware/requireFeature.js";

const router: Router = Router();

router.post('/students', authMiddleware, roleMiddleware('school_admin'), enforceSchoolScope, registerStudent);
router.post('/students/import/preview', authMiddleware, roleMiddleware('school_admin'), upload.single('file'), previewImportStudents as RequestHandler);
router.post('/students/import', authMiddleware, roleMiddleware('school_admin'), upload.single('file'), importStudents as RequestHandler);
router.get('/students/school/:school_id', authMiddleware, enforceSchoolParam, getStudentsBySchoolId);
// School admins may read any student's record; faculty only their own advisees.
router.get('/students/:id/academic-record', authMiddleware, roleMiddleware('school_admin', 'faculty'), requireFeature('academic_record'), verifyOwnership('students'), verifyAdviserOfStudent, getStudentAcademicRecord);
router.get('/students/:id', authMiddleware, verifyOwnership('students'), getStudentById);
router.put('/students/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('students'), updateStudent);
router.delete('/students/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('students'), deleteStudent);

export default router;
