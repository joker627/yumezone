-- Base de Datos: Yumezone

-- ==========================================
-- 1. USUARIOS, ROLES Y PRIVACIDAD
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

CREATE TABLE user_followers (
    follower_id INT,
    following_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 2. GRUPOS SCAN E INVITACIONES
-- ==========================================
CREATE TABLE scan_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url VARCHAR(255),
    banner_url VARCHAR(255),
    description TEXT,
    social_links JSON,
    report_methods JSON, -- Para almacenar links de WhatsApp, Discord, etc. de cada grupo
    status ENUM('ACTIVE', 'INACTIVE', 'DELETED') DEFAULT 'ACTIVE', -- Permite conservar el grupo para dar créditos aunque se retire
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scan_group_members (
    group_id INT,
    user_id INT,
    role ENUM('ADMIN', 'MODERATOR', 'MEMBER') DEFAULT 'MEMBER',
    permissions JSON, -- Detalles específicos de permisos para el nivel 'MEMBER'
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES scan_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE scan_group_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT,
    user_id INT,
    status ENUM('PENDING', 'ACCEPTED', 'REJECTED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL, 
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
    scan_group_id INT,
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
-- 6. GESTIÓN DE CAPÍTULOS
-- ==========================================
CREATE TABLE chapters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    work_id INT NOT NULL,
    scan_group_id INT, -- Puede ser distinto al de la obra si hay un scan colaborador
    chapter_number DECIMAL(6,2) NOT NULL, -- DECIMAL para capítulos como 10.5
    title VARCHAR(255),
    slug VARCHAR(255) UNIQUE,
    status ENUM('DRAFT', 'PUBLISHED', 'SCHEDULED', 'HIDDEN') DEFAULT 'PUBLISHED',
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    FOREIGN KEY (scan_group_id) REFERENCES scan_groups(id) ON DELETE SET NULL,
    UNIQUE (work_id, chapter_number), -- Evita subir dos veces el mismo capítulo para la misma obra
    INDEX idx_chapters_work_published (work_id, published_at)
);

CREATE TABLE chapter_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chapter_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    order_number INT NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    UNIQUE (chapter_id, order_number) -- Evita que dos imágenes tengan el mismo número de orden
);

-- ==========================================
-- 7. BIBLIOTECA, HISTORIAL Y RANKINGS
-- ==========================================
CREATE TABLE user_library (
    user_id INT,
    work_id INT,
    status ENUM('FAVORITE', 'FOLLOWING', 'READ_LATER', 'COMPLETED', 'DROPPED') DEFAULT 'FOLLOWING',
    rating DECIMAL(3,1) CHECK (rating >= 0.0 AND rating <= 10.0),
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
    UNIQUE (user_id, work_id) -- Un solo registro de última lectura por obra y usuario
);

-- Tabla para almacenar estadísticas (Ideal para rankings diarios, semanales, etc.)
CREATE TABLE work_statistics (
    work_id INT PRIMARY KEY,
    total_views INT DEFAULT 0,
    daily_views INT DEFAULT 0,
    weekly_views INT DEFAULT 0,
    monthly_views INT DEFAULT 0,
    rating_average DECIMAL(3,2) DEFAULT 0.00,
    followers_count INT DEFAULT 0,
    favorites_count INT DEFAULT 0,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

-- Tabla de logs para vistas (Mejora de rendimiento para no bloquear work_statistics)
CREATE TABLE view_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    work_id INT NOT NULL,
    chapter_id INT, -- Nulo si la vista es en la página principal de la obra
    user_id INT, -- Nulo si es un invitado
    ip_address VARCHAR(45), -- Opcional, para rastrear bots
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_view_logs_work_date (work_id, viewed_at)
);

-- ==========================================
-- 8. COMUNIDAD Y SOCIAL
-- ==========================================
CREATE TABLE comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    work_id INT, -- Nulo si el comentario es en un capítulo
    chapter_id INT, -- Nulo si el comentario es general en la obra
    content TEXT NOT NULL,
    is_spoiler BOOLEAN DEFAULT FALSE,
    parent_id INT, -- Para respuestas a otros comentarios
    status ENUM('ACTIVE', 'HIDDEN', 'DELETED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE TABLE comment_reactions (
    comment_id INT,
    user_id INT,
    reaction_type ENUM('LIKE', 'DISLIKE', 'LAUGH', 'SAD', 'ANGRY') NOT NULL,
    PRIMARY KEY (comment_id, user_id),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE global_chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    reply_to_id INT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reply_to_id) REFERENCES global_chat_messages(id) ON DELETE SET NULL
);

-- ==========================================
-- 9. TABLONES
-- ==========================================
CREATE TABLE general_board_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE scan_group_board_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    author_id INT NOT NULL, -- Líder o Admin del grupo
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES scan_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 10. NOTIFICACIONES
-- ==========================================
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('NEW_CHAPTER', 'NEW_WORK', 'COMMENT_REPLY', 'GROUP_INVITE', 'GENERAL_ANNOUNCEMENT', 'GROUP_ANNOUNCEMENT', 'MENTION') NOT NULL,
    reference_id INT, -- ID de referencia (ej. el id del capítulo o del mensaje)
    content VARCHAR(255) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user_read (user_id, is_read) -- Index para cargar rápido el panel de notificaciones
);

-- ==========================================
-- 11. CONFIGURACIÓN GLOBAL (Reportes y Enlaces)
-- ==========================================
CREATE TABLE platform_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL, -- Ej: 'whatsapp_report_link', 'discord_link'
    setting_value JSON NOT NULL, -- Permite guardar links y descripciones para reportes
    description VARCHAR(255)
);
