import {Router} from "express"

import {registerNewSchool, getAllSchools} from "../controller/schools.js";
import {authMiddleware, roleMiddleware} from "../middleware/auth.js";

const router: Router = Router();
router.post('/schools', registerNewSchool);
router.get('/schools', authMiddleware, roleMiddleware("super_admin"), getAllSchools);

export default router;
