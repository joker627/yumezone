CREATE DATABASE IF NOT EXISTS yumezone DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE yumezone;

-- 1. Tabla de Usuarios (Uploaders, Admins, Lectores)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin', 'super_admin') DEFAULT 'user',
    avatar_url VARCHAR(512),
    bio TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Tabla de Grupos de Scanlation
CREATE TABLE IF NOT EXISTS scan_groups (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    website VARCHAR(255),
    discord_url VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Miembros de los grupos de Scan
CREATE TABLE IF NOT EXISTS scan_group_members (
    user_id VARCHAR(36) NOT NULL,
    scan_group_id VARCHAR(36) NOT NULL,
    role ENUM('leader', 'member') DEFAULT 'member',
    PRIMARY KEY (user_id, scan_group_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (scan_group_id) REFERENCES scan_groups(id) ON DELETE CASCADE
);

-- 4. Tabla de Mangas
CREATE TABLE IF NOT EXISTS mangas (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    author VARCHAR(255),
    artist VARCHAR(255),
    type ENUM('manga', 'manhwa', 'manhua', 'comic') NOT NULL,
    status ENUM('ongoing', 'completed', 'hiatus', 'cancelled') NOT NULL DEFAULT 'ongoing',
    cover_url VARCHAR(512),
    banner_url VARCHAR(512),
    rating DECIMAL(3,2) DEFAULT 0.00,
    views BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- 5. Tabla de Géneros
CREATE TABLE IF NOT EXISTS genres (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE
);

-- 6. Relación Manga-Género 
CREATE TABLE IF NOT EXISTS manga_genres (
    manga_id VARCHAR(36) NOT NULL,
    genre_id INT NOT NULL,
    PRIMARY KEY (manga_id, genre_id),
    FOREIGN KEY (manga_id) REFERENCES mangas(id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
);

-- 7. Tabla de Capítulos
CREATE TABLE IF NOT EXISTS chapters (
    id VARCHAR(36) PRIMARY KEY,
    manga_id VARCHAR(36) NOT NULL,
    uploader_id VARCHAR(36) NOT NULL,
    scan_group_id VARCHAR(36),
    chapter_number DECIMAL(6,2) NOT NULL,
    title VARCHAR(255),
    views BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manga_id) REFERENCES mangas(id) ON DELETE CASCADE,
    FOREIGN KEY (uploader_id) REFERENCES users(id),
    FOREIGN KEY (scan_group_id) REFERENCES scan_groups(id) ON DELETE SET NULL,
    UNIQUE KEY unique_chapter_per_group (manga_id, chapter_number, scan_group_id) 
);

-- 8. Páginas del Capítulo
CREATE TABLE IF NOT EXISTS chapter_pages (
    id VARCHAR(36) PRIMARY KEY,
    chapter_id VARCHAR(36) NOT NULL,
    page_number INT NOT NULL,
    image_url VARCHAR(512) NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    UNIQUE KEY unique_page_per_chapter (chapter_id, page_number)
);

CREATE TABLE pages (
    id VARCHAR(36) PRIMARY KEY,
    chapter_id VARCHAR(36) NOT NULL,
    page_number INT NOT NULL,
    image_url VARCHAR(512) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

-- 9. Favoritos y Marcadores
CREATE TABLE IF NOT EXISTS bookmarks (
    user_id VARCHAR(36) NOT NULL,
    manga_id VARCHAR(36) NOT NULL,
    status ENUM('reading', 'completed', 'plan_to_read', 'dropped') NOT NULL DEFAULT 'reading',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, manga_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (manga_id) REFERENCES mangas(id) ON DELETE CASCADE
);

-- 10. Historial de Lectura
CREATE TABLE IF NOT EXISTS reading_history (
    user_id VARCHAR(36) NOT NULL,
    manga_id VARCHAR(36) NOT NULL,
    last_chapter_id VARCHAR(36) NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, manga_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (manga_id) REFERENCES mangas(id) ON DELETE CASCADE,
    FOREIGN KEY (last_chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

-- 11. Comentarios
CREATE TABLE IF NOT EXISTS comments (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    manga_id VARCHAR(36),
    chapter_id VARCHAR(36),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (manga_id) REFERENCES mangas(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

-- 12. Valoraciones
CREATE TABLE IF NOT EXISTS ratings (
    user_id VARCHAR(36) NOT NULL,
    manga_id VARCHAR(36) NOT NULL,
    score DECIMAL(3,2) NOT NULL CHECK (score >= 1 AND score <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, manga_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (manga_id) REFERENCES mangas(id) ON DELETE CASCADE
);
