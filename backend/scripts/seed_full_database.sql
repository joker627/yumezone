-- SCRIPT DE DATOS SEMILLA MASIVOS PARA YUMEZONE

-- 1. Configuraciones de Lectura del Usuario 1
INSERT INTO reading_settings (user_id, reading_mode, zoom_level, background_color) 
VALUES (1, 'VERTICAL', 100, 'DARK')
ON DUPLICATE KEY UPDATE reading_mode=VALUES(reading_mode);

-- 2. Crear un Grupo Scan y hacer al Usuario 1 el Líder
INSERT INTO scan_groups (id, name, slug, description) 
VALUES (1, 'Yume Scans', 'yume-scans', 'Grupo oficial de traducciones de YumeZone.')
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO scan_group_members (group_id, user_id, role) 
VALUES (1, 1, 'ADMIN')
ON DUPLICATE KEY UPDATE role=VALUES(role);

-- 3. Categorías Básicas (Por si no se han ejecutado)
INSERT IGNORE INTO statuses (id, name) VALUES (1, 'En Emisión'), (2, 'Finalizado'), (3, 'En Pausa');
INSERT IGNORE INTO formats (id, name) VALUES (1, 'Manhua'), (2, 'Manhwa'), (3, 'Webtoon');
INSERT IGNORE INTO demographics (id, name) VALUES (1, 'Shonen'), (2, 'Seinen');
INSERT IGNORE INTO genres (id, name) VALUES (1, 'Acción'), (2, 'Isekai'), (3, 'Romance'), (4, 'Fantasía');
INSERT IGNORE INTO tags (id, name) VALUES (1, 'Sistema'), (2, 'Reencarnación'), (3, 'Magia');

-- 4. Obras (Conectadas al Scan Group 1)
INSERT INTO works (id, title, slug, synopsis, author, cover_url, banner_url, status_id, format_id, demographic_id, scan_group_id) VALUES 
(1, 'Solo Leveling', 'solo-leveling', 'Cazador de rango E despierta un sistema.', 'Chugong', 'https://cdn.animeav1.com/covers/149.jpg', 'https://cdn.animeav1.com/backdrops/149.jpg', 2, 2, 1, 1),
(2, 'The Beginning After The End', 'the-beginning-after-the-end', 'Rey reencarna en mundo de magia.', 'TurtleMe', 'https://m.media-amazon.com/images/S/pv-target-images/a0b185925ca0276605f17bf5bb6a7ebac8b422561b1b98d68a2e829557099414.jpg', 'https://www.animeplus.mx/wp-content/uploads/2025/04/Saikyou-no-Ousama-Nidome-no-Jinsei-wa-Nani-wo-Suru-banner.jpg', 1, 3, 1, 1)
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- 5. Relaciones de Géneros y Etiquetas
INSERT IGNORE INTO work_genres (work_id, genre_id) VALUES (1, 1), (1, 4), (2, 1), (2, 2), (2, 4);
INSERT IGNORE INTO work_tags (work_id, tag_id) VALUES (1, 1), (2, 2), (2, 3);

-- 6. Capítulos
INSERT INTO chapters (id, work_id, scan_group_id, chapter_number, title) VALUES 
(1, 1, 1, 1.00, 'El Despertar'),
(2, 1, 1, 2.00, 'La Prueba Diaria'),
(3, 2, 1, 1.00, 'Un Nuevo Comienzo')
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- 6.5 Estadísticas iniciales de Obras
INSERT IGNORE INTO work_statistics (work_id, total_views, rating_average, followers_count, favorites_count) VALUES
(1, 1500, 9.8, 500, 300),
(2, 850, 9.5, 200, 150);

-- 7. Imágenes de los Capítulos (Simulación de páginas)
INSERT IGNORE INTO chapter_images (chapter_id, image_url, order_number) VALUES 
(1, 'https://ejemplo.com/pagina1.jpg', 1),
(1, 'https://ejemplo.com/pagina2.jpg', 2),
(2, 'https://ejemplo.com/pagina1.jpg', 1),
(3, 'https://ejemplo.com/pagina1.jpg', 1);

-- 8. Biblioteca del Usuario 1 (Agregando obras a favoritos)
INSERT INTO user_library (user_id, work_id, status, rating) VALUES 
(1, 1, 'FAVORITE', 10.0),
(1, 2, 'READ_LATER', NULL)
ON DUPLICATE KEY UPDATE status=VALUES(status);

-- 9. Historial de Lectura del Usuario 1 (Dónde se quedó leyendo)
INSERT INTO reading_history (user_id, work_id, chapter_id, last_page_read) VALUES 
(1, 1, 1, 2)
ON DUPLICATE KEY UPDATE last_page_read=VALUES(last_page_read);

-- 10. Comentarios del Usuario 1
INSERT INTO comments (id, user_id, work_id, content) VALUES 
(1, 1, 1, '¡Esta obra es una obra de arte! La recomiendo totalmente.')
ON DUPLICATE KEY UPDATE content=VALUES(content);

-- 11. Notificaciones para el Usuario 1
INSERT INTO notifications (user_id, type, content) VALUES 
(1, 'GENERAL_ANNOUNCEMENT', '¡Bienvenido a YumeZone, gracias por registrarte!'),
(1, 'NEW_CHAPTER', 'Un nuevo capítulo de Solo Leveling ha sido subido.');

-- 12. Tablón de Anuncios del Staff
INSERT INTO general_board_posts (id, admin_id, title, content, is_pinned) VALUES 
(1, 1, 'Inauguración de YumeZone', 'Bienvenidos a la mejor plataforma de lectura de Manhuas y Webtoons.', TRUE)
ON DUPLICATE KEY UPDATE title=VALUES(title);
