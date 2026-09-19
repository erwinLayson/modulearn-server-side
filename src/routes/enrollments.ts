import {Router} from "express";

import {enrollStudent, getEnrollmentsByClassAndSchoolYear, getEnrollmentsByStudentId, getEnrollmentsByStudentAndSchoolYear, getClassesByStudentId, updateEnrollmentStatus, deleteEnrollment} from "../controller/enrollments.js";
import {authMiddleware, roleMiddleware} from "../middleware/auth.js";

const router: Router = Router();

router.post('/enrollments', authMiddleware, roleMiddleware('school_admin'), enrollStudent);
router.get('/enrollments/class/:class_id/school-year/:school_year_id', authMiddleware, getEnrollmentsByClassAndSchoolYear);
router.get('/enrollments/student/:student_id', authMiddleware, getEnrollmentsByStudentId);
router.get('/enrollments/student/:student_id/school-year/:school_year_id', authMiddleware, getEnrollmentsByStudentAndSchoolYear);
router.get('/enrollments/student/:student_id/classes', authMiddleware, getClassesByStudentId);
router.put('/enrollments/:id/status', authMiddleware, roleMiddleware('school_admin', 'faculty'), updateEnrollmentStatus);
router.delete('/enrollments/:id', authMiddleware, roleMiddleware('school_admin'), deleteEnrollment);

export default router;
