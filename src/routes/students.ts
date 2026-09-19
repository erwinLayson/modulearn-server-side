import {Router} from "express";
import type { RequestHandler } from "express";

// =========== Controllers =============
import {registerStudent, getStudentsBySchoolId, getStudentById, updateStudent, deleteStudent, importStudents, previewImportStudents} from "../controller/students.js";
import {authMiddleware, roleMiddleware} from "../middleware/auth.js";
import {upload} from "../middleware/upload.js";
import {enforceSchoolScope, enforceSchoolParam, verifyOwnership} from "../middleware/schoolScope.js";

const router: Router = Router();

router.post('/students', authMiddleware, roleMiddleware('school_admin'), enforceSchoolScope, registerStudent);
router.post('/students/import/preview', authMiddleware, roleMiddleware('school_admin'), upload.single('file'), previewImportStudents as RequestHandler);
router.post('/students/import', authMiddleware, roleMiddleware('school_admin'), upload.single('file'), importStudents as RequestHandler);
router.get('/students/school/:school_id', authMiddleware, enforceSchoolParam, getStudentsBySchoolId);
router.get('/students/:id', authMiddleware, verifyOwnership('students'), getStudentById);
router.put('/students/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('students'), updateStudent);
router.delete('/students/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('students'), deleteStudent);

export default router;
