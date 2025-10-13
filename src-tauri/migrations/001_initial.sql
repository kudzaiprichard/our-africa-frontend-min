-- ============================================================================
-- APP METADATA
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_metadata (
                                          key TEXT PRIMARY KEY,
                                          value TEXT NOT NULL,
                                          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- AUTHENTICATION & USER DATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_tokens (
                                         id INTEGER PRIMARY KEY AUTOINCREMENT,
                                         token TEXT NOT NULL,
                                         token_type TEXT NOT NULL,
                                         expires_at TEXT NOT NULL,
                                         created_at TEXT NOT NULL,
                                         is_refresh_token BOOLEAN DEFAULT 0,
                                         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
                                   id TEXT PRIMARY KEY,
                                   email TEXT NOT NULL UNIQUE,
                                   first_name TEXT NOT NULL,
                                   middle_name TEXT,
                                   last_name TEXT NOT NULL,
                                   full_name TEXT NOT NULL,
                                   bio TEXT,
                                   phone_number TEXT,
                                   role TEXT NOT NULL,
                                   is_active BOOLEAN DEFAULT 1,
                                   profile_image_url TEXT,
                                   profile_image_file_id TEXT,
                                   created_at TEXT NOT NULL,
                                   updated_at TEXT NOT NULL,
                                   last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- COURSES
-- ============================================================================

CREATE TABLE IF NOT EXISTS courses (
                                     id TEXT PRIMARY KEY,
                                     title TEXT NOT NULL,
                                     description TEXT,
                                     image_url TEXT,
                                     image_file_id TEXT,
                                     created_by TEXT,
                                     is_published BOOLEAN DEFAULT 0,
                                     module_count INTEGER DEFAULT 0,
                                     enrollment_count INTEGER DEFAULT 0,
                                     categories TEXT,
                                     categories_display TEXT,
                                     level TEXT CHECK(level IN ('beginner', 'intermediate', 'advanced')),
  duration INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE IF NOT EXISTS course_prerequisites (
                                                  id TEXT PRIMARY KEY,
                                                  course_id TEXT NOT NULL,
                                                  prerequisite_course_id TEXT NOT NULL,
                                                  created_at TEXT NOT NULL,
                                                  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (prerequisite_course_id) REFERENCES courses(id) ON DELETE CASCADE
  );

-- ============================================================================
-- MODULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS modules (
                                     id TEXT PRIMARY KEY,
                                     course_id TEXT NOT NULL,
                                     title TEXT NOT NULL,
                                     description TEXT,
                                     order_index INTEGER DEFAULT 0,
                                     content_count INTEGER DEFAULT 0,
                                     has_quiz BOOLEAN DEFAULT 0,
                                     created_at TEXT NOT NULL,
                                     updated_at TEXT NOT NULL,
                                     last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                     FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  );

-- ============================================================================
-- CONTENT BLOCKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_blocks (
                                            id TEXT PRIMARY KEY,
                                            module_id TEXT NOT NULL,
                                            title TEXT,
                                            content_data TEXT NOT NULL,
                                            order_index INTEGER DEFAULT 0,
                                            created_at TEXT NOT NULL,
                                            updated_at TEXT NOT NULL,
                                            last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                            FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
  );

-- ============================================================================
-- QUIZZES
-- ============================================================================

CREATE TABLE IF NOT EXISTS quizzes (
                                     id TEXT PRIMARY KEY,
                                     title TEXT NOT NULL,
                                     description TEXT,
                                     quiz_type TEXT CHECK(quiz_type IN ('module_quiz', 'final_exam')),
  module_id TEXT,
  course_id TEXT,
  time_limit_minutes INTEGER,
  pass_mark_percentage REAL NOT NULL,
  max_attempts INTEGER,
  attempt_reset_hours INTEGER DEFAULT 0,
  shuffle_questions BOOLEAN DEFAULT 0,
  question_count INTEGER DEFAULT 0,
  student_best_score REAL,
  student_attempts_count INTEGER DEFAULT 0,
  student_can_attempt BOOLEAN DEFAULT 1,
  student_passed BOOLEAN DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  );

CREATE TABLE IF NOT EXISTS questions (
                                       id TEXT PRIMARY KEY,
                                       quiz_id TEXT NOT NULL,
                                       question_text TEXT NOT NULL,
                                       image_url TEXT,
                                       image_file_id TEXT,
                                       order_index INTEGER DEFAULT 0,
                                       points REAL DEFAULT 1.0,
                                       created_at TEXT NOT NULL,
                                       updated_at TEXT NOT NULL,
                                       FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
  );

CREATE TABLE IF NOT EXISTS question_options (
                                              id TEXT PRIMARY KEY,
                                              question_id TEXT NOT NULL,
                                              option_text TEXT NOT NULL,
                                              is_correct BOOLEAN DEFAULT 0,
                                              order_index INTEGER DEFAULT 0,
                                              FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
  );

-- ============================================================================
-- ENROLLMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS enrollments (
                                         id TEXT PRIMARY KEY,
                                         student_id TEXT NOT NULL,
                                         course_id TEXT NOT NULL,
                                         status TEXT CHECK(status IN ('active', 'completed', 'dropped')),
  enrolled_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE(student_id, course_id)
  );

-- ============================================================================
-- PROGRESS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS module_progress (
                                             id TEXT PRIMARY KEY,
                                             enrollment_id TEXT NOT NULL,
                                             module_id TEXT NOT NULL,
                                             status TEXT CHECK(status IN ('not_started', 'in_progress', 'completed')),
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  UNIQUE(enrollment_id, module_id)
  );

CREATE TABLE IF NOT EXISTS quiz_attempts (
                                           id TEXT PRIMARY KEY,
                                           student_id TEXT NOT NULL,
                                           quiz_id TEXT NOT NULL,
                                           attempt_number INTEGER DEFAULT 1,
                                           status TEXT CHECK(status IN ('in_progress', 'completed', 'abandoned')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  score REAL,
  passed BOOLEAN,
  time_remaining_seconds INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
  );

CREATE TABLE IF NOT EXISTS quiz_answers (
                                          id TEXT PRIMARY KEY,
                                          attempt_id TEXT NOT NULL,
                                          question_id TEXT NOT NULL,
                                          selected_option_id TEXT NOT NULL,
                                          is_correct BOOLEAN DEFAULT 0,
                                          points_earned REAL DEFAULT 0,
                                          created_at TEXT NOT NULL,
                                          updated_at TEXT NOT NULL,
                                          FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (selected_option_id) REFERENCES question_options(id) ON DELETE CASCADE,
  UNIQUE(attempt_id, question_id)
  );

-- ============================================================================
-- SYNC QUEUE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_queue (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        operation_type TEXT NOT NULL CHECK(operation_type IN ('create', 'update', 'delete')),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP,
  error_message TEXT
  );

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('schema_version', '1');
INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('last_full_sync', '');
INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('is_offline_mode', 'false');
