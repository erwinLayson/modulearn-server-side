import {Router} from "express";

import {registerModule, getModulesBySchoolId, getAllModules, getModuleById, updateModule, deleteModule} from "../controller/modules.js";
import {authMiddleware, roleMiddleware} from "../middleware/auth.js";
import {enforceSchoolScope, enforceSchoolParam, verifyOwnership} from "../middleware/schoolScope.js";

const router: Router = Router();
router.post('/modules', authMiddleware, roleMiddleware('school_admin'), enforceSchoolScope, registerModule);
router.get('/modules', authMiddleware, roleMiddleware('super_admin'), getAllModules);
router.get('/modules/school/:school_id', authMiddleware, enforceSchoolParam, getModulesBySchoolId);
router.get('/modules/:id', authMiddleware, verifyOwnership('modules'), getModuleById);
router.put('/modules/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('modules'), updateModule);
router.delete('/modules/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('modules'), deleteModule);

export default router;
