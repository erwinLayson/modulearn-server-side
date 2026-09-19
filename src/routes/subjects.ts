import {Router} from "express";

import {registerSubject, getSubjectsBySchoolId, getAllSubjects, getSubjectById, updateSubject, deleteSubject, assignFacultyToSubject, removeFacultyFromSubject, getFacultiesBySubjectId, getFacultiesBySchoolId} from "../controller/subjects.js";
import {authMiddleware, roleMiddleware} from "../middleware/auth.js";
import {enforceSchoolScope, enforceSchoolParam, verifyOwnership} from "../middleware/schoolScope.js";

const router: Router = Router();
router.post('/subjects', authMiddleware, roleMiddleware('school_admin'), enforceSchoolScope, registerSubject);
router.get('/subjects', authMiddleware, roleMiddleware('super_admin'), getAllSubjects);
router.get('/subjects/school/:school_id', authMiddleware, enforceSchoolParam, getSubjectsBySchoolId);
router.get('/subjects/faculties/school/:school_id', authMiddleware, enforceSchoolParam, getFacultiesBySchoolId);
router.get('/subjects/:id', authMiddleware, verifyOwnership('subjects'), getSubjectById);
router.get('/subjects/:id/faculties', authMiddleware, verifyOwnership('subjects'), getFacultiesBySubjectId);
router.post('/subjects/:id/faculties', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('subjects'), assignFacultyToSubject);
router.delete('/subjects/:id/faculties/:facultyId', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('subjects'), removeFacultyFromSubject);
router.put('/subjects/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('subjects'), updateSubject);
router.delete('/subjects/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('subjects'), deleteSubject);

export default router;
