import {Router} from "express"

import { getAllUsers, getUserById, createUser, updateUser, updateUserPassword, deleteUser } from "../controller/users.js";
import {authMiddleware, roleMiddleware} from "../middleware/auth.js";

const router: Router = Router();
router.get('/users', authMiddleware, roleMiddleware("super_admin"), getAllUsers);
router.get('/users/:id', authMiddleware, roleMiddleware("super_admin"), getUserById);
router.post('/users', authMiddleware, roleMiddleware("super_admin"), createUser);
router.put('/users/:id', authMiddleware, roleMiddleware("super_admin"), updateUser);
router.put('/users/:id/password', authMiddleware, roleMiddleware("super_admin"), updateUserPassword);
router.delete('/users/:id', authMiddleware, roleMiddleware("super_admin"), deleteUser);

export default router;