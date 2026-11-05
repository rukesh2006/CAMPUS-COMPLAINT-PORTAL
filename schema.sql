CREATE DATABASE IF NOT EXISTS campus_complaints CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campus_complaints;

CREATE TABLE IF NOT EXISTS students (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reg_no VARCHAR(24) NOT NULL,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_reg_no (reg_no)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS management_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_management_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaints (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  category ENUM('Hostel','Facilities','Academics','IT & Wi-Fi','Transport','Safety','Other') NOT NULL,
  priority ENUM('Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
  description TEXT NOT NULL,
  status ENUM('Open','In progress','Resolved') NOT NULL DEFAULT 'Open',
  reply TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_complaints_student (student_id, created_at),
  KEY ix_complaints_status (status, created_at),
  CONSTRAINT fk_complaints_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;
