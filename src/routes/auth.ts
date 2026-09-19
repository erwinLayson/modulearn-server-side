import {Router} from "express";
import {loginController} from "../controller/auth.js";

const router: Router = Router();

router.post("/auth/login", loginController);

export default router;
