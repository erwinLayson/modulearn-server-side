import {Router} from "express";
import { createSchoolYear, getSchoolYearsBySchoolId, getCurrentSchoolYear, getSchoolYearById, setCurrentSchoolYear, deleteSchoolYear, autoGenerateSchoolYears } from "../controller/school-years.js";
import {authMiddleware, roleMiddleware} from "../middleware/auth.js";
import {enforceSchoolScope, enforceSchoolParam, verifyOwnership} from "../middleware/schoolScope.js";

const router: Router = Router();

router.post('/school-years', authMiddleware, roleMiddleware('school_admin'), enforceSchoolScope, createSchoolYear);
router.get('/school-years/school/:school_id', authMiddleware, enforceSchoolParam, getSchoolYearsBySchoolId);
router.get('/school-years/current/:school_id', authMiddleware, enforceSchoolParam, getCurrentSchoolYear);
router.post('/school-years/auto-generate/:school_id', authMiddleware, roleMiddleware('school_admin'), enforceSchoolParam, autoGenerateSchoolYears);
// School years use a numeric auto-increment id, so tell the ownership check which
// column the :id refers to instead of letting it guess from the value's shape.
router.get('/school-years/:id', authMiddleware, verifyOwnership('school_years', 'school_id', 'id'), getSchoolYearById);
router.put('/school-years/:id/set-current', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('school_years', 'school_id', 'id'), setCurrentSchoolYear);
router.delete('/school-years/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('school_years', 'school_id', 'id'), deleteSchoolYear);

export default router;
