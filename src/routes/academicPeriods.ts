import { Router } from "express";
import {
    getPeriods,
    getCurrentPeriod,
    createPeriod,
    updatePeriod,
    deletePeriod,
    setCurrentPeriod,
    generatePeriods,
} from "../controller/academicPeriods.js";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { enforceSchoolScope, enforceSchoolParam } from "../middleware/schoolScope.js";

const router: Router = Router();

// List periods for a school year
router.get(
    "/academic-periods/school/:schoolId/year/:yearId",
    authMiddleware,
    enforceSchoolParam,
    getPeriods
);

// Get current period
router.get(
    "/academic-periods/school/:schoolId/current",
    authMiddleware,
    enforceSchoolParam,
    getCurrentPeriod
);

// Create a period
router.post(
    "/academic-periods",
    authMiddleware,
    roleMiddleware("school_admin"),
    enforceSchoolScope,
    createPeriod
);

// Update a period
router.put(
    "/academic-periods/:id",
    authMiddleware,
    roleMiddleware("school_admin"),
    updatePeriod
);

// Delete a period
router.delete(
    "/academic-periods/:id",
    authMiddleware,
    roleMiddleware("school_admin"),
    deletePeriod
);

// Set current period
router.put(
    "/academic-periods/:id/set-current",
    authMiddleware,
    roleMiddleware("school_admin"),
    setCurrentPeriod
);

// Generate missing periods
router.post(
    "/academic-periods/generate",
    authMiddleware,
    roleMiddleware("school_admin"),
    enforceSchoolScope,
    generatePeriods
);

export default router;
