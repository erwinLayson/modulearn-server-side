import {Router} from "express";
import {loginController, updateCredentialsController} from "../controller/auth.js";
import {authMiddleware} from "../middleware/auth.js";

const router: Router = Router();

router.post("/auth/login", loginController);
router.put("/auth/credentials", authMiddleware, updateCredentialsController);

export default router;
