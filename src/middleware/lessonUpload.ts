import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { BadRequestError } from "../helper/error.js";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads", "lessons");
if (!fs.existsSync(UPLOAD_ROOT)) {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_ROOT);
    },
    filename: (_req, file, cb) => {
        const unique = crypto.randomBytes(8).toString("hex");
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `lesson-${Date.now()}-${unique}${ext}`);
    },
});

const ALLOWED_EXTENSIONS = new Set([
    ".pdf",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".txt",
    ".md",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
]);

const fileFilter = (
    _req: any,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
        cb(null, true);
    } else {
        cb(new BadRequestError("Invalid file type. Allowed: PDF, Word, PowerPoint, Excel, text, and images."));
    }
};

export const lessonUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
});

export const removeLessonFile = async (filePath: string | null) => {
    if (!filePath) return;
    try {
        const fullPath = path.resolve(process.cwd(), filePath.replace(/^\/+/, ""));
        if (fs.existsSync(fullPath)) {
            await fs.promises.unlink(fullPath);
        }
    } catch (err) {
        console.warn("Failed to delete lesson file:", filePath, err);
    }
};
