-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Oct 28, 2026 at 05:08 PM
-- Server version: 11.8.9-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `banquetkitchen`
--

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `invoice_date` datetime NOT NULL,
  `event_date` date NOT NULL,
  `delivery_time` time NOT NULL,
  `delivery_period` varchar(20) NOT NULL,
  `delivery_address` text NOT NULL,
  `mark` varchar(255) DEFAULT NULL,
  `total_amount` decimal(12,2) NOT NULL,
  `plate_deposit` decimal(12,2) DEFAULT NULL,
  `plate_deposit_returned` decimal(12,2) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'new',
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `bookings`
--

INSERT INTO `bookings` (`id`, `customer_id`, `invoice_date`, `event_date`, `delivery_time`, `delivery_period`, `delivery_address`, `mark`, `total_amount`, `plate_deposit`, `plate_deposit_returned`, `status`, `notes`) VALUES
(1, 1, '2026-08-12 09:01:53', '2026-08-12', '22:00:00', 'مساءً', 'مخطط عبيد', '١٠', 250.00, 0.00, NULL, 'completed', 'نص مفطح ٣ صحون \n٢ يد مع الكبده ني'),
(2, 2, '2026-08-12 09:21:36', '2026-08-12', '20:00:00', 'مساءً', 'الحمدانيه', '١١', 360.00, 0.00, NULL, 'completed', 'مفطح يد ونص رقبه ٣ صحون'),
(3, 3, '2026-08-12 10:31:14', '2026-08-12', '20:00:00', 'مساءً', 'التيسير', '3 سواكني', 750.00, 0.00, NULL, 'completed', 'كابلي - 24 صحون'),
(4, 4, '2026-08-12 16:03:46', '2026-08-13', '13:00:00', 'ظهراً', 'محلي', 'تيس', 250.00, 0.00, NULL, 'completed', 'مندي - حضرمي - 5 صحون'),
(5, 5, '2026-08-12 17:06:23', '2026-08-12', '22:30:00', 'مساءً', 'مخطط العبيد', NULL, 317.50, 0.00, NULL, 'completed', 'مديني - مفطح - 3 صحون \nاليدات شقر مع الرقبه'),
(7, 7, '2026-08-13 15:46:23', '2026-08-14', '14:00:00', 'ظهراً', 'الرغامه', '٢', 400.00, 0.00, NULL, 'completed', 'ذبيحه ونص \nطبخ مديني \n٤ صحون'),
(8, 2, '2026-08-14 11:04:20', '2026-08-14', '22:30:00', 'مساءً', 'الأمير فواز', '٣', 370.00, 0.00, NULL, 'completed', 'طياره ٥ صحون \n\nراس شلوطه'),
(10, 8, '2026-08-15 11:58:19', '2026-08-15', '12:00:00', 'مساءً', 'شارع جاك', NULL, 1500.00, 0.00, NULL, 'completed', 'مديني - طياره - 4 صحون'),
(11, 9, '2026-08-16 07:27:28', '2026-08-16', '21:00:00', 'مساءً', 'الرغامه', '١٠', 250.00, 0.00, NULL, 'completed', 'مفاصل \n٧ صحون'),
(12, 10, '2026-08-17 15:35:55', '2026-08-17', '19:30:00', 'مساءً', '', '1', 250.00, 0.00, NULL, 'completed', 'مديني - مفاصل - 4 صحون \n2 صحون مميز و 1 صحن وسط و 1 صغير'),
(13, 11, '2026-08-19 12:18:20', '2026-08-25', '21:00:00', 'مساءً', 'قاعة عز', 'حجز', 3000.00, 0.00, NULL, 'completed', '1 حاشي - مديني - مفطح صندوق \n8 خروف حري - 24 صحون \nسلطات لبن وحمراء مجانا'),
(14, 12, '2026-08-20 07:39:21', '2026-08-20', '21:00:00', 'مساءً', 'الرايه', '٥', 250.00, 0.00, NULL, 'completed', 'التفصيل قوايم _ كبده وكرشه ني\nعلى ٥ صحون'),
(15, 13, '2026-08-20 15:13:58', '2026-08-21', '23:00:00', 'مساءً', 'الأمير فواز', '7', 280.00, 0.00, NULL, 'completed', 'شقر ارباع'),
(16, 14, '2026-08-21 11:08:13', '2026-08-21', '12:00:00', 'مساءً', 'الرغامه', '١١', 300.00, 0.00, NULL, 'completed', 'مفطح ٦ ضلوع - كبده مع جمب ني'),
(17, 15, '2026-08-21 11:09:21', '2026-08-21', '21:40:00', 'مساءً', 'قويزه', NULL, 1400.00, 0.00, NULL, 'completed', 'طبخ ولايم عشا 3 يوم'),
(18, 16, '2026-08-25 10:45:05', '2026-08-25', '20:00:00', 'مساءً', 'الخمره', NULL, 1300.00, 0.00, NULL, 'completed', 'مفاصل ٥ صحون'),
(19, 17, '2026-09-09 18:51:04', '2026-09-11', '20:00:00', 'مساءً', 'الجوهره', '150', 1500.00, 0.00, NULL, 'new', 'برياني - 10 صحون\nمسدد كامل'),
(20, 18, '2026-09-10 16:07:08', '2026-09-11', '13:00:00', 'ظهراً', 'الجبل', '1', 250.00, 0.00, NULL, 'new', 'سليق - مفطح - 4 صحون بدون قاعده'),
(21, 19, '2026-09-10 16:12:04', '2026-09-11', '12:00:00', 'مساءً', '2', '2', 250.00, 0.00, NULL, 'new', 'مديني - مفاصل - 4 صحون'),
(22, 20, '2026-09-10 17:01:13', '2026-09-10', '02:00:00', 'ظهراً', 'النسيم', 'غنم محمد الزهراني', 330.00, 0.00, NULL, 'new', 'مديني - حضرمي - 5 صحون'),
(23, 15, '2026-09-11 12:02:29', '2026-09-11', '22:00:00', 'مساءً', 'شاليهات المنصور', NULL, 200.00, 0.00, NULL, 'new', NULL),
(24, 6, '2026-09-13 00:00:00', '2026-09-13', '21:20:00', 'ليلًا', 'الرغامة', '150', 1510.00, 100.00, NULL, 'new', 'منتارؤ');

-- --------------------------------------------------------

--
-- Table structure for table `booking_items`
--

CREATE TABLE `booking_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `booking_id` bigint(20) UNSIGNED NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  `total_price` decimal(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `booking_items`
--

INSERT INTO `booking_items` (`id`, `booking_id`, `item_name`, `quantity`, `unit_price`, `total_price`) VALUES
(1, 1, 'طبخ مديني', 1.00, 250.00, 250.00),
(2, 2, 'طبخ مديني', 1.00, 250.00, 250.00),
(3, 2, 'رسوم توصيل', 1.00, 50.00, 50.00),
(4, 2, 'سلطه لبن', 10.00, 3.00, 30.00),
(5, 2, 'سلطه حمراء', 10.00, 3.00, 30.00),
(6, 4, 'طبخ مندي', 1.00, 250.00, 250.00),
(7, 5, 'طبخ مديني', 1.00, 250.00, 250.00),
(8, 5, 'سفن', 15.00, 2.50, 37.50),
(9, 5, 'لبن المراعي صغير', 15.00, 2.00, 30.00),
(10, 3, 'طبخ كابلي', 3.00, 250.00, 750.00),
(12, 7, 'طبخ مديني', 1.00, 250.00, 250.00),
(13, 7, 'طبخ مديني', 1.00, 150.00, 150.00),
(14, 8, 'طبخ مديني', 1.00, 250.00, 250.00),
(15, 8, 'رسوم توصيل', 1.00, 30.00, 30.00),
(16, 8, 'سلطه حمراء', 15.00, 3.00, 45.00),
(17, 8, 'سلطه طحينه', 15.00, 3.00, 45.00),
(20, 10, 'خروف حري', 1.00, 1500.00, 1500.00),
(21, 11, 'طبخ مديني', 1.00, 250.00, 250.00),
(22, 12, 'طبخ مديني', 1.00, 250.00, 250.00),
(23, 13, 'طبخ حاشي', 1.00, 1000.00, 1000.00),
(24, 13, 'طبخ مديني', 8.00, 250.00, 2000.00),
(25, 14, 'طبخ مديني', 1.00, 250.00, 250.00),
(26, 15, 'طبخ مديني', 1.00, 250.00, 250.00),
(27, 15, 'رسوم توصيل', 1.00, 30.00, 30.00),
(28, 16, 'طبخ مديني', 1.00, 250.00, 250.00),
(29, 16, 'رسوم توصيل', 1.00, 50.00, 50.00),
(30, 17, 'طبخ مديني', 7.00, 200.00, 1400.00),
(31, 18, 'خروف سواكني', 1.00, 1300.00, 1300.00),
(32, 19, 'خروف سواكني', 1.00, 1500.00, 1500.00),
(33, 20, 'طبخ سليق', 1.00, 250.00, 250.00),
(34, 21, 'طبخ مديني', 1.00, 250.00, 250.00),
(35, 22, 'طبخ مديني', 1.00, 250.00, 250.00),
(36, 22, 'سمبوسه', 60.00, 1.00, 60.00),
(37, 22, 'طرمبة', 20.00, 1.00, 20.00),
(38, 23, 'طبخ كابلي', 1.00, 200.00, 200.00),
(43, 24, 'خروف سواكني', 1.00, 1500.00, 1500.00),
(44, 24, 'بيبسي كبير', 1.00, 10.00, 10.00);

-- --------------------------------------------------------

--
-- Table structure for table `cache`
--

CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cache_locks`
--

CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `name`, `phone`, `notes`, `is_active`) VALUES
(1, 'بندر المطيري', '0505592216', NULL, 1),
(2, 'ياسر الحربي', '', NULL, 1),
(3, 'موسى الصعب', '0549126558', NULL, 1),
(4, 'الحربي', '0567189496', NULL, 1),
(5, 'عدنان المطيري', '0564173246', NULL, 1),
(6, 'نادر وضاح عبد الله', '0560889123', NULL, 1),
(7, 'امين صالح', '0560511524', NULL, 1),
(8, 'ايمن المصباحي', '056831722', NULL, 1),
(9, 'محمد حسين عزيز', '0504317422', NULL, 1),
(10, 'عبدالقادر عيد', '0548920503', NULL, 1),
(11, 'ابو صالح المطيري', '0535470200', NULL, 1),
(12, 'ابو وليد', '0555353877', NULL, 1),
(13, 'نبيل امين', '0564219419', NULL, 1),
(14, 'بدر المالكي', '0567771077', NULL, 1),
(15, 'منصور المالكي', '0501719172', NULL, 1),
(16, 'با نافع', '', NULL, 1),
(17, 'محسن احمد', '0531194456', NULL, 1),
(18, 'عبدالطيف العتيبي', '+966531415511', NULL, 1),
(19, 'ابو انس', '+966503614243', NULL, 1),
(20, 'عبدالله علي القرني', '+966554590585', NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `customer_payments`
--

CREATE TABLE `customer_payments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `booking_id` bigint(20) UNSIGNED DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_method_id` bigint(20) UNSIGNED NOT NULL,
  `payment_date` datetime NOT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer_payments`
--

INSERT INTO `customer_payments` (`id`, `customer_id`, `booking_id`, `amount`, `payment_method_id`, `payment_date`, `notes`) VALUES
(4, 1, 1, 250.00, 1, '2026-08-12 22:00:00', 'دفع كامل - حجز مكتمل'),
(5, 2, 2, 360.00, 1, '2026-08-12 20:00:00', 'دفع كامل - حجز مكتمل'),
(6, 3, 3, 750.00, 1, '2026-08-12 20:00:00', 'دفع كامل - حجز مكتمل'),
(7, 4, 4, 250.00, 1, '2026-08-13 13:00:00', 'دفع كامل - حجز مكتمل'),
(8, 5, 5, 317.50, 1, '2026-08-12 22:30:00', 'دفع كامل - حجز مكتمل'),
(10, 7, 7, 400.00, 1, '2026-08-14 14:00:00', 'دفع كامل - حجز مكتمل'),
(11, 2, 8, 370.00, 1, '2026-08-14 22:30:00', 'دفع كامل - حجز مكتمل'),
(13, 8, 10, 1500.00, 2, '2026-08-15 12:00:00', 'دفع كامل - حجز مكتمل (تحويل بنكي)'),
(14, 9, 11, 250.00, 1, '2026-08-16 21:00:00', 'دفع كامل - حجز مكتمل'),
(15, 10, 12, 250.00, 1, '2026-08-17 19:30:00', 'دفع كامل - حجز مكتمل'),
(16, 11, 13, 3000.00, 1, '2026-08-25 21:00:00', 'دفع كامل - حجز مكتمل'),
(17, 12, 14, 250.00, 1, '2026-08-20 21:00:00', 'دفع كامل - حجز مكتمل'),
(18, 13, 15, 280.00, 1, '2026-08-21 23:00:00', 'دفع كامل - حجز مكتمل'),
(19, 14, 16, 300.00, 1, '2026-08-21 12:00:00', 'دفع كامل - حجز مكتمل'),
(20, 15, 17, 1400.00, 1, '2026-08-21 21:40:00', 'دفع كامل - حجز مكتمل'),
(21, 16, 18, 1300.00, 1, '2026-08-25 20:00:00', 'دفع كامل - حجز مكتمل'),
(22, 6, 24, 510.00, 1, '2026-09-13 13:22:24', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `failed_jobs`
--

CREATE TABLE `failed_jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `connection` varchar(255) NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `items`
--

CREATE TABLE `items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `default_price` decimal(12,2) NOT NULL,
  `note` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `items`
--

INSERT INTO `items` (`id`, `name`, `default_price`, `note`) VALUES
(1, 'طبخ مندي', 250.00, 'طبق رئيسي - مندي'),
(2, 'طبخ مديني', 250.00, 'طبق رئيسي - مديني'),
(3, 'طبخ حنيذ', 250.00, 'طبق رئيسي - حنيذ'),
(4, 'طبخ سليق', 250.00, 'طبق رئيسي - سليق'),
(5, 'طبخ كابلي', 250.00, 'طبق رئيسي - كابلي'),
(6, 'طبخ مقلقل', 250.00, 'طبق رئيسي - مقلقل'),
(7, 'طبخ ندي', 250.00, 'طبق رئيسي - ندي'),
(8, 'خروف حري', 1500.00, 'طبق رئيسي فاخر (خروف كامل)'),
(9, 'رسوم توصيل', 20.00, 'خدمة - رسوم التوصيل للمنزل'),
(10, 'سلطه لبن', 5.00, 'مقبلات - سلطة لبن'),
(11, 'سلطه حمراء', 5.00, 'مقبلات - سلطة حمراء'),
(12, 'سلطه حار اخضر', 50.00, 'مقبلات - سلطة حار أخضر'),
(13, 'سلطه طحينه', 3.00, 'مقبلات - سلطة طحينة'),
(14, 'سلطه خضار', 5.00, 'مقبلات - سلطة خضار مشكلة'),
(15, 'طبق فواكه كبير', 15.00, 'حلوى - فواكه مشكلة كبيرة'),
(16, 'طبق فواكه صغير', 10.00, 'حلوى - فواكه مشكلة صغيرة'),
(17, 'حبحب', 5.00, 'حلوى - بطيخ أحمر'),
(18, 'شمام', 5.00, 'حلوى - شمام'),
(19, 'ماكس حبحب و شمام', 5.00, 'حلوى - خليط حبحب و شمام'),
(20, 'بيبسي 2 ريال', 2.00, 'مشروب غازي - صغير'),
(21, 'سفن 2 ريال', 2.00, 'مشروب غازي - صغير'),
(22, 'حمضيات 2 ريال', 2.00, 'مشروب غازي - صغير'),
(23, 'ماء صغير', 0.50, 'مشروب - مياه صغيرة'),
(24, 'ماء كبير', 1.00, 'مشروب - مياه كبيرة'),
(25, 'بيبسي وسط', 5.00, 'مشروب غازي - وسط'),
(26, 'حمضيات وسط', 5.00, 'مشروب غازي - وسط'),
(27, 'سفن وسط', 5.00, 'مشروب غازي - وسط'),
(28, 'بيبسي كبير', 10.00, 'مشروب غازي - كبير'),
(29, 'حمضيات كبير', 10.00, 'مشروب غازي - كبير'),
(30, 'سفن كبير', 10.00, 'مشروب غازي - كبير'),
(31, 'لبن المراعي صغير', 2.00, 'مشروب ألبان - صغير'),
(32, 'زبادي', 2.00, 'مشروب ألبان - زبادي'),
(33, 'سحاوق جبن', 4.00, 'مقبلات - سحاوق جبن'),
(34, 'سلطه فحسه جبن', 7.00, 'مقبلات - سلطة فحسة جبن'),
(38, 'بيبسي', 2.50, 'مشروب غازي - صغير'),
(39, 'سفن', 2.50, 'مشروب غازي - صغير'),
(40, 'خروف سواكني', 1500.00, 'طبق رئيسي فاخر'),
(41, 'طبخ حاشي', 1200.00, 'طبق رئيسي'),
(42, 'سلطات مشكله', 5.00, 'مقبلات'),
(43, 'سمبوسه', 40.00, 'مقبلات'),
(44, 'طرمبة', 40.00, 'مقبلات'),
(45, 'رسوم التوصيل', 1.00, 'خدمة توصيل'),
(46, 'نصف خروف', 700.00, 'طبق رئيسي');

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` smallint(5) UNSIGNED NOT NULL,
  `reserved_at` int(10) UNSIGNED DEFAULT NULL,
  `available_at` int(10) UNSIGNED NOT NULL,
  `created_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_batches`
--

CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '0001_01_01_000001_create_cache_table', 1),
(2, '0001_01_01_000002_create_jobs_table', 1),
(3, '2026_08_31_145435_create_personal_access_tokens_table', 1),
(4, 'create_booking_items_table', 2),
(5, 'create_bookings_table', 2),
(6, 'create_customer_payments_table', 2),
(7, 'create_customers_table', 2),
(8, 'create_items_table', 2),
(9, 'create_payment_methods_table', 2),
(10, 'create_restaurant_table', 2),
(11, 'create_supplier_invoices_table', 2),
(12, 'create_supplier_payments_table', 2),
(13, 'create_suppliers_table', 2),
(14, 'create_users_table', 2);

-- --------------------------------------------------------

--
-- Table structure for table `payment_methods`
--

CREATE TABLE `payment_methods` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(50) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `payment_methods`
--

INSERT INTO `payment_methods` (`id`, `name`, `is_active`) VALUES
(1, 'نقدي', 1),
(2, 'تحويل بنكي', 1),
(3, 'شبكة', 1);

-- --------------------------------------------------------

--
-- Table structure for table `personal_access_tokens`
--

CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) UNSIGNED NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `personal_access_tokens`
--

INSERT INTO `personal_access_tokens` (`id`, `tokenable_type`, `tokenable_id`, `name`, `token`, `abilities`, `last_used_at`, `expires_at`, `created_at`, `updated_at`) VALUES
(14, 'App\\Models\\User', 1, 'banquet-kitchen-web', '722c0e60431be9dec7a48f0dfff128602ff8f3ace1cd7583162a2b55a750f21a', '[\"*\"]', '2026-10-28 15:19:37', NULL, '2026-10-28 15:12:38', '2026-10-28 15:19:37');

-- --------------------------------------------------------

--
-- Table structure for table `restaurant`
--

CREATE TABLE `restaurant` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `whatsapp` varchar(30) DEFAULT NULL,
  `facebook` varchar(255) DEFAULT NULL,
  `instagram` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `logo` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `restaurant`
--

INSERT INTO `restaurant` (`id`, `name`, `description`, `phone`, `whatsapp`, `facebook`, `instagram`, `address`, `logo`) VALUES
(1, 'مطعم شواطئ عدن', 'مطعم جمي الامماكولات و طباخة الولائم', '0560889123', '0500744982', '@resturentAdan', '@resturentAdan', 'جدة ححي - شار الملك -', 'restaurant/WO3VW7e3K01qDUxsryZoH3sHwUYE89ei8LdbWtSe.png');

-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

CREATE TABLE `suppliers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `suppliers`
--

INSERT INTO `suppliers` (`id`, `name`, `phone`, `notes`, `is_active`) VALUES
(1, 'مؤسسة اللحوم', '0551111111', 'مورد الذبائح', 1),
(2, 'مؤسسة المواد الغذائية', '0552222222', NULL, 1),
(7, 'نادر وضاح', '055700982', NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `supplier_invoices`
--

CREATE TABLE `supplier_invoices` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `supplier_id` bigint(20) UNSIGNED NOT NULL,
  `invoice_number` varchar(100) DEFAULT NULL,
  `invoice_date` date NOT NULL,
  `details` text NOT NULL,
  `total_amount` decimal(12,2) NOT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `supplier_invoices`
--

INSERT INTO `supplier_invoices` (`id`, `supplier_id`, `invoice_number`, `invoice_date`, `details`, `total_amount`, `notes`) VALUES
(1, 1, 'SUP-2026-001', '2026-08-30', 'ذبيحتان كبيرتان = 3200 ريال\r\nأكياس أرز = 850 ريال\r\nبهارات = 240 ريال\r\nنقل = 150 ريال', 4440.00, 'فاتورة مشتريات'),
(2, 1, 'SUP-2026-002', '2026-08-31', 'أربع ذبائح = 6000 ريال\r\nمستلزمات أخرى = 500 ريال', 6500.00, 'فاتورة مشتريات'),
(3, 2, 'SUP-2026-003', '2026-09-01', 'أرز ومواد غذائية متنوعة', 2800.00, NULL),
(7, 1, '1200', '2026-09-05', 'ذبيحه', 1500.00, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `supplier_payments`
--

CREATE TABLE `supplier_payments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `supplier_id` bigint(20) UNSIGNED NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_method_id` bigint(20) UNSIGNED NOT NULL,
  `payment_date` datetime NOT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `supplier_payments`
--

INSERT INTO `supplier_payments` (`id`, `supplier_id`, `amount`, `payment_method_id`, `payment_date`, `notes`) VALUES
(1, 1, 2000.00, 2, '2026-08-30 19:30:00', 'دفعة أولى للمورد'),
(2, 1, 1500.00, 1, '2026-09-01 10:00:00', 'دفعة ثانية للمورد'),
(3, 1, 2000.00, 2, '2026-09-03 14:00:00', 'دفعة ثالثة للمورد'),
(4, 2, 1000.00, 1, '2026-09-02 11:00:00', 'دفعة للمورد'),
(9, 1, 800.00, 1, '2026-09-05 19:11:00', 'قيمه الذبيحه الكبير');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'مدير التطبيق', 'admin@restaurant.local', '$2y$12$10x2aJdkUgtRg8giZ2FjmOf98HPbarPjpyg6tvd4jTfWiencbnq2W', 1, '2026-08-31 15:09:05', '2026-09-02 11:05:14');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookings_customer_id_index` (`customer_id`),
  ADD KEY `bookings_event_date_index` (`event_date`),
  ADD KEY `bookings_status_index` (`status`),
  ADD KEY `bookings_event_delivery_index` (`event_date`,`delivery_time`);

--
-- Indexes for table `booking_items`
--
ALTER TABLE `booking_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `booking_items_booking_id_index` (`booking_id`);

--
-- Indexes for table `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_expiration_index` (`expiration`);

--
-- Indexes for table `cache_locks`
--
ALTER TABLE `cache_locks`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_locks_expiration_index` (`expiration`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customers_phone_index` (`phone`),
  ADD KEY `customers_name_index` (`name`);

--
-- Indexes for table `customer_payments`
--
ALTER TABLE `customer_payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_payments_customer_id_index` (`customer_id`),
  ADD KEY `customer_payments_booking_id_index` (`booking_id`),
  ADD KEY `customer_payments_payment_date_index` (`payment_date`),
  ADD KEY `customer_payments_payment_method_id_foreign` (`payment_method_id`);

--
-- Indexes for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`),
  ADD KEY `failed_jobs_connection_queue_failed_at_index` (`connection`,`queue`,`failed_at`);

--
-- Indexes for table `items`
--
ALTER TABLE `items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `items_name_index` (`name`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

--
-- Indexes for table `job_batches`
--
ALTER TABLE `job_batches`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `payment_methods`
--
ALTER TABLE `payment_methods`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  ADD KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  ADD KEY `personal_access_tokens_expires_at_index` (`expires_at`);

--
-- Indexes for table `restaurant`
--
ALTER TABLE `restaurant`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `suppliers`
--
ALTER TABLE `suppliers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `suppliers_phone_index` (`phone`),
  ADD KEY `suppliers_name_index` (`name`);

--
-- Indexes for table `supplier_invoices`
--
ALTER TABLE `supplier_invoices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `supplier_invoices_supplier_id_index` (`supplier_id`),
  ADD KEY `supplier_invoices_invoice_date_index` (`invoice_date`);

--
-- Indexes for table `supplier_payments`
--
ALTER TABLE `supplier_payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `supplier_payments_supplier_id_index` (`supplier_id`),
  ADD KEY `supplier_payments_payment_date_index` (`payment_date`),
  ADD KEY `supplier_payments_payment_method_id_foreign` (`payment_method_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_email_unique` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `booking_items`
--
ALTER TABLE `booking_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=45;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `customer_payments`
--
ALTER TABLE `customer_payments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `items`
--
ALTER TABLE `items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=47;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `payment_methods`
--
ALTER TABLE `payment_methods`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `restaurant`
--
ALTER TABLE `restaurant`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `suppliers`
--
ALTER TABLE `suppliers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `supplier_invoices`
--
ALTER TABLE `supplier_invoices`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `supplier_payments`
--
ALTER TABLE `supplier_payments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `bookings`
--
ALTER TABLE `bookings`
  ADD CONSTRAINT `bookings_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `booking_items`
--
ALTER TABLE `booking_items`
  ADD CONSTRAINT `booking_items_booking_id_foreign` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `customer_payments`
--
ALTER TABLE `customer_payments`
  ADD CONSTRAINT `customer_payments_booking_id_foreign` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_payments_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_payments_payment_method_id_foreign` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `supplier_invoices`
--
ALTER TABLE `supplier_invoices`
  ADD CONSTRAINT `supplier_invoices_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `supplier_payments`
--
ALTER TABLE `supplier_payments`
  ADD CONSTRAINT `supplier_payments_payment_method_id_foreign` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `supplier_payments_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
