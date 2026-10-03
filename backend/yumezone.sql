-- Base de Datos: Yumezone
CREATE DATABASE IF NOT EXISTS yumezone;
USE yumezone;
-- ==========================================
-- 1. USUARIOS Y CONFIGURACIÓN DE LECTURA
-- ==========================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_code VARCHAR(16) UNIQUE NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255),
    bio TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    platform_role ENUM('USER', 'ADMIN', 'SUPERADMIN') DEFAULT 'USER',
    status ENUM('ACTIVE', 'SUSPENDED', 'BLOCKED', 'DELETED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE reading_settings (
    user_id INT PRIMARY KEY,
    reading_mode ENUM('VERTICAL', 'PAGINATED') DEFAULT 'VERTICAL',
    zoom_level INT DEFAULT 100,
    brightness INT DEFAULT 100,
    background_color VARCHAR(20) DEFAULT 'DARK',
    image_quality ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'HIGH',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 2. GRUPOS SCAN
-- ==========================================
CREATE TABLE scan_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url VARCHAR(255),
    banner_url VARCHAR(255),
    description TEXT,
    social_links JSON,
    report_methods JSON,
    status ENUM('ACTIVE', 'INACTIVE', 'DELETED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scan_group_members (
    group_id INT,
    user_id INT,
    role ENUM('ADMIN', 'MODERATOR', 'MEMBER') DEFAULT 'MEMBER',
    permissions JSON,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES scan_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
    INDEX idx_works_created (created_at)
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
    image_url VARCHAR(255) NOT NULL,
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

-- Estadísticas para rankings (TOP, POPULAR, etc.)
CREATE TABLE work_statistics (
    work_id INT PRIMARY KEY,
    total_views INT DEFAULT 0,
    daily_views INT DEFAULT 0,
    weekly_views INT DEFAULT 0,
    monthly_views INT DEFAULT 0,
    rating_average DECIMAL(3,2) DEFAULT 0.00,
    rating_count INT DEFAULT 0, -- Para mostrar "9.94 (42.8k)"
    trending_score DECIMAL(10,2) DEFAULT 0.00, -- Para el badge "#1 TENDENCIA GLOBAL"
    views_last_24h INT DEFAULT 0,
    followers_count INT DEFAULT 0,
    favorites_count INT DEFAULT 0,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    INDEX idx_stats_trending (trending_score),
    INDEX idx_stats_weekly (weekly_views)
);

-- Logs de vistas (alimenta a work_statistics)
CREATE TABLE view_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    work_id INT NOT NULL,
    chapter_id INT,
    user_id INT,
    ip_address VARCHAR(45),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_view_logs_work_date (work_id, viewed_at)
);

-- ==========================================
-- 7. CONFIGURACIÓN GLOBAL
-- ==========================================
CREATE TABLE platform_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSON NOT NULL, 
    description VARCHAR(255)
);

-- Configuración por defecto: rotación del Hero cada 24 horas
INSERT INTO platform_settings (setting_key, setting_value, description) 
VALUES ('hero_new_rotation_hours', '{"hours": 24}', 'Duración en horas de cada obra nueva en el Hero');

-- ==========================================
-- 8. COLA DE ROTACIÓN PARA OBRAS NUEVAS EN EL HERO
-- ==========================================
CREATE TABLE hero_new_queue (
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