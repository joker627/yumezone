-- YumeZone PostgreSQL 15+ Schema (Conversion 1:1 desde yumezone.sql)
-- Compatible con Supabase, Neon, Render PostgreSQL y PostgreSQL local

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_code VARCHAR(16) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255),
    banner_url VARCHAR(500),
    avatar_frame_url VARCHAR(500),
    active_title VARCHAR(100),
    country VARCHAR(10) DEFAULT 'CO',
    bio TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    platform_role VARCHAR(20) DEFAULT 'USER',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    coins INTEGER NOT NULL DEFAULT 0,
    clan_tokens INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    last_streak_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

INSERT INTO roles (id, code, name) VALUES
(1, 'USER', 'Lector Estándar'),
(2, 'SCAN_MEMBER', 'Miembro de Scanlator'),
(3, 'SCAN_VERIFIED', 'Líder de Scan Verificado'),
(4, 'MODERATOR', 'Moderador de Comunidad'),
(5, 'ADMIN', 'Administrador de Plataforma'),
(6, 'SUPERADMIN', 'Super Administrador / Webmaster')
ON CONFLICT (id) DO NOTHING;

INSERT INTO permissions (id, code, description) VALUES
(1, 'comment:create', 'Crear comentarios y usar el chat'),
(2, 'comment:moderate', 'Ocultar o borrar comentarios y mensajes del chat de otros'),
(3, 'report:resolve', 'Ver y resolver reportes de usuarios'),
(4, 'scan:create', 'Crear un nuevo grupo de scan (Usuario verificado)'),
(5, 'scan:panel_access', 'Acceder al panel de gestión de scans'),
(6, 'work:create_global', 'Crear obras nuevas en el catálogo general'),
(7, 'work:edit_any', 'Editar o eliminar cualquier obra o capítulo de la plataforma'),
(8, 'scan:verify', 'Aprobar o bloquear grupos de scan'),
(9, 'user:ban', 'Suspender o bloquear cuentas de usuarios'),
(10, 'shop:manage', 'Crear y editar ítems de la tienda y medallas'),
(11, 'platform:config', 'Modificar platform_settings, cola del Hero y asignar Admins')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) VALUES
(1, 1),
(2, 1), (2, 5),
(3, 1), (3, 4), (3, 5), (3, 6),
(4, 1), (4, 2), (4, 3),
(5, 1), (5, 2), (5, 3), (5, 4), (5, 5), (5, 6), (5, 7), (5, 8), (5, 9), (5, 10),
(6, 1), (6, 2), (6, 3), (6, 4), (6, 5), (6, 6), (6, 7), (6, 8), (6, 9), (6, 10), (6, 11)
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS cultivation_ranks (
    id SERIAL PRIMARY KEY,
    min_level INTEGER NOT NULL UNIQUE,
    max_level INTEGER NOT NULL,
    title VARCHAR(100) NOT NULL,
    badge_icon VARCHAR(50) DEFAULT 'shield',
    reward_coins INTEGER DEFAULT 0
);

INSERT INTO cultivation_ranks (id, min_level, max_level, title, badge_icon, reward_coins) VALUES
(1, 1, 5, 'Iniciado del Cultivo', 'shield', 0),
(2, 6, 10, 'Lector Novato', 'book', 20),
(3, 11, 15, 'Cazador Errante', 'compass', 40),
(4, 16, 20, 'Adepto de las Sombras', 'moon', 60),
(5, 21, 25, 'Guerrero Celestial', 'sword', 80),
(6, 26, 30, 'Maestro de Secta', 'award', 120),
(7, 31, 35, 'Monarca Espiritual', 'feather', 160),
(8, 36, 40, 'Nigromante Supremo', 'skull', 200),
(9, 41, 45, 'Monarca de las Sombras', 'zap', 300),
(10, 46, 9999, 'Soberano Cósmico', 'crown', 400)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS scan_groups (
    id SERIAL PRIMARY KEY,
    owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url VARCHAR(255),
    banner_url VARCHAR(255),
    description TEXT,
    social_links JSONB,
    report_methods JSONB,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    vault_tokens INTEGER NOT NULL DEFAULT 0,
    total_contributed_tokens INTEGER NOT NULL DEFAULT 0,
    clan_level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scan_roles (
    id SERIAL PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL
);

INSERT INTO scan_roles (id, code, name) VALUES
(1, 'LEADER', 'Líder de Scan'),
(2, 'CO_LEADER', 'Colíder'),
(3, 'UPLOADER', 'Subidor de Capítulos'),
(4, 'EDITOR', 'Editor / Typesetter'),
(5, 'TRANSLATOR', 'Traductor')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS scan_group_members (
    group_id INTEGER NOT NULL REFERENCES scan_groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'UPLOADER' REFERENCES scan_roles(code) ON UPDATE CASCADE,
    permissions JSONB,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_scan_members_user_group ON scan_group_members (user_id, group_id);

CREATE TABLE IF NOT EXISTS statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS formats (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS demographics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS genres (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS works (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    alternative_title VARCHAR(255),
    synopsis TEXT,
    author VARCHAR(255),
    cover_url VARCHAR(255),
    banner_url VARCHAR(255),
    status_id INTEGER REFERENCES statuses(id) ON DELETE SET NULL,
    format_id INTEGER REFERENCES formats(id) ON DELETE SET NULL,
    demographic_id INTEGER REFERENCES demographics(id) ON DELETE SET NULL,
    scan_group_id INTEGER REFERENCES scan_groups(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_works_title ON works (title);
CREATE INDEX IF NOT EXISTS idx_works_created ON works (created_at);

CREATE TABLE IF NOT EXISTS work_genres (
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (work_id, genre_id)
);

CREATE TABLE IF NOT EXISTS work_tags (
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (work_id, tag_id)
);

CREATE TABLE IF NOT EXISTS chapters (
    id SERIAL PRIMARY KEY,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    scan_group_id INTEGER REFERENCES scan_groups(id) ON DELETE SET NULL,
    chapter_number NUMERIC(6,2) NOT NULL,
    title VARCHAR(255),
    slug VARCHAR(255) UNIQUE,
    status VARCHAR(20) DEFAULT 'PUBLISHED',
    translator_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reward_coins INTEGER NOT NULL DEFAULT 20,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_work_chapter_num UNIQUE (work_id, chapter_number)
);
CREATE INDEX IF NOT EXISTS idx_chapters_work_published ON chapters (work_id, published_at);
CREATE INDEX IF NOT EXISTS idx_chapters_work_status_num ON chapters (work_id, status, chapter_number);
CREATE INDEX IF NOT EXISTS idx_chapters_status_published ON chapters (status, published_at);

CREATE TABLE IF NOT EXISTS chapter_images (
    id SERIAL PRIMARY KEY,
    chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    image_url VARCHAR(2048) NOT NULL,
    order_number INTEGER NOT NULL,
    CONSTRAINT uq_chapter_order UNIQUE (chapter_id, order_number)
);

CREATE TABLE IF NOT EXISTS chapter_submissions (
    id SERIAL PRIMARY KEY,
    chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_url VARCHAR(2048) NOT NULL,
    page_count INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    notes TEXT,
    rejection_reason VARCHAR(255),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_submissions_chapter_status ON chapter_submissions (chapter_id, status);

CREATE TABLE IF NOT EXISTS user_coin_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    type VARCHAR(40) NOT NULL,
    description VARCHAR(255) NOT NULL,
    reference_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_tx_created ON user_coin_transactions (user_id, created_at);

CREATE TABLE IF NOT EXISTS scan_treasury_transactions (
    id BIGSERIAL PRIMARY KEY,
    scan_group_id INTEGER NOT NULL REFERENCES scan_groups(id) ON DELETE CASCADE,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    type VARCHAR(40) NOT NULL,
    description VARCHAR(255) NOT NULL,
    reference_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scan_tx_group_created ON scan_treasury_transactions (scan_group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS scan_funding_goals (
    id SERIAL PRIMARY KEY,
    scan_group_id INTEGER NOT NULL REFERENCES scan_groups(id) ON DELETE CASCADE,
    work_id INTEGER REFERENCES works(id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    description VARCHAR(255),
    target_tokens INTEGER NOT NULL DEFAULT 25,
    current_tokens INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scan_goals_group_status ON scan_funding_goals (scan_group_id, status);

CREATE TABLE IF NOT EXISTS user_library (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'READING',
    rating NUMERIC(3,1) CHECK (rating >= 0.0 AND rating <= 10.0),
    notify_new_chapters BOOLEAN DEFAULT TRUE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, work_id)
);
CREATE INDEX IF NOT EXISTS idx_library_user_status_added ON user_library (user_id, status, added_at);
CREATE INDEX IF NOT EXISTS idx_user_library_work_status ON user_library (work_id, status, rating);

CREATE TABLE IF NOT EXISTS reading_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    last_page_read INTEGER DEFAULT 1,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reading_history_user_work UNIQUE (user_id, work_id)
);
CREATE INDEX IF NOT EXISTS idx_reading_history_user_date ON reading_history (user_id, read_at DESC);

CREATE TABLE IF NOT EXISTS user_read_chapters (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, chapter_id)
);
CREATE INDEX IF NOT EXISTS idx_user_work ON user_read_chapters (user_id, work_id);

CREATE TABLE IF NOT EXISTS daily_missions (
    id SERIAL PRIMARY KEY,
    mission_key VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'LECTURA',
    mission_type VARCHAR(20) NOT NULL DEFAULT 'DAILY',
    event_name VARCHAR(100),
    icon VARCHAR(50) NOT NULL DEFAULT 'book-open',
    target_count INTEGER NOT NULL DEFAULT 1,
    condition_type VARCHAR(40) NOT NULL,
    reward_xp INTEGER NOT NULL DEFAULT 15,
    reward_coins INTEGER NOT NULL DEFAULT 3,
    reward_clan_tokens INTEGER NOT NULL DEFAULT 0,
    action_url VARCHAR(255) DEFAULT '/pages/catalogo.html',
    action_text VARCHAR(50) DEFAULT 'Explorar obras',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMP,
    ends_at TIMESTAMP
);

INSERT INTO daily_missions (id, mission_key, title, description, category, mission_type, icon, target_count, condition_type, reward_xp, reward_coins, reward_clan_tokens, action_url, action_text, sort_order) VALUES
(1, 'daily_read_1', 'Primer Capítulo', 'Lee al menos 1 capítulo completo hoy.', 'LECTURA', 'DAILY', 'book-open', 1, 'CHAPTERS_READ', 15, 3, 0, '/pages/catalogo.html', 'Explorar obras', 1),
(2, 'daily_read_3', 'Devorador de Capítulos', 'Lee 3 capítulos completos en el día.', 'LECTURA', 'DAILY', 'flame', 3, 'CHAPTERS_READ', 35, 5, 0, '/pages/catalogo.html', 'Leer más', 2),
(3, 'daily_comment', 'Voz de la Comunidad', 'Deja al menos 1 comentario u opinión.', 'COMUNIDAD', 'DAILY', 'message-circle', 1, 'COMMENTS', 25, 4, 0, '/pages/catalogo.html', 'Comentar', 3),
(4, 'daily_library', 'Coleccionista', 'Ten al menos 1 obra en tu biblioteca.', 'BIBLIOTECA', 'DAILY', 'bookmark', 1, 'LIBRARY_COUNT', 15, 3, 0, '/pages/catalogo.html', 'Guardar obra', 4),
(5, 'daily_chest', 'Cofre de Maestría Diaria', 'Reclama todas tus misiones del día para abrir este cofre.', 'MAESTRIA', 'DAILY', 'gift', 4, 'DAILY_CHEST', 60, 10, 0, '', 'Reclamar cofre', 5)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_daily_missions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mission_key VARCHAR(50) NOT NULL,
    claimed_date DATE NOT NULL,
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    coins_awarded INTEGER NOT NULL DEFAULT 0,
    clan_tokens_awarded INTEGER NOT NULL DEFAULT 0,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_mission_date UNIQUE (user_id, mission_key, claimed_date)
);

CREATE TABLE IF NOT EXISTS shop_items (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL DEFAULT 'BANNER',
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    price_coins INTEGER NOT NULL DEFAULT 100,
    preview_url VARCHAR(500) NOT NULL,
    required_level INTEGER NOT NULL DEFAULT 1,
    rarity VARCHAR(30) NOT NULL DEFAULT 'RARE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
    is_equipped BOOLEAN DEFAULT FALSE,
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_shop_item UNIQUE (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS work_statistics (
    work_id INTEGER PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
    total_views INTEGER DEFAULT 0,
    daily_views INTEGER DEFAULT 0,
    weekly_views INTEGER DEFAULT 0,
    monthly_views INTEGER DEFAULT 0,
    rating_average NUMERIC(4,2) DEFAULT 0.00,
    rating_count INTEGER DEFAULT 0,
    trending_score NUMERIC(10,2) DEFAULT 0.00,
    views_last_24h INTEGER DEFAULT 0,
    favorites_count INTEGER DEFAULT 0,
    last_published_at TIMESTAMP,
    latest_chapter_id INTEGER,
    latest_chapter_number NUMERIC(6,2),
    first_chapter_id INTEGER,
    chapters_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_stats_trending ON work_statistics (trending_score);
CREATE INDEX IF NOT EXISTS idx_stats_weekly ON work_statistics (weekly_views);
CREATE INDEX IF NOT EXISTS idx_stats_monthly ON work_statistics (monthly_views);
CREATE INDEX IF NOT EXISTS idx_stats_favorites ON work_statistics (favorites_count);
CREATE INDEX IF NOT EXISTS idx_ws_last_published ON work_statistics (last_published_at);

CREATE TABLE IF NOT EXISTS view_logs (
    id BIGSERIAL PRIMARY KEY,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(64),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_view_logs_work_date ON view_logs (work_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_view_logs_user_dedup ON view_logs (user_id, work_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_view_logs_ip_dedup ON view_logs (ip_address, work_id, viewed_at);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, read_at, created_at);

CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
    reply_to_username VARCHAR(50),
    content TEXT NOT NULL,
    contains_spoiler BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'VISIBLE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comments_target_created ON comments (work_id, chapter_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent_created ON comments (parent_id, created_at);

CREATE TABLE IF NOT EXISTS comment_reactions (
    comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS content_reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(30) NOT NULL,
    entity_id BIGINT NOT NULL,
    reason VARCHAR(100) NOT NULL,
    details TEXT,
    status VARCHAR(20) DEFAULT 'OPEN',
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reporter_entity_status UNIQUE (reporter_user_id, entity_type, entity_id, status)
);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON content_reports (status, created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    before_data JSONB,
    after_data JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_entity_date ON audit_logs (entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor_date ON audit_logs (actor_user_id, created_at);

CREATE TABLE IF NOT EXISTS platform_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description VARCHAR(255)
);

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES ('hero_new_rotation_hours', '{"hours": 24}'::jsonb, 'Duración en horas de cada obra nueva en el Hero')
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS hero_queue (
    id SERIAL PRIMARY KEY,
    work_id INTEGER NOT NULL UNIQUE REFERENCES works(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING',
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    expires_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hero_queue_status ON hero_queue (status, queued_at);
CREATE INDEX IF NOT EXISTS idx_hero_queue_expires ON hero_queue (expires_at);

CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    scan_group_id INTEGER REFERENCES scan_groups(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    type_label VARCHAR(50) NOT NULL,
    source VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_resolved BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_announcements_active_created ON announcements (is_active, created_at);

SELECT setval(pg_get_serial_sequence('roles', 'id'), COALESCE((SELECT MAX(id) FROM roles), 1));
SELECT setval(pg_get_serial_sequence('permissions', 'id'), COALESCE((SELECT MAX(id) FROM permissions), 1));
SELECT setval(pg_get_serial_sequence('cultivation_ranks', 'id'), COALESCE((SELECT MAX(id) FROM cultivation_ranks), 1));
SELECT setval(pg_get_serial_sequence('scan_roles', 'id'), COALESCE((SELECT MAX(id) FROM scan_roles), 1));
SELECT setval(pg_get_serial_sequence('daily_missions', 'id'), COALESCE((SELECT MAX(id) FROM daily_missions), 1));
SELECT setval(pg_get_serial_sequence('platform_settings', 'id'), COALESCE((SELECT MAX(id) FROM platform_settings), 1));
