import dotenv from "dotenv";

dotenv.config({
    path: ".env"
})

const systemStatus = process.env.SYSTEM_STATUS === "production"

dotenv.config({
    path: systemStatus ? ".env.production" : ".env.development"
});

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// ======================= Routes =================
import SchoolRouter  from "./routes/school.js"
import AuthRouter from "./routes/auth.js";
import SchoolAdminRouter from "./routes/school_admins.js";
import FacultyRouter from "./routes/faculties.js";
import StudentRouter from "./routes/students.js";
import ModuleRouter from "./routes/modules.js";
import SubjectRouter from "./routes/subjects.js";
import ClassRouter from "./routes/classes.js";
import EnrollmentRouter from "./routes/enrollments.js";
import AttendanceRouter from "./routes/attendance.js";
import SchoolYearRouter from "./routes/school-years.js";
import UserRouter from "./routes/users.js";
import GradebookRouter from "./routes/gradebook.js";

// ================== Types ====================
import type{ Express } from "express";

// ==================  Middleware ======================
import ErrorHandler from "./middleware/ErrorHandler.js"
const app: Express = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));

app.use('/api', SchoolRouter);
app.use('/api', AuthRouter);
app.use('/api', SchoolAdminRouter);
app.use('/api', FacultyRouter);
app.use('/api', StudentRouter);
app.use('/api', ModuleRouter);
app.use('/api', SubjectRouter);
app.use('/api', ClassRouter);
app.use('/api', EnrollmentRouter);
app.use('/api', AttendanceRouter);
app.use('/api', SchoolYearRouter);
app.use('/api', UserRouter);
app.use('/api', GradebookRouter);

app.use(ErrorHandler)

export default app;