-- Base de Datos: Yumezone
CREATE DATABASE IF NOT EXISTS yumezone;
USE yumezone;

-- ==========================================
-- 1. USUARIOS Y CONFIGURACIÓN DE LECTURA
-- ==========================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_code VARCHAR(16) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255),
    banner_url VARCHAR(500) NULL,
    anillo_url VARCHAR(500) NULL,
    active_title VARCHAR(100) NULL,
    country VARCHAR(10) NULL DEFAULT 'CO',
    bio TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    platform_role ENUM('USER', 'ADMIN', 'SUPERADMIN') DEFAULT 'USER',
    status ENUM('ACTIVE', 'SUSPENDED', 'BLOCKED', 'DELETED') DEFAULT 'ACTIVE',
    coins INT DEFAULT 0,
    xp INT DEFAULT 0,
    streak_days INT DEFAULT 0,
    last_streak_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================
-- 1.1 SISTEMA DE ROLES Y PERMISOS DINÁMICOS
-- ==========================================
CREATE TABLE roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
    role_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE user_roles (
    user_id INT NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    assigned_by INT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Roles base del sistema (Sin rol VIP)
INSERT IGNORE INTO roles (id, code, name) VALUES
(1, 'USER', 'Lector Estándar'),
(2, 'SCAN_MEMBER', 'Miembro de Scanlator'),
(3, 'SCAN_VERIFIED', 'Líder de Scan Verificado'),
(4, 'MODERATOR', 'Moderador de Comunidad'),
(5, 'ADMIN', 'Administrador de Plataforma'),
(6, 'SUPERADMIN', 'Super Administrador / Webmaster');

-- Permisos dinámicos del sistema
INSERT IGNORE INTO permissions (id, code, description) VALUES
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
(11, 'platform:config', 'Modificar platform_settings, cola del Hero y asignar Admins');

-- Asignación de permisos por rol
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(1, 1),                                                         -- USER
(2, 1), (2, 5),                                                 -- SCAN_MEMBER
(3, 1), (3, 4), (3, 5), (3, 6),                                 -- SCAN_VERIFIED
(4, 1), (4, 2), (4, 3),                                         -- MODERATOR
(5, 1), (5, 2), (5, 3), (5, 4), (5, 5), (5, 6), (5, 7), (5, 8), (5, 9), (5, 10), -- ADMIN
(6, 1), (6, 2), (6, 3), (6, 4), (6, 5), (6, 6), (6, 7), (6, 8), (6, 9), (6, 10), (6, 11); -- SUPERADMIN

-- ==========================================
-- 2. GRUPOS SCAN
-- ==========================================
CREATE TABLE scan_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_user_id INT NULL, -- El usuario verificado que creó/es dueño del grupo
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url VARCHAR(255),
    banner_url VARCHAR(255),
    description TEXT,
    social_links JSON,
    report_methods JSON,
    status ENUM('ACTIVE', 'INACTIVE', 'DELETED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE scan_group_members (
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('LEADER', 'CO_LEADER', 'UPLOADER', 'EDITOR', 'TRANSLATOR') DEFAULT 'UPLOADER',
    permissions JSON,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES scan_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================
-- 3. CLASIFICACIÓN DE CONTENIDO
-- ==========================================
CREATE TABLE statuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL -- Ej: En emisión, Finalizado, En pausa, Cancelado
);

CREATE TABLE formats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL -- Ej: Manga, Manhua, Manhwa, Webtoon
);

CREATE TABLE demographics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL -- Ej: Shonen, Seinen, Shojo, Josei
);

CREATE TABLE genres (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- ==========================================
-- 4. GESTIÓN DE OBRAS
-- ==========================================
CREATE TABLE works (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    alternative_title VARCHAR(255),
    synopsis TEXT,
    author VARCHAR(255),
    cover_url VARCHAR(255),
    banner_url VARCHAR(255),
    status_id INT,
    format_id INT,
    demographic_id INT,
    scan_group_id INT, -- Grupo principal que traduce la obra (badge principal)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE SET NULL,
    FOREIGN KEY (format_id) REFERENCES formats(id) ON DELETE SET NULL,
    FOREIGN KEY (demographic_id) REFERENCES demographics(id) ON DELETE SET NULL,
    FOREIGN KEY (scan_group_id) REFERENCES scan_groups(id) ON DELETE SET NULL,
    INDEX idx_works_title (title),
    INDEX idx_works_created (created_at),
    FULLTEXT INDEX idx_works_search (title, alternative_title, author, synopsis)
);

CREATE TABLE work_genres (
    work_id INT,
    genre_id INT,
    PRIMARY KEY (work_id, genre_id),
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
);

CREATE TABLE work_tags (
    work_id INT,
    tag_id INT,
    PRIMARY KEY (work_id, tag_id),
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- ==========================================
-- 5. GESTIÓN DE CAPÍTULOS
-- ==========================================
CREATE TABLE chapters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    work_id INT NOT NULL,
    scan_group_id INT, -- Puede diferir del grupo principal si es colaboración
    chapter_number DECIMAL(6,2) NOT NULL, -- DECIMAL para capítulos como 10.5
    title VARCHAR(255),
    slug VARCHAR(255) UNIQUE,
    status ENUM('DRAFT', 'PUBLISHED', 'SCHEDULED', 'HIDDEN') DEFAULT 'PUBLISHED',
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    FOREIGN KEY (scan_group_id) REFERENCES scan_groups(id) ON DELETE SET NULL,
    UNIQUE (work_id, chapter_number),
    INDEX idx_chapters_work_published (work_id, published_at)
);

CREATE TABLE chapter_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chapter_id INT NOT NULL,
    image_url VARCHAR(2048) NOT NULL,
    order_number INT NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    UNIQUE (chapter_id, order_number)
);

-- ==========================================
-- 6. BIBLIOTECA, HISTORIAL Y ESTADÍSTICAS
-- ==========================================
CREATE TABLE user_library (
    user_id INT,
    work_id INT,
    status ENUM('FAVORITE', 'FOLLOWING', 'READ_LATER', 'COMPLETED', 'DROPPED') DEFAULT 'FOLLOWING',
    rating DECIMAL(3,1) CHECK (rating >= 0.0 AND rating <= 10.0),
    notify_new_chapters BOOLEAN DEFAULT TRUE, -- Para el botón "Recordar" (campana)
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, work_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE reading_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    work_id INT NOT NULL,
    chapter_id INT NOT NULL,
    last_page_read INT DEFAULT 1,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    UNIQUE (user_id, work_id)
);

-- Capítulos leídos por el usuario
CREATE TABLE user_read_chapters (
    user_id INT NOT NULL,
    work_id INT NOT NULL,
    chapter_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, chapter_id),
    KEY idx_user_work (user_id, work_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

-- Misiones diarias y recompensas reclamadas
CREATE TABLE IF NOT EXISTS user_daily_missions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    mission_key VARCHAR(50) NOT NULL,
    claimed_date DATE NOT NULL,
    xp_awarded INT NOT NULL DEFAULT 0,
    coins_awarded INT NOT NULL DEFAULT 0,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_mission_date (user_id, mission_key, claimed_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Chat en vivo de la comunidad
CREATE TABLE IF NOT EXISTS chats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_chats_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reacciones a mensajes del chat
CREATE TABLE IF NOT EXISTS chat_reactions (
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    reaction VARCHAR(16) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id, reaction),
    FOREIGN KEY (message_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_chat_reactions_msg (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purga automática diaria: conserva solamente los mensajes de las últimas 24 horas.
-- Requiere que MySQL tenga event_scheduler = ON.
CREATE EVENT IF NOT EXISTS purge_expired_chats
ON SCHEDULE EVERY 1 HOUR
DO DELETE FROM chats
WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL 24 HOUR);

-- Medallas del sistema
CREATE TABLE IF NOT EXISTS badges (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'Bronce',
    icon VARCHAR(50) NOT NULL DEFAULT 'award',
    description TEXT,
    condition_type VARCHAR(50) NOT NULL,
    condition_value INT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catálogo de la tienda (banners, cosméticos, etc.)
CREATE TABLE IF NOT EXISTS shop_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(50) NOT NULL DEFAULT 'BANNER',
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    price_coins INT NOT NULL DEFAULT 100,
    preview_url VARCHAR(500) NOT NULL,
    required_level INT NOT NULL DEFAULT 1,
    rarity VARCHAR(30) NOT NULL DEFAULT 'RARE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inventario y cosméticos del usuario
CREATE TABLE IF NOT EXISTS user_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    is_equipped BOOLEAN DEFAULT FALSE,
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_shop_item (user_id, item_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Estadísticas para rankings (TOP, POPULAR, etc.)
CREATE TABLE work_statistics (
    work_id INT PRIMARY KEY,
    total_views INT DEFAULT 0,
    daily_views INT DEFAULT 0,
    weekly_views INT DEFAULT 0,
    monthly_views INT DEFAULT 0,
    rating_average DECIMAL(4,2) DEFAULT 0.00,
    rating_count INT DEFAULT 0, -- Para mostrar "9.94 (42.8k)"
    trending_score DECIMAL(10,2) DEFAULT 0.00, -- Para el badge "#1 TENDENCIA GLOBAL"
    views_last_24h INT DEFAULT 0,
    followers_count INT DEFAULT 0,
    favorites_count INT DEFAULT 0,
    last_published_at TIMESTAMP NULL,
    latest_chapter_id INT NULL,
    latest_chapter_number DECIMAL(6,2) NULL,
    first_chapter_id INT NULL,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    INDEX idx_stats_trending (trending_score),
    INDEX idx_stats_weekly (weekly_views),
    INDEX idx_ws_last_published (last_published_at)
);

-- Logs de vistas (alimenta a work_statistics)
CREATE TABLE view_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    work_id INT NOT NULL,
    chapter_id INT,
    user_id INT,
    ip_address VARCHAR(64),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_view_logs_work_date (work_id, viewed_at),
    INDEX idx_view_logs_user_dedup (user_id, work_id, chapter_id),
    INDEX idx_view_logs_ip_dedup (ip_address, work_id, viewed_at),
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ==========================================
-- 7. MODERACIÓN, NOTIFICACIONES Y AUDITORÍA
-- ==========================================
CREATE TABLE notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(80) NOT NULL,
    payload JSON NOT NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user_unread (user_id, read_at, created_at)
);

CREATE TABLE comments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    work_id INT NOT NULL,
    chapter_id INT NULL,
    user_id INT NOT NULL,
    parent_id BIGINT NULL,
    content TEXT NOT NULL,
    contains_spoiler BOOLEAN DEFAULT FALSE,
    status ENUM('VISIBLE', 'HIDDEN', 'DELETED') DEFAULT 'VISIBLE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
    INDEX idx_comments_target_created (work_id, chapter_id, status, created_at)
);

CREATE TABLE comment_reactions (
    comment_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    reaction ENUM('LIKE', 'DISLIKE') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE content_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reporter_user_id INT NOT NULL,
    entity_type ENUM('COMMENT', 'CHAT', 'WORK', 'CHAPTER', 'USER') NOT NULL,
    entity_id BIGINT NOT NULL,
    reason VARCHAR(100) NOT NULL,
    details TEXT NULL,
    status ENUM('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED') DEFAULT 'OPEN',
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_reports_status_created (status, created_at)
);

CREATE TABLE audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NULL,
    before_data JSON NULL,
    after_data JSON NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_entity_date (entity_type, entity_id, created_at),
    INDEX idx_audit_actor_date (actor_user_id, created_at)
);

-- ==========================================
-- 8. CONFIGURACIÓN GLOBAL
-- ==========================================
CREATE TABLE platform_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSON NOT NULL, 
    description VARCHAR(255)
);

-- Configuración por defecto: rotación del Hero cada 24 horas
INSERT IGNORE INTO platform_settings (setting_key, setting_value, description)
VALUES ('hero_new_rotation_hours', '{"hours": 24}', 'Duración en horas de cada obra nueva en el Hero');

-- ==========================================
-- 9. COLA DE ROTACIÓN PARA OBRAS EN EL HERO
-- ==========================================
CREATE TABLE hero_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    work_id INT NOT NULL,
    status ENUM('PENDING', 'ACTIVE', 'EXPIRED') DEFAULT 'PENDING',
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    UNIQUE (work_id),
    INDEX idx_hero_queue_status (status, queued_at),
    INDEX idx_hero_queue_expires (expires_at)
);


CREATE TABLE announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scan_group_id INT NULL,
    type VARCHAR(50) NOT NULL,
    type_label VARCHAR(50) NOT NULL,
    source VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (scan_group_id) REFERENCES scan_groups(id) ON DELETE CASCADE
);


-- ==========================================
-- 10. ÍNDICES ADICIONALES DE RENDIMIENTO
-- ==========================================
-- Capítulos por obra + estado
CREATE INDEX idx_chapters_work_status_num ON chapters (work_id, status, chapter_number);

-- Historial de lectura por usuario ordenado por fecha
CREATE INDEX idx_reading_history_user_date ON reading_history (user_id, read_at DESC);

-- Ranking mensual
CREATE INDEX idx_stats_monthly ON work_statistics (monthly_views);

-- Estadísticas por favorites
CREATE INDEX idx_stats_favorites ON work_statistics (favorites_count);

-- Capítulos recientes
CREATE INDEX idx_chapters_status_published ON chapters (status, published_at);

CREATE INDEX idx_library_user_status_added ON user_library (user_id, status, added_at);
CREATE INDEX idx_scan_members_user_group ON scan_group_members (user_id, group_id);
CREATE INDEX idx_announcements_active_created ON announcements (is_active, created_at);

-- ==========================================
-- 11. TRIGGERS DE RENDIMIENTO (OPTIMIZACIÓN)
-- ==========================================
DELIMITER //

CREATE TRIGGER trg_chapters_after_insert 
AFTER INSERT ON chapters
FOR EACH ROW
BEGIN
    IF NEW.status = 'PUBLISHED' THEN
        -- Actualizar último capítulo publicado
        UPDATE work_statistics 
        SET last_published_at = NEW.published_at,
            latest_chapter_id = NEW.id,
            latest_chapter_number = NEW.chapter_number
        WHERE work_id = NEW.work_id AND (last_published_at IS NULL OR NEW.published_at >= last_published_at);
        
        -- Actualizar primer capítulo (si es el primero)
        UPDATE work_statistics 
        SET first_chapter_id = NEW.id
        WHERE work_id = NEW.work_id AND first_chapter_id IS NULL;
    END IF;
END;
//

CREATE TRIGGER trg_chapters_after_update
AFTER UPDATE ON chapters
FOR EACH ROW
BEGIN
    -- Recalcular de forma consolidada si hay cambio de estado de publicación o fecha
    IF OLD.status != NEW.status OR OLD.published_at != NEW.published_at THEN
        UPDATE work_statistics 
        SET 
            first_chapter_id = (SELECT id FROM chapters WHERE work_id = NEW.work_id AND status = 'PUBLISHED' ORDER BY chapter_number ASC, id ASC LIMIT 1),
            latest_chapter_id = (SELECT id FROM chapters WHERE work_id = NEW.work_id AND status = 'PUBLISHED' ORDER BY chapter_number DESC, id DESC LIMIT 1),
            latest_chapter_number = (SELECT chapter_number FROM chapters WHERE id = latest_chapter_id),
            last_published_at = (SELECT MAX(published_at) FROM chapters WHERE work_id = NEW.work_id AND status = 'PUBLISHED')
        WHERE work_id = NEW.work_id;
    END IF;
END;
//

DELIMITER ;
