CREATE TABLE IF NOT EXISTS attendance_records (
    id              BIGINT     PRIMARY KEY AUTO_INCREMENT,
    class_id        BINARY(16) NOT NULL,
    student_id      BINARY(16) NOT NULL,
    subject_id      BINARY(16) NOT NULL,
    attendance_date DATE       NOT NULL,
    status          ENUM('present','absent') NOT NULL,
    marked_by       BINARY(16) NOT NULL,
    recorded_at     TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
    UNIQUE uq_attendance_class_student_subject_date (class_id, student_id, subject_id, attendance_date),
    INDEX idx_attendance_class_subject_date (class_id, subject_id, attendance_date),
    INDEX idx_attendance_date (attendance_date)
);
