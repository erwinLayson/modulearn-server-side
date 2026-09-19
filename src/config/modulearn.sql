-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 19, 2026 at 10:20 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `eduflow`
--

-- --------------------------------------------------------

--
-- Table structure for table `attendance_records`
--

CREATE TABLE `attendance_records` (
  `id` bigint(20) NOT NULL,
  `class_id` binary(16) NOT NULL,
  `student_id` binary(16) NOT NULL,
  `subject_id` binary(16) NOT NULL,
  `attendance_date` date NOT NULL,
  `status` enum('present','absent') NOT NULL,
  `marked_by` binary(16) NOT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `attendance_records`
--

INSERT INTO `attendance_records` (`id`, `class_id`, `student_id`, `subject_id`, `attendance_date`, `status`, `marked_by`, `recorded_at`) VALUES
(5, 0x64313e79348b46868e348a73f6097c10, 0x8b20cc8b52854c82b82e704719deb6d2, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-19', 'present', 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 06:15:44'),
(6, 0x64313e79348b46868e348a73f6097c10, 0x1b5a1184286e45ed8a56fd4c0e20474a, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-19', 'present', 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 06:15:44'),
(7, 0x64313e79348b46868e348a73f6097c10, 0x8b20cc8b52854c82b82e704719deb6d2, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-18', 'present', 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 06:34:54'),
(8, 0x64313e79348b46868e348a73f6097c10, 0x1b5a1184286e45ed8a56fd4c0e20474a, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-18', 'present', 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 06:34:54'),
(9, 0x64313e79348b46868e348a73f6097c10, 0x8b20cc8b52854c82b82e704719deb6d2, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-17', 'present', 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 06:35:10'),
(10, 0x64313e79348b46868e348a73f6097c10, 0x1b5a1184286e45ed8a56fd4c0e20474a, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-17', 'absent', 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 06:35:10'),
(11, 0x64313e79348b46868e348a73f6097c10, 0x8b20cc8b52854c82b82e704719deb6d2, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-16', 'present', 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 06:37:57'),
(12, 0x64313e79348b46868e348a73f6097c10, 0x1b5a1184286e45ed8a56fd4c0e20474a, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-16', 'present', 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 06:37:57'),
(13, 0x64313e79348b46868e348a73f6097c10, 0x8b20cc8b52854c82b82e704719deb6d2, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-15', 'present', 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 06:38:08'),
(14, 0x64313e79348b46868e348a73f6097c10, 0x1b5a1184286e45ed8a56fd4c0e20474a, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-15', 'present', 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 06:38:08'),
(15, 0x64313e79348b46868e348a73f6097c10, 0x8b20cc8b52854c82b82e704719deb6d2, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-14', 'absent', 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 06:53:17'),
(16, 0x64313e79348b46868e348a73f6097c10, 0x1b5a1184286e45ed8a56fd4c0e20474a, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-14', 'present', 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 06:53:17');

-- --------------------------------------------------------

--
-- Table structure for table `classes`
--

CREATE TABLE `classes` (
  `id` binary(16) NOT NULL,
  `class_name` varchar(255) NOT NULL,
  `school_id` bigint(20) NOT NULL,
  `faculty_id` binary(16) NOT NULL,
  `capacity` int(11) DEFAULT NULL,
  `section` varchar(50) DEFAULT NULL,
  `grade_level` varchar(50) DEFAULT NULL,
  `schedule` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`schedule`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `classes`
--

INSERT INTO `classes` (`id`, `class_name`, `school_id`, `faculty_id`, `capacity`, `section`, `grade_level`, `schedule`, `created_at`, `updated_at`) VALUES
(0x64313e79348b46868e348a73f6097c10, 'Sampaguita', 12345, 0xfa4476b3b7c34e7c9177284f074a17fb, 30, 'A', '12', '[{\"day\":\"Mon\",\"start_time\":\"08:00\",\"end_time\":\"09:30\"},{\"day\":\"Tue\",\"start_time\":\"08:00\",\"end_time\":\"09:30\"}]', '2026-09-18 08:40:57', '2026-09-18 08:41:45'),
(0x75842ab1f05746d4b8f8ac229fd77f5f, 'Rose', 12345, 0x846f50d115334e80b3828676e0ad1fe0, 30, 'A', '12', '[{\"day\":\"Mon\",\"start_time\":\"08:00\",\"end_time\":\"09:30\"}]', '2026-09-18 15:30:01', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `class_faculties`
--

CREATE TABLE `class_faculties` (
  `id` bigint(20) NOT NULL,
  `class_id` binary(16) NOT NULL,
  `faculty_id` binary(16) NOT NULL,
  `subject_id` binary(16) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `class_faculties`
--

INSERT INTO `class_faculties` (`id`, `class_id`, `faculty_id`, `subject_id`, `created_at`) VALUES
(4, 0x64313e79348b46868e348a73f6097c10, 0xfa4476b3b7c34e7c9177284f074a17fb, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-18 08:41:56'),
(8, 0x64313e79348b46868e348a73f6097c10, 0x846f50d115334e80b3828676e0ad1fe0, 0x05ed0da685bb47bba82587e8da1cb8fd, '2026-09-18 11:42:32'),
(9, 0x75842ab1f05746d4b8f8ac229fd77f5f, 0xfa4476b3b7c34e7c9177284f074a17fb, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-18 15:30:12');

-- --------------------------------------------------------

--
-- Table structure for table `enrollments`
--

CREATE TABLE `enrollments` (
  `id` binary(16) NOT NULL,
  `student_id` binary(16) NOT NULL,
  `class_id` binary(16) NOT NULL,
  `school_year_id` bigint(20) DEFAULT NULL,
  `grade_level` int(11) DEFAULT NULL,
  `enrolled_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('active','dropped','completed') NOT NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `enrollments`
--

INSERT INTO `enrollments` (`id`, `student_id`, `class_id`, `school_year_id`, `grade_level`, `enrolled_at`, `status`) VALUES
(0x01669693b73446a597a057038a1c0442, 0x8b20cc8b52854c82b82e704719deb6d2, 0x64313e79348b46868e348a73f6097c10, 1, 12, '2026-09-18 08:43:44', 'active'),
(0xda69a45464a947ec95f53db2d14e35f5, 0x1b5a1184286e45ed8a56fd4c0e20474a, 0x64313e79348b46868e348a73f6097c10, 1, 12, '2026-09-18 08:42:22', 'active');

-- --------------------------------------------------------

--
-- Table structure for table `enrollment_subjects`
--

CREATE TABLE `enrollment_subjects` (
  `id` bigint(20) NOT NULL,
  `enrollment_id` binary(16) NOT NULL,
  `subject_id` binary(16) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `enrollment_subjects`
--

INSERT INTO `enrollment_subjects` (`id`, `enrollment_id`, `subject_id`, `created_at`) VALUES
(2, 0xda69a45464a947ec95f53db2d14e35f5, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-18 08:42:22'),
(3, 0x01669693b73446a597a057038a1c0442, 0xc2f72cd56c1a4bef8bf19f0276241d4b, '2026-09-18 08:43:44');

-- --------------------------------------------------------

--
-- Table structure for table `faculties`
--

CREATE TABLE `faculties` (
  `id` binary(16) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `school_id` bigint(20) NOT NULL,
  `contact_number` varchar(255) DEFAULT NULL,
  `faculty_role` enum('teacher','cashier','register') NOT NULL DEFAULT 'teacher',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `admin_id` binary(16) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `faculties`
--

INSERT INTO `faculties` (`id`, `first_name`, `last_name`, `email`, `password`, `school_id`, `contact_number`, `faculty_role`, `created_at`, `updated_at`, `admin_id`) VALUES
(0x846f50d115334e80b3828676e0ad1fe0, 'John', 'Doe', 'john@school.edu.ph', '$2b$10$mMCaTM81edavNr3c4/QGTupjlr2ee9udzWLe1p0OIdxD1/uMK9Ude', 12345, '09839213139', 'teacher', '2026-09-18 11:10:37', NULL, 0x4e9a90f2166846f18893c42f2c4b89b5),
(0xfa4476b3b7c34e7c9177284f074a17fb, 'Erwin', 'Layson', 'erwin@school.edu.ph', '$2b$10$EKIfHTLtGpMJNpRuiiZrVOn2qj4KamY2ypEWGy6p.Ufjlo3Z.Fg9K', 12345, '0998787781', 'teacher', '2026-09-18 07:08:39', '2026-09-18 07:21:48', 0x4e9a90f2166846f18893c42f2c4b89b5);

-- --------------------------------------------------------

--
-- Table structure for table `grades`
--

CREATE TABLE `grades` (
  `id` bigint(20) NOT NULL,
  `grade_item_id` binary(16) NOT NULL,
  `student_id` binary(16) NOT NULL,
  `score` decimal(10,2) NOT NULL,
  `recorded_by` binary(16) NOT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `grades`
--

INSERT INTO `grades` (`id`, `grade_item_id`, `student_id`, `score`, `recorded_by`, `recorded_at`) VALUES
(1, 0xb868dc182ede446bbecad3fcd30d40a0, 0x1b5a1184286e45ed8a56fd4c0e20474a, 20.00, 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 04:56:17'),
(2, 0xb868dc182ede446bbecad3fcd30d40a0, 0x8b20cc8b52854c82b82e704719deb6d2, 15.00, 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 04:56:17'),
(3, 0x7864640630d0472ba21600dd20748015, 0x1b5a1184286e45ed8a56fd4c0e20474a, 10.00, 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 05:02:36'),
(4, 0x7864640630d0472ba21600dd20748015, 0x8b20cc8b52854c82b82e704719deb6d2, 1.00, 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 05:02:36'),
(7, 0x0611da9f2d174676ada09e1bbe3e0dbb, 0x1b5a1184286e45ed8a56fd4c0e20474a, 75.00, 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 05:03:53'),
(8, 0x0611da9f2d174676ada09e1bbe3e0dbb, 0x8b20cc8b52854c82b82e704719deb6d2, 83.50, 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-19 05:03:53');

-- --------------------------------------------------------

--
-- Table structure for table `grade_items`
--

CREATE TABLE `grade_items` (
  `id` binary(16) NOT NULL,
  `class_id` binary(16) NOT NULL,
  `subject_id` binary(16) NOT NULL,
  `faculty_id` binary(16) NOT NULL,
  `category` enum('activities','quizzes','exams') NOT NULL,
  `title` varchar(255) NOT NULL,
  `max_score` decimal(10,2) NOT NULL,
  `due_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `grade_items`
--

INSERT INTO `grade_items` (`id`, `class_id`, `subject_id`, `faculty_id`, `category`, `title`, `max_score`, `due_date`, `created_at`, `updated_at`) VALUES
(0x0611da9f2d174676ada09e1bbe3e0dbb, 0x64313e79348b46868e348a73f6097c10, 0xc2f72cd56c1a4bef8bf19f0276241d4b, 0xfa4476b3b7c34e7c9177284f074a17fb, 'exams', 'Quarter exam', 100.00, '2026-09-19', '2026-09-19 05:03:14', NULL),
(0x7864640630d0472ba21600dd20748015, 0x64313e79348b46868e348a73f6097c10, 0xc2f72cd56c1a4bef8bf19f0276241d4b, 0xfa4476b3b7c34e7c9177284f074a17fb, 'quizzes', 'Quiz 1', 10.00, '2026-09-19', '2026-09-19 05:02:14', NULL),
(0xb868dc182ede446bbecad3fcd30d40a0, 0x64313e79348b46868e348a73f6097c10, 0xc2f72cd56c1a4bef8bf19f0276241d4b, 0xfa4476b3b7c34e7c9177284f074a17fb, 'activities', 'Activity 1', 20.00, '2026-09-19', '2026-09-19 04:46:29', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `grading_weights`
--

CREATE TABLE `grading_weights` (
  `id` bigint(20) NOT NULL,
  `class_id` binary(16) NOT NULL,
  `subject_id` binary(16) NOT NULL,
  `category` enum('activities','quizzes','exams','attendance') NOT NULL,
  `weight` decimal(5,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `grading_weights`
--

INSERT INTO `grading_weights` (`id`, `class_id`, `subject_id`, `category`, `weight`, `created_at`, `updated_at`) VALUES
(1, 0x64313e79348b46868e348a73f6097c10, 0xc2f72cd56c1a4bef8bf19f0276241d4b, 'activities', 20.00, '2026-09-19 04:44:52', NULL),
(2, 0x64313e79348b46868e348a73f6097c10, 0xc2f72cd56c1a4bef8bf19f0276241d4b, 'quizzes', 30.00, '2026-09-19 04:44:52', NULL),
(3, 0x64313e79348b46868e348a73f6097c10, 0xc2f72cd56c1a4bef8bf19f0276241d4b, 'exams', 40.00, '2026-09-19 04:44:52', NULL),
(4, 0x64313e79348b46868e348a73f6097c10, 0xc2f72cd56c1a4bef8bf19f0276241d4b, 'attendance', 10.00, '2026-09-19 04:44:52', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(11) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `executed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `filename`, `executed_at`) VALUES
(52, '000_create_migrations_table', '2026-09-19 08:18:45'),
(53, '001_create_users', '2026-09-19 08:18:45'),
(54, '002_create_school_admins', '2026-09-19 08:18:45'),
(55, '003_create_schools', '2026-09-19 08:18:45'),
(56, '004_create_faculties', '2026-09-19 08:18:45'),
(57, '005_create_students', '2026-09-19 08:18:45'),
(58, '006_create_subjects', '2026-09-19 08:18:45'),
(59, '007_create_modules', '2026-09-19 08:18:45'),
(60, '008_create_school_years', '2026-09-19 08:18:45'),
(61, '009_create_classes', '2026-09-19 08:18:45'),
(62, '010_create_enrollments', '2026-09-19 08:18:45'),
(63, '011_create_subject_faculties', '2026-09-19 08:18:45'),
(64, '012_create_class_faculties', '2026-09-19 08:18:45'),
(65, '013_create_enrollment_subjects', '2026-09-19 08:18:45'),
(66, '014_create_attendance_records', '2026-09-19 08:18:45'),
(67, '015_create_grading_weights', '2026-09-19 08:18:45'),
(68, '016_create_grade_items', '2026-09-19 08:18:45'),
(69, '017_create_grades', '2026-09-19 08:18:45');

-- --------------------------------------------------------

--
-- Table structure for table `modules`
--

CREATE TABLE `modules` (
  `id` binary(16) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `school_id` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `admin_id` binary(16) NOT NULL,
  `subject_id` binary(16) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `schools`
--

CREATE TABLE `schools` (
  `id` binary(16) NOT NULL,
  `school_id` bigint(20) NOT NULL,
  `school_name` varchar(255) NOT NULL,
  `school_level` int(11) NOT NULL,
  `school_email` varchar(255) NOT NULL,
  `address` varchar(255) NOT NULL,
  `region` varchar(255) NOT NULL,
  `province` varchar(255) NOT NULL,
  `city` varchar(255) NOT NULL,
  `contact_number` varchar(255) NOT NULL,
  `school_logo` varchar(255) NOT NULL,
  `school_admin` varchar(255) NOT NULL,
  `registered_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `admin_id` binary(16) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `schools`
--

INSERT INTO `schools` (`id`, `school_id`, `school_name`, `school_level`, `school_email`, `address`, `region`, `province`, `city`, `contact_number`, `school_logo`, `school_admin`, `registered_at`, `updated_at`, `admin_id`) VALUES
(0xdeb8ff0fe122400894d1404133afb51d, 12345, 'Abang Suizo Integrated School', 2, 'abang@school.edu.ph', 'Purok Abang suizo', '12', 'Sultan Kudarat', 'Tacurong', '0998787781', 'https://tse2.mm.bing.net/th/id/OIP.QfGo5bgCklncx1VtRBsEcAHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3', 'Erwin B. Layson', '2026-09-18 07:08:06', NULL, 0x4e9a90f2166846f18893c42f2c4b89b5);

-- --------------------------------------------------------

--
-- Table structure for table `school_admins`
--

CREATE TABLE `school_admins` (
  `id` binary(16) NOT NULL,
  `email` varchar(255) NOT NULL,
  `school_id` bigint(20) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `school_admins`
--

INSERT INTO `school_admins` (`id`, `email`, `school_id`, `password`, `created_at`, `updated_at`) VALUES
(0x4e9a90f2166846f18893c42f2c4b89b5, 'abang@school.edu.ph', 12345, '$2b$10$vARAlf/M6EtNxJo2ci0gDursRcp3LsLHyVuntCoHG.uYHbejNJC7y', '2026-09-18 07:08:06', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `school_years`
--

CREATE TABLE `school_years` (
  `id` bigint(20) NOT NULL,
  `name` varchar(50) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `school_id` bigint(20) NOT NULL,
  `is_current` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `school_years`
--

INSERT INTO `school_years` (`id`, `name`, `start_date`, `end_date`, `school_id`, `is_current`, `created_at`) VALUES
(1, '2026-2027', '2026-06-01', '2027-05-31', 12345, 1, '2026-09-18 03:33:53'),
(3, '2027-2028', '2027-06-01', '2028-05-31', 12345, 0, '2026-09-18 03:33:53');

-- --------------------------------------------------------

--
-- Table structure for table `students`
--

CREATE TABLE `students` (
  `id` binary(16) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `middle_name` varchar(255) DEFAULT '',
  `last_name` varchar(255) NOT NULL,
  `extension_name` varchar(50) DEFAULT '',
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `school_id` bigint(20) NOT NULL,
  `lrn` varchar(20) DEFAULT '',
  `date_of_birth` date DEFAULT NULL,
  `place_of_birth` varchar(255) DEFAULT '',
  `sex` enum('male','female') NOT NULL DEFAULT 'male',
  `nationality` varchar(100) DEFAULT 'Filipino',
  `region` varchar(255) DEFAULT '',
  `province` varchar(255) DEFAULT '',
  `city_municipality` varchar(255) DEFAULT '',
  `barangay` varchar(255) DEFAULT '',
  `purok_street` varchar(255) DEFAULT '',
  `contact_number` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `admin_id` binary(16) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `students`
--

INSERT INTO `students` (`id`, `first_name`, `middle_name`, `last_name`, `extension_name`, `email`, `password`, `school_id`, `lrn`, `date_of_birth`, `place_of_birth`, `sex`, `nationality`, `region`, `province`, `city_municipality`, `barangay`, `purok_street`, `contact_number`, `created_at`, `updated_at`, `admin_id`) VALUES
(0x1b5a1184286e45ed8a56fd4c0e20474a, 'John', 'Michael', 'Doe', 'Jr.', 'john@example.com', '', 12345, '123456789012', '2010-05-15', 'Manila', 'male', 'Filipino', 'NCR', 'Manila', 'Manila', 'Barangay 1', 'Purok 1', '555-0101', '2026-09-18 08:38:38', NULL, 0x4e9a90f2166846f18893c42f2c4b89b5),
(0x8b20cc8b52854c82b82e704719deb6d2, 'Jane', 'Anne', 'Smith', '', 'jane@example.com', '', 12345, '123456789013', '2009-08-22', 'Quezon City', 'female', 'Filipino', 'NCR', 'Quezon City', 'Quezon City', 'Barangay 2', 'Purok 2', '555-0102', '2026-09-18 08:38:38', NULL, 0x4e9a90f2166846f18893c42f2c4b89b5),
(0xa95d34d50ccb4eaf8b386816c8691584, 'Jason', 'Balboa', 'Madrin', '', 'jason@school.edu.ph', '', 12345, '123131232', '2003-05-23', 'tinaungan', 'male', 'Filipino', '12', 'Sultan Kudarat', 'President quirno', 'tinaugan', 'purok 5', '0998787781', '2026-09-18 08:38:29', NULL, 0x4e9a90f2166846f18893c42f2c4b89b5);

-- --------------------------------------------------------

--
-- Table structure for table `subjects`
--

CREATE TABLE `subjects` (
  `id` binary(16) NOT NULL,
  `name` varchar(255) NOT NULL,
  `subject_code` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `school_id` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `admin_id` binary(16) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `subjects`
--

INSERT INTO `subjects` (`id`, `name`, `subject_code`, `description`, `school_id`, `created_at`, `updated_at`, `admin_id`) VALUES
(0x05ed0da685bb47bba82587e8da1cb8fd, 'Science', 'SCI1', '', 12345, '2026-09-18 11:11:02', NULL, 0x4e9a90f2166846f18893c42f2c4b89b5),
(0xc2f72cd56c1a4bef8bf19f0276241d4b, 'Mathematics', 'Math12', '', 12345, '2026-09-18 08:41:15', NULL, 0x4e9a90f2166846f18893c42f2c4b89b5);

-- --------------------------------------------------------

--
-- Table structure for table `subject_faculties`
--

CREATE TABLE `subject_faculties` (
  `id` bigint(20) NOT NULL,
  `subject_id` binary(16) NOT NULL,
  `faculty_id` binary(16) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `subject_faculties`
--

INSERT INTO `subject_faculties` (`id`, `subject_id`, `faculty_id`, `created_at`) VALUES
(5, 0xc2f72cd56c1a4bef8bf19f0276241d4b, 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-18 08:41:27'),
(6, 0x05ed0da685bb47bba82587e8da1cb8fd, 0x846f50d115334e80b3828676e0ad1fe0, '2026-09-18 11:11:14'),
(7, 0x05ed0da685bb47bba82587e8da1cb8fd, 0xfa4476b3b7c34e7c9177284f074a17fb, '2026-09-18 11:11:19');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` binary(16) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('super_admin','school_admin','faculty','student') NOT NULL,
  `status` enum('active','inactive','suspended') NOT NULL DEFAULT 'active',
  `name` varchar(255) DEFAULT NULL,
  `school_id` bigint(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `role`, `status`, `name`, `school_id`, `created_at`, `updated_at`) VALUES
(0x1b5a1184286e45ed8a56fd4c0e20474a, 'john@example.com', '$2b$10$jsSMOVG3Ho2P0GKW8/6xre98wBiK1XEVPquup3HJDzK3tqEuRhYTu', 'student', 'active', 'John Doe', 12345, '2026-09-18 08:38:38', NULL),
(0x4e9a90f2166846f18893c42f2c4b89b5, 'abang@school.edu.ph', '$2b$10$vARAlf/M6EtNxJo2ci0gDursRcp3LsLHyVuntCoHG.uYHbejNJC7y', 'school_admin', 'active', 'Erwin B. Layson', 12345, '2026-09-18 07:08:06', NULL),
(0x846f50d115334e80b3828676e0ad1fe0, 'john@school.edu.ph', '$2b$10$mMCaTM81edavNr3c4/QGTupjlr2ee9udzWLe1p0OIdxD1/uMK9Ude', 'faculty', 'active', 'John Doe', 12345, '2026-09-18 11:10:37', NULL),
(0x8b20cc8b52854c82b82e704719deb6d2, 'jane@example.com', '$2b$10$jsSMOVG3Ho2P0GKW8/6xre98wBiK1XEVPquup3HJDzK3tqEuRhYTu', 'student', 'active', 'Jane Smith', 12345, '2026-09-18 08:38:38', NULL),
(0xa1b2c3d4e5f67890abcdef1234567890, 'superadmin@modulearn.com', '$2b$10$Y.hFWfMWcd/OKRNFpZtbIejikr1MDOxwveNceQaO32ZEKi14yW.1G', 'super_admin', 'active', 'super', NULL, '2026-09-17 10:36:17', '2026-09-17 11:05:53'),
(0xa95d34d50ccb4eaf8b386816c8691584, 'jason@school.edu.ph', '$2b$10$bobmwcAHX49nXgugBsPzG.XOBb1ML3/zWRBebcffqJiv4W7qs8eUe', 'student', 'active', 'Jason Madrin', 12345, '2026-09-18 08:38:29', NULL),
(0xfa4476b3b7c34e7c9177284f074a17fb, 'erwin@school.edu.ph', '$2b$10$EKIfHTLtGpMJNpRuiiZrVOn2qj4KamY2ypEWGy6p.Ufjlo3Z.Fg9K', 'faculty', 'active', 'Mathematics Mathematics', 12345, '2026-09-18 07:08:39', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `attendance_records`
--
ALTER TABLE `attendance_records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_attendance_class_student_subject_date` (`class_id`,`student_id`,`subject_id`,`attendance_date`),
  ADD KEY `fk_attendance_student_id` (`student_id`),
  ADD KEY `fk_attendance_marked_by` (`marked_by`),
  ADD KEY `idx_attendance_class_date` (`class_id`,`recorded_at`),
  ADD KEY `fk_attendance_subject` (`subject_id`),
  ADD KEY `idx_attendance_class_subject_date` (`class_id`,`subject_id`,`attendance_date`),
  ADD KEY `idx_attendance_date` (`attendance_date`);

--
-- Indexes for table `classes`
--
ALTER TABLE `classes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_class_adviser` (`faculty_id`),
  ADD KEY `idx_classes_school_id` (`school_id`);

--
-- Indexes for table `class_faculties`
--
ALTER TABLE `class_faculties`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_class_faculty` (`class_id`,`faculty_id`),
  ADD UNIQUE KEY `unique_class_faculty_subject` (`class_id`,`faculty_id`,`subject_id`),
  ADD KEY `fk_class_faculties_faculty_id` (`faculty_id`),
  ADD KEY `fk_class_faculties_subject` (`subject_id`);

--
-- Indexes for table `enrollments`
--
ALTER TABLE `enrollments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_enrollments_student_id` (`student_id`),
  ADD KEY `fk_enrollments_class_id` (`class_id`),
  ADD KEY `fk_enrollments_school_year` (`school_year_id`);

--
-- Indexes for table `enrollment_subjects`
--
ALTER TABLE `enrollment_subjects`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_enrollment_subject` (`enrollment_id`,`subject_id`),
  ADD KEY `fk_enrollment_subjects_subject` (`subject_id`);

--
-- Indexes for table `faculties`
--
ALTER TABLE `faculties`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `fk_faculties_admin_id` (`admin_id`),
  ADD KEY `idx_faculties_school_id` (`school_id`);

--
-- Indexes for table `grades`
--
ALTER TABLE `grades`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_grades` (`grade_item_id`,`student_id`),
  ADD KEY `fk_grades_recorded_by` (`recorded_by`),
  ADD KEY `idx_grades_student` (`student_id`);

--
-- Indexes for table `grade_items`
--
ALTER TABLE `grade_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_grade_items` (`class_id`,`subject_id`,`title`),
  ADD KEY `fk_grade_items_subject` (`subject_id`),
  ADD KEY `fk_grade_items_faculty` (`faculty_id`),
  ADD KEY `idx_grade_items_class_subject` (`class_id`,`subject_id`);

--
-- Indexes for table `grading_weights`
--
ALTER TABLE `grading_weights`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_grading_weights` (`class_id`,`subject_id`,`category`),
  ADD KEY `fk_grading_weights_subject` (`subject_id`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `filename` (`filename`);

--
-- Indexes for table `modules`
--
ALTER TABLE `modules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_modules_admin_id` (`admin_id`),
  ADD KEY `fk_modules_subject_id` (`subject_id`),
  ADD KEY `idx_modules_school_id` (`school_id`);

--
-- Indexes for table `schools`
--
ALTER TABLE `schools`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `school_email` (`school_email`),
  ADD KEY `fk_admin_id` (`admin_id`),
  ADD KEY `idx_schools_school_id` (`school_id`);

--
-- Indexes for table `school_admins`
--
ALTER TABLE `school_admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_school_admins_school_id` (`school_id`);

--
-- Indexes for table `school_years`
--
ALTER TABLE `school_years`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_school_year_name` (`name`,`school_id`),
  ADD KEY `fk_school_years_school_id` (`school_id`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `fk_students_admin_id` (`admin_id`),
  ADD KEY `idx_students_school_id` (`school_id`);

--
-- Indexes for table `subjects`
--
ALTER TABLE `subjects`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_subjects_name_school` (`name`,`school_id`),
  ADD KEY `fk_subjects_admin_id` (`admin_id`),
  ADD KEY `fk_subjects_school_id` (`school_id`);

--
-- Indexes for table `subject_faculties`
--
ALTER TABLE `subject_faculties`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_subject_faculty` (`subject_id`,`faculty_id`),
  ADD KEY `fk_subject_faculties_faculty_id` (`faculty_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_users_school_id` (`school_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `attendance_records`
--
ALTER TABLE `attendance_records`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `class_faculties`
--
ALTER TABLE `class_faculties`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `enrollment_subjects`
--
ALTER TABLE `enrollment_subjects`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `grades`
--
ALTER TABLE `grades`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `grading_weights`
--
ALTER TABLE `grading_weights`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=70;

--
-- AUTO_INCREMENT for table `school_years`
--
ALTER TABLE `school_years`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `subject_faculties`
--
ALTER TABLE `subject_faculties`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `attendance_records`
--
ALTER TABLE `attendance_records`
  ADD CONSTRAINT `fk_attendance_class_id` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attendance_marked_by` FOREIGN KEY (`marked_by`) REFERENCES `faculties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attendance_student_id` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attendance_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`);

--
-- Constraints for table `classes`
--
ALTER TABLE `classes`
  ADD CONSTRAINT `fk_classes_faculty_id` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_classes_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`);

--
-- Constraints for table `class_faculties`
--
ALTER TABLE `class_faculties`
  ADD CONSTRAINT `fk_class_faculties_class_id` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_class_faculties_faculty_id` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_class_faculties_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `enrollments`
--
ALTER TABLE `enrollments`
  ADD CONSTRAINT `fk_enrollments_class_id` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_enrollments_school_year` FOREIGN KEY (`school_year_id`) REFERENCES `school_years` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_enrollments_student_id` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `enrollment_subjects`
--
ALTER TABLE `enrollment_subjects`
  ADD CONSTRAINT `fk_enrollment_subjects_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_enrollment_subjects_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `faculties`
--
ALTER TABLE `faculties`
  ADD CONSTRAINT `fk_faculties_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`),
  ADD CONSTRAINT `fk_faculties_user_id` FOREIGN KEY (`id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `grades`
--
ALTER TABLE `grades`
  ADD CONSTRAINT `fk_grades_grade_item` FOREIGN KEY (`grade_item_id`) REFERENCES `grade_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_grades_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `faculties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_grades_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `grade_items`
--
ALTER TABLE `grade_items`
  ADD CONSTRAINT `fk_grade_items_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_grade_items_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_grade_items_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `grading_weights`
--
ALTER TABLE `grading_weights`
  ADD CONSTRAINT `fk_grading_weights_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_grading_weights_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `modules`
--
ALTER TABLE `modules`
  ADD CONSTRAINT `fk_modules_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`),
  ADD CONSTRAINT `fk_modules_subject_id` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `schools`
--
ALTER TABLE `schools`
  ADD CONSTRAINT `fk_admin_id` FOREIGN KEY (`admin_id`) REFERENCES `school_admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `school_admins`
--
ALTER TABLE `school_admins`
  ADD CONSTRAINT `fk_school_admins_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`),
  ADD CONSTRAINT `fk_school_admins_user_id` FOREIGN KEY (`id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `school_years`
--
ALTER TABLE `school_years`
  ADD CONSTRAINT `fk_school_years_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`);

--
-- Constraints for table `students`
--
ALTER TABLE `students`
  ADD CONSTRAINT `fk_students_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`),
  ADD CONSTRAINT `fk_students_user_id` FOREIGN KEY (`id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `subjects`
--
ALTER TABLE `subjects`
  ADD CONSTRAINT `fk_subjects_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`);

--
-- Constraints for table `subject_faculties`
--
ALTER TABLE `subject_faculties`
  ADD CONSTRAINT `fk_subject_faculties_faculty_id` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_subject_faculties_subject_id` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
