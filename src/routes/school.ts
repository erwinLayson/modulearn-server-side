import {Router} from "express"

import {registerNewSchool, getAllSchools, getPublicSchoolList, getSchoolConfig, updateSchoolConfig} from "../controller/schools.js";
import {authMiddleware, roleMiddleware} from "../middleware/auth.js";
import {verifyOwnership} from "../middleware/schoolScope.js";

const router: Router = Router();

// Public endpoint — no auth required (used by login page school selector)
router.get('/schools/list', getPublicSchoolList);

router.post('/schools', registerNewSchool);
router.get('/schools', authMiddleware, roleMiddleware("super_admin"), getAllSchools);

// School config endpoints
router.get('/schools/:id/config', authMiddleware, roleMiddleware("school_admin"), verifyOwnership('schools', 'school_id'), getSchoolConfig);
router.put('/schools/:id/config', authMiddleware, roleMiddleware("school_admin"), verifyOwnership('schools', 'school_id'), updateSchoolConfig);

export default router;
