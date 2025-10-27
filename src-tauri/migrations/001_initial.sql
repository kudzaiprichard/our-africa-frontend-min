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
-- COURSE MEDIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_media (
                                          id TEXT PRIMARY KEY,
                                          file_id TEXT NOT NULL,
                                          filename TEXT NOT NULL,
                                          media_type TEXT NOT NULL CHECK(media_type IN ('video', 'audio', 'image', 'document')),
  public_url TEXT NOT NULL,
  size_bytes INTEGER,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

-- ============================================================================
-- COURSES
-- ============================================================================

CREATE TABLE IF NOT EXISTS courses (
                                     id TEXT PRIMARY KEY,
                                     title TEXT NOT NULL,
                                     description TEXT,
                                     image_id TEXT,
                                     created_by TEXT,
                                     is_published BOOLEAN DEFAULT 0,
                                     module_count INTEGER DEFAULT 0,
                                     enrollment_count INTEGER DEFAULT 0,
                                     category TEXT,
                                     level TEXT CHECK(level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
  duration INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (image_id) REFERENCES course_media(id) ON DELETE SET NULL
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
  auto_completed BOOLEAN DEFAULT 0,
  content_completion_percentage REAL DEFAULT 0,
  completed_content_count INTEGER DEFAULT 0,
  total_content_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  UNIQUE(enrollment_id, module_id)
  );

CREATE TABLE IF NOT EXISTS content_progress (
                                              id TEXT PRIMARY KEY,
                                              enrollment_id TEXT NOT NULL,
                                              content_id TEXT NOT NULL,
                                              is_completed BOOLEAN DEFAULT 0,
                                              viewed_at TEXT,
                                              completed_at TEXT,
                                              created_at TEXT NOT NULL,
                                              updated_at TEXT NOT NULL,
                                              last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                              FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (content_id) REFERENCES content_blocks(id) ON DELETE CASCADE,
  UNIQUE(enrollment_id, content_id)
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
-- OFFLINE SESSIONS (NEW)
-- ============================================================================

CREATE TABLE IF NOT EXISTS offline_sessions (
                                              id TEXT PRIMARY KEY,
                                              student_id TEXT NOT NULL,
                                              course_id TEXT NOT NULL,
                                              downloaded_at TEXT NOT NULL,
                                              expires_at TEXT NOT NULL,
                                              package_version TEXT NOT NULL DEFAULT 'v1',
                                              presigned_url_expiry_days INTEGER NOT NULL DEFAULT 7,
                                              last_synced_at TEXT,
                                              sync_count INTEGER DEFAULT 0,
                                              is_deleted BOOLEAN DEFAULT 0,
                                              created_at TEXT NOT NULL,
                                              updated_at TEXT NOT NULL,
                                              FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  );

-- ============================================================================
-- MEDIA CACHE (NEW)
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_cache (
                                         id INTEGER PRIMARY KEY AUTOINCREMENT,
                                         media_id TEXT NOT NULL UNIQUE,
                                         course_id TEXT NOT NULL,
                                         filename TEXT NOT NULL,
                                         media_type TEXT NOT NULL CHECK(media_type IN ('video', 'audio', 'image', 'document')),
  local_file_path TEXT NOT NULL,
  size_bytes INTEGER,
  downloaded_at TEXT NOT NULL,
  presigned_url TEXT,
  presigned_url_expires_at TEXT,
  is_downloaded BOOLEAN DEFAULT 0,
  download_progress INTEGER DEFAULT 0,
  FOREIGN KEY (media_id) REFERENCES course_media(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  );

-- ============================================================================
-- OFFLINE PROGRESS BATCH (NEW)
-- ============================================================================

CREATE TABLE IF NOT EXISTS offline_progress_batch (
                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                    session_id TEXT NOT NULL,
                                                    course_id TEXT NOT NULL,
                                                    batch_data TEXT NOT NULL,
                                                    created_at TEXT NOT NULL,
                                                    synced BOOLEAN DEFAULT 0,
                                                    synced_at TEXT,
                                                    FOREIGN KEY (session_id) REFERENCES offline_sessions(id) ON DELETE CASCADE
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
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_module_id ON content_blocks(module_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_module_progress_enrollment_id ON module_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_content_progress_enrollment_id ON content_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_id ON quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt_id ON quiz_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_table_record ON sync_queue(table_name, record_id);

-- NEW INDEXES FOR OFFLINE TABLES
CREATE INDEX IF NOT EXISTS idx_offline_sessions_student ON offline_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_offline_sessions_course ON offline_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_offline_sessions_deleted ON offline_sessions(is_deleted);
CREATE INDEX IF NOT EXISTS idx_media_cache_course ON media_cache(course_id);
CREATE INDEX IF NOT EXISTS idx_media_cache_downloaded ON media_cache(is_downloaded);
CREATE INDEX IF NOT EXISTS idx_media_cache_media_id ON media_cache(media_id);
CREATE INDEX IF NOT EXISTS idx_offline_progress_batch_session ON offline_progress_batch(session_id);
CREATE INDEX IF NOT EXISTS idx_offline_progress_batch_synced ON offline_progress_batch(synced);

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('schema_version', '3');
INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('last_full_sync', '');
INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('is_offline_mode', 'false');
