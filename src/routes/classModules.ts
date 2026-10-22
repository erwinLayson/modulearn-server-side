import { Router } from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import {
    assignModule,
    getClassModules,
    instantiateTemplate,
} from "../controller/classModules.js";

const router: Router = Router();

router.post('/class-modules', authMiddleware, roleMiddleware('faculty'), assignModule);
router.get('/class-modules/class/:classId', authMiddleware, roleMiddleware('faculty'), getClassModules);
router.post('/class-modules/:id/activities', authMiddleware, roleMiddleware('faculty'), instantiateTemplate);

export default router;
