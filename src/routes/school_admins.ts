import {Router} from "express";
import {logoutController} from "../controller/school_admins.js";
import {authMiddleware} from "../middleware/auth.js";

const router: Router = Router();

router.post('/logout', authMiddleware, logoutController);

export default router;