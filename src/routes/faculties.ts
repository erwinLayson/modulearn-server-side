import {Router} from "express";

// =========== Controllers =============
import {registerFaculty, getFacultiesBySchoolId, getFacultyById, updateFaculty, deleteFaculty} from "../controller/faculties.js";
import {authMiddleware, roleMiddleware} from "../middleware/auth.js";
import {enforceSchoolScope, enforceSchoolParam, verifyOwnership} from "../middleware/schoolScope.js";

const router: Router = Router();

router.post('/faculties', authMiddleware, roleMiddleware('school_admin'), enforceSchoolScope, registerFaculty);
router.get('/faculties/school/:school_id', authMiddleware, enforceSchoolParam, getFacultiesBySchoolId);
router.get('/faculties/:id', authMiddleware, verifyOwnership('faculties'), getFacultyById);
router.put('/faculties/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('faculties'), updateFaculty);
router.delete('/faculties/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('faculties'), deleteFaculty);

export default router;
