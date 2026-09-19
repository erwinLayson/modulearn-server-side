import {Router} from "express";

import {
    markAttendance,
    editAttendance,
    createAttendanceSession,
    getClassSessions,
    getAttendance,
    getSchoolAttendance,
    getAttendanceHistory,
    getFacultyDashboardSummary,
    getStudentAttendanceBySubject,
    getStudentAttendanceDetail,
    getSchoolAttendanceReport,
    getSchoolAttendanceMatrix,
    getAllStudentAttendanceRecords
} from "../controller/attendance.js";
import {authMiddleware, roleMiddleware} from "../middleware/auth.js";

const router: Router = Router();

// Faculty and School Admin: class-specific attendance
router.get('/attendance/class/:classId', authMiddleware, roleMiddleware('faculty', 'school_admin'), getAttendance);
router.post('/attendance/class/:classId', authMiddleware, roleMiddleware('faculty', 'school_admin'), markAttendance);
router.put('/attendance/class/:classId', authMiddleware, roleMiddleware('faculty', 'school_admin'), editAttendance);
router.post('/attendance/sessions', authMiddleware, roleMiddleware('faculty', 'school_admin'), createAttendanceSession);
router.get('/attendance/sessions/:classId', authMiddleware, roleMiddleware('faculty', 'school_admin'), getClassSessions);

// School Admin: school-wide attendance view (single date)
router.get('/attendance/school/:schoolId', authMiddleware, roleMiddleware('school_admin'), getSchoolAttendance);

// General attendance history with filters (faculty, school_admin)
router.get('/attendance/history', authMiddleware, roleMiddleware('faculty', 'school_admin'), getAttendanceHistory);

// Faculty dashboard summary
router.get('/attendance/faculty/summary', authMiddleware, roleMiddleware('faculty'), getFacultyDashboardSummary);

// Student attendance endpoints
router.get('/attendance/student/me', authMiddleware, roleMiddleware('student'), getStudentAttendanceBySubject);
router.get('/attendance/student/me/records', authMiddleware, roleMiddleware('student'), getAllStudentAttendanceRecords);
router.get('/attendance/student/me/:classId/:subjectId', authMiddleware, roleMiddleware('student'), getStudentAttendanceDetail);

// School admin attendance report
router.get('/attendance/school/:schoolId/report', authMiddleware, roleMiddleware('school_admin'), getSchoolAttendanceReport);

// School admin classroom attendance history matrix (month view)
router.get('/attendance/school/:schoolId/matrix', authMiddleware, roleMiddleware('school_admin'), getSchoolAttendanceMatrix);

export default router;