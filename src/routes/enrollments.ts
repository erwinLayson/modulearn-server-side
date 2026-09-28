import {Router} from "express";

import {enrollStudent, getEnrollmentsByClassAndSchoolYear, getEnrollmentsByStudentId, getEnrollmentsByStudentAndSchoolYear, getClassesByStudentId, updateEnrollmentStatus, deleteEnrollment} from "../controller/enrollments.js";
import {authMiddleware, roleMiddleware} from "../middleware/auth.js";
import {requireFeature} from "../middleware/requireFeature.js";

const router: Router = Router();

// Per-school feature switch controlled by the super admin.
// Only the mutating routes are gated so read-only consumers (class rosters,
// student class view) keep working when enrollments are switched off.
const enrollmentsOn = requireFeature('enrollments');

router.post('/enrollments', authMiddleware, roleMiddleware('school_admin'), enrollmentsOn, enrollStudent);
router.get('/enrollments/class/:class_id/school-year/:school_year_id', authMiddleware, getEnrollmentsByClassAndSchoolYear);
router.get('/enrollments/student/:student_id', authMiddleware, getEnrollmentsByStudentId);
router.get('/enrollments/student/:student_id/school-year/:school_year_id', authMiddleware, getEnrollmentsByStudentAndSchoolYear);
router.get('/enrollments/student/:student_id/classes', authMiddleware, getClassesByStudentId);
router.put('/enrollments/:id/status', authMiddleware, roleMiddleware('school_admin', 'faculty'), enrollmentsOn, updateEnrollmentStatus);
router.delete('/enrollments/:id', authMiddleware, roleMiddleware('school_admin'), enrollmentsOn, deleteEnrollment);

export default router;
