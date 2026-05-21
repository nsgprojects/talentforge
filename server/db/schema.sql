-- ============================================================
-- TalentForge ATS Platform — PostgreSQL Schema v2.0
-- Roles: admin | recruiter (only 2)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── USERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(50),
  password_hash TEXT        NOT NULL DEFAULT '',
  role          VARCHAR(20) NOT NULL CHECK (role IN ('admin','recruiter')),
  status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  avatar_url    TEXT,
  created_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SESSIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token  TEXT NOT NULL UNIQUE,
  ip_address     INET,
  user_agent     TEXT,
  current_page   VARCHAR(255),
  logged_in_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logged_out_at  TIMESTAMPTZ,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(user_id, is_active, last_active_at DESC);

-- ── ACTIVITY LOGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES user_sessions(id),
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
                'login','logout','view','edit','create','delete',
                'ai_generate','export','import','copy_point',
                'resume_upload','resume_parse','jd_parse',
                'gap_analysis','bullet_generate','resume_export')),
  entity_type VARCHAR(50),
  entity_id   UUID,
  entity_name TEXT,
  details     JSONB,
  page        VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_at   ON activity_logs(created_at DESC);

-- ── TECH ECOSYSTEMS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS tech_ecosystems (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  color_hex   VARCHAR(7),
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tech_stacks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecosystem_id UUID NOT NULL REFERENCES tech_ecosystems(id),
  name         VARCHAR(100) NOT NULL,
  keywords     TEXT[],
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ecosystem_id, name)
);

-- ── BASE RESUMES (with versioning) ────────────────────────
CREATE TABLE IF NOT EXISTS base_resumes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_resume_id UUID        REFERENCES base_resumes(id) ON DELETE SET NULL,
  version_number   INT         NOT NULL DEFAULT 1,
  name             VARCHAR(255) NOT NULL,
  tech_stack       VARCHAR(100),
  ecosystem_id     UUID        REFERENCES tech_ecosystems(id),
  years_experience INT,
  summary_text     TEXT,
  content          JSONB       NOT NULL DEFAULT '{}',
  original_file_b64 TEXT,
  original_file_name VARCHAR(255),
  original_file_type VARCHAR(20),
  ats_score        INT         DEFAULT 0 CHECK (ats_score BETWEEN 0 AND 100),
  urgent_fixes     INT         DEFAULT 0,
  critical_fixes   INT         DEFAULT 0,
  optional_fixes   INT         DEFAULT 0,
  detected_format  VARCHAR(10) DEFAULT 'E',
  template_name    VARCHAR(20) NOT NULL DEFAULT 'classic',
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_base_res_user    ON base_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_base_res_parent  ON base_resumes(parent_resume_id);
CREATE INDEX IF NOT EXISTS idx_base_res_version ON base_resumes(user_id, parent_resume_id, version_number);

-- ── TAILORED RESUMES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS tailored_resumes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  base_resume_id   UUID        NOT NULL REFERENCES base_resumes(id),
  user_id          UUID        NOT NULL REFERENCES users(id),
  name             VARCHAR(255) NOT NULL,
  version_number   INT         NOT NULL DEFAULT 1,
  target_company   VARCHAR(255),
  target_title     VARCHAR(255),
  job_description  TEXT,
  jd_parsed        JSONB,
  jd_keywords      TEXT[]      DEFAULT '{}',
  gap_analysis     JSONB,
  selected_points  JSONB,
  content          JSONB       NOT NULL DEFAULT '{}',
  result_docx_b64  TEXT,
  ats_score_before INT         DEFAULT 0,
  ats_score_after  INT         DEFAULT 0,
  match_score      INT         DEFAULT 0,
  status           VARCHAR(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','final','exported')),
  exported_at      TIMESTAMPTZ,
  export_format    VARCHAR(10) CHECK (export_format IN ('pdf','docx','txt')),
  ai_model_used    VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tailored_user ON tailored_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_tailored_base ON tailored_resumes(base_resume_id);

-- ── BULLET POINTS LIBRARY ─────────────────────────────────
-- Admin sees all, recruiters see only their own (created_by = their user_id)
CREATE TABLE IF NOT EXISTS bullet_points (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content         TEXT NOT NULL,
  ecosystem_id    UUID REFERENCES tech_ecosystems(id),
  stack_label     VARCHAR(100),
  tags            TEXT[] DEFAULT '{}',
  jd_keywords     TEXT[] DEFAULT '{}',
  source          VARCHAR(20) NOT NULL DEFAULT 'ai' CHECK (source IN ('ai','manual','imported')),
  experience_role VARCHAR(255),
  usage_count     INT DEFAULT 0,
  quality_score   FLOAT DEFAULT 0.0,
  is_flagged      BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bullets_eco    ON bullet_points(ecosystem_id);
CREATE INDEX IF NOT EXISTS idx_bullets_user   ON bullet_points(created_by);
CREATE INDEX IF NOT EXISTS idx_bullets_fts    ON bullet_points USING gin(to_tsvector('english', content));

-- ── VIEWS ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_users_online AS
SELECT u.id, u.name, u.email, u.role, u.status,
  s.current_page, s.logged_in_at, s.last_active_at,
  CASE WHEN s.last_active_at > NOW() - INTERVAL '5 minutes' THEN TRUE ELSE FALSE END AS is_online
FROM users u
LEFT JOIN user_sessions s ON s.user_id = u.id AND s.is_active = TRUE
ORDER BY is_online DESC, s.last_active_at DESC NULLS LAST;

CREATE OR REPLACE VIEW v_resume_versions AS
SELECT
  br.id, br.user_id, br.name, br.version_number,
  br.parent_resume_id, br.tech_stack, br.ats_score,
  br.original_file_name, br.created_at, br.updated_at,
  u.name AS user_name,
  COUNT(tr.id) AS tailored_count,
  root.id AS root_resume_id,
  root.name AS root_name
FROM base_resumes br
JOIN users u ON u.id = br.user_id
LEFT JOIN tailored_resumes tr ON tr.base_resume_id = br.id
LEFT JOIN base_resumes root ON root.id = COALESCE(br.parent_resume_id, br.id)
WHERE br.is_active = TRUE
GROUP BY br.id, u.name, root.id, root.name;

-- ── TRIGGERS ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_users_upd       ON users;
DROP TRIGGER IF EXISTS trg_base_res_upd    ON base_resumes;
DROP TRIGGER IF EXISTS trg_tailored_upd    ON tailored_resumes;
DROP TRIGGER IF EXISTS trg_bullets_upd     ON bullet_points;

CREATE TRIGGER trg_users_upd      BEFORE UPDATE ON users           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_base_res_upd   BEFORE UPDATE ON base_resumes    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tailored_upd   BEFORE UPDATE ON tailored_resumes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bullets_upd    BEFORE UPDATE ON bullet_points    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── JOB DESCRIPTIONS POOL ─────────────────────────────────
CREATE TABLE IF NOT EXISTS job_descriptions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          VARCHAR(255),
  company        VARCHAR(255),
  location       VARCHAR(255),
  work_type      VARCHAR(50),
  experience_req VARCHAR(50),
  raw_text       TEXT        NOT NULL,
  parsed_json    JSONB       DEFAULT '{}',
  skills_required TEXT[]     DEFAULT '{}',
  skills_preferred TEXT[]    DEFAULT '{}',
  keywords       TEXT[]      DEFAULT '{}',
  match_score    INT         DEFAULT 0,
  status         VARCHAR(20) NOT NULL DEFAULT 'saved'
                   CHECK (status IN ('saved','applied','archived','liked')),
  is_primary     BOOLEAN     NOT NULL DEFAULT FALSE,
  source         VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual','paste','url')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jd_user ON job_descriptions(user_id, created_at DESC);
DROP TRIGGER IF EXISTS trg_jd_upd ON job_descriptions;
CREATE TRIGGER trg_jd_upd BEFORE UPDATE ON job_descriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── COVER LETTERS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cover_letters (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jd_id          UUID        REFERENCES job_descriptions(id),
  base_resume_id UUID        REFERENCES base_resumes(id),
  content        TEXT        NOT NULL,
  tone           VARCHAR(20) DEFAULT 'professional',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add text_hash for JD deduplication
ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS text_hash VARCHAR(32);
CREATE INDEX IF NOT EXISTS idx_jd_hash ON job_descriptions(user_id, text_hash);


-- ── v17 patch: add template_name to base_resumes ──────────
ALTER TABLE base_resumes ADD COLUMN IF NOT EXISTS template_name VARCHAR(20) NOT NULL DEFAULT 'classic';

-- ── v18 patch: user preferences column ────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- ── v18 patch: platform settings (key/value store) ────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT,
  updated_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── v18 patch: interview questions per role ────────────────
CREATE TABLE IF NOT EXISTS interview_questions (
  role_id        VARCHAR(50)  PRIMARY KEY,
  role_label     VARCHAR(100) NOT NULL,
  questions      JSONB        NOT NULL DEFAULT '[]',
  refreshed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  refresh_source VARCHAR(20)  NOT NULL DEFAULT 'static'
                   CHECK (refresh_source IN ('static','claude','admin'))
);
