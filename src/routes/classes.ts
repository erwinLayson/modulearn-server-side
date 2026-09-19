import {Router} from "express";

import {registerClass, getClassesBySchoolId, getAllClasses, getClassesByFacultyId, getAssignedClassesForFaculty, getClassById, updateClass, deleteClass, assignFacultyToClass, removeFacultyFromClass, getFacultiesByClassId, getFacultiesBySchoolId, replaceFacultyInClass, getAvailableAdvisers} from "../controller/classes.js";
import {authMiddleware, roleMiddleware} from "../middleware/auth.js";
import {enforceSchoolScope, enforceSchoolParam, verifyOwnership} from "../middleware/schoolScope.js";

const router: Router = Router();

router.post('/classes', authMiddleware, roleMiddleware('school_admin'), enforceSchoolScope, registerClass);
router.get('/classes', authMiddleware, roleMiddleware('super_admin'), getAllClasses);
router.get('/classes/school/:school_id', authMiddleware, enforceSchoolParam, getClassesBySchoolId);
router.get('/classes/faculty/:faculty_id', authMiddleware, getClassesByFacultyId);
router.get('/classes/faculty/:faculty_id/assigned', authMiddleware, getAssignedClassesForFaculty);
router.get('/classes/faculties/school/:school_id', authMiddleware, enforceSchoolParam, getFacultiesBySchoolId);
router.get('/classes/available-advisers/:school_id', authMiddleware, enforceSchoolParam, getAvailableAdvisers);
router.get('/classes/:id', authMiddleware, verifyOwnership('classes'), getClassById);
router.get('/classes/:id/faculties', authMiddleware, verifyOwnership('classes'), getFacultiesByClassId);
router.post('/classes/:id/faculties', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('classes'), assignFacultyToClass);
router.put('/classes/:id/faculties/:facultyId', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('classes'), replaceFacultyInClass);
router.delete('/classes/:id/faculties/:facultyId', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('classes'), removeFacultyFromClass);
router.put('/classes/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('classes'), updateClass);
router.delete('/classes/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('classes'), deleteClass);

export default router;
