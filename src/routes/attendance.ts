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
import {requireFeature} from "../middleware/requireFeature.js";

const router: Router = Router();

// Per-school feature switches controlled by the super admin.
const attendanceOn = requireFeature("attendance");
const attendanceReportsOn = requireFeature("attendance", "attendance_reports");

// Faculty and School Admin: class-specific attendance
router.get('/attendance/class/:classId', authMiddleware, roleMiddleware('faculty', 'school_admin'), attendanceOn, getAttendance);
router.post('/attendance/class/:classId', authMiddleware, roleMiddleware('faculty', 'school_admin'), attendanceOn, markAttendance);
router.put('/attendance/class/:classId', authMiddleware, roleMiddleware('faculty', 'school_admin'), attendanceOn, editAttendance);
router.post('/attendance/sessions', authMiddleware, roleMiddleware('faculty', 'school_admin'), attendanceOn, createAttendanceSession);
router.get('/attendance/sessions/:classId', authMiddleware, roleMiddleware('faculty', 'school_admin'), attendanceOn, getClassSessions);

// School Admin: school-wide attendance view (single date)
router.get('/attendance/school/:schoolId', authMiddleware, roleMiddleware('school_admin'), attendanceOn, getSchoolAttendance);

// General attendance history with filters (faculty, school_admin)
router.get('/attendance/history', authMiddleware, roleMiddleware('faculty', 'school_admin'), attendanceOn, getAttendanceHistory);

// Faculty dashboard summary
router.get('/attendance/faculty/summary', authMiddleware, roleMiddleware('faculty'), attendanceOn, getFacultyDashboardSummary);

// Student attendance endpoints
router.get('/attendance/student/me', authMiddleware, roleMiddleware('student'), attendanceOn, getStudentAttendanceBySubject);
router.get('/attendance/student/me/records', authMiddleware, roleMiddleware('student'), attendanceOn, getAllStudentAttendanceRecords);
router.get('/attendance/student/me/:classId/:subjectId', authMiddleware, roleMiddleware('student'), attendanceOn, getStudentAttendanceDetail);

// School admin attendance report
router.get('/attendance/school/:schoolId/report', authMiddleware, roleMiddleware('school_admin'), attendanceReportsOn, getSchoolAttendanceReport);

// School admin classroom attendance history matrix (month view)
router.get('/attendance/school/:schoolId/matrix', authMiddleware, roleMiddleware('school_admin'), attendanceReportsOn, getSchoolAttendanceMatrix);

export default router;