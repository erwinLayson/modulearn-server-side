import { Router } from "express";
import type { RequestHandler } from "express";

import {
    registerModule,
    getModulesBySchoolId,
    getAllModules,
    getModuleById,
    updateModule,
    deleteModule,
    listMyModules,
    createMyModule,
    getMyModule,
    updateMyModule,
    getMyEligibleClassrooms,
    createMyModuleTemplate,
    updateMyModuleTemplate,
    deleteMyModuleTemplate,
} from "../controller/modules.js";
import {
    listModuleLessons,
    createModuleLesson,
    updateModuleLesson,
    deleteModuleLesson,
    downloadModuleLessonFile,
} from "../controller/moduleLessons.js";
import { lessonUpload } from "../middleware/lessonUpload.js";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { enforceSchoolScope, enforceSchoolParam, verifyOwnership } from "../middleware/schoolScope.js";

const router: Router = Router();

router.post('/modules', authMiddleware, roleMiddleware('school_admin'), enforceSchoolScope, registerModule);
router.get('/modules', authMiddleware, roleMiddleware('super_admin'), getAllModules);

// Teacher-owned module library. These must be registered before /modules/:id.
router.get('/modules/mine', authMiddleware, roleMiddleware('faculty'), listMyModules);
router.post('/modules/mine', authMiddleware, roleMiddleware('faculty'), createMyModule);
router.get('/modules/mine/:id', authMiddleware, roleMiddleware('faculty'), getMyModule);
router.put('/modules/mine/:id', authMiddleware, roleMiddleware('faculty'), updateMyModule);
router.get('/modules/mine/:id/eligible-classrooms', authMiddleware, roleMiddleware('faculty'), getMyEligibleClassrooms);
router.post('/modules/mine/:id/templates', authMiddleware, roleMiddleware('faculty'), createMyModuleTemplate);
router.put('/modules/mine/:id/templates/:templateId', authMiddleware, roleMiddleware('faculty'), updateMyModuleTemplate);
router.delete('/modules/mine/:id/templates/:templateId', authMiddleware, roleMiddleware('faculty'), deleteMyModuleTemplate);

// Lessons belonging to teacher-owned modules
router.get('/modules/mine/:id/lessons', authMiddleware, roleMiddleware('faculty'), listModuleLessons);
router.post('/modules/mine/:id/lessons', authMiddleware, roleMiddleware('faculty'), lessonUpload.single('file'), createModuleLesson as RequestHandler);
router.put('/modules/mine/:id/lessons/:lesson_id', authMiddleware, roleMiddleware('faculty'), lessonUpload.single('file'), updateModuleLesson as RequestHandler);
router.delete('/modules/mine/:id/lessons/:lesson_id', authMiddleware, roleMiddleware('faculty'), deleteModuleLesson);
router.get('/modules/mine/:id/lessons/:lesson_id/file', authMiddleware, roleMiddleware('faculty'), downloadModuleLessonFile);

router.get('/modules/school/:school_id', authMiddleware, roleMiddleware('school_admin', 'super_admin'), enforceSchoolParam, getModulesBySchoolId);
router.get('/modules/:id', authMiddleware, verifyOwnership('modules'), getModuleById);
router.put('/modules/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('modules'), updateModule);
router.delete('/modules/:id', authMiddleware, roleMiddleware('school_admin'), verifyOwnership('modules'), deleteModule);

export default router;
