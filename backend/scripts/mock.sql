-- ==========================================
-- MOCK DATA: YUMEZONE (VERSIÓN CON OBRAS REALES)
-- Ejecutar DESPUÉS de crear las tablas
-- ==========================================

-- ==========================================
-- 1. USUARIOS (5 usuarios: 1 admin, 1 scan lead, 3 lectores)
-- ==========================================
INSERT INTO users (id, user_code, username, email, password, avatar_url, bio, platform_role, status) VALUES
(1, 'ADM001', 'YumeMaster', 'admin@yumezone.com', '$2b$12$hash_fake_admin', 'https://i.pravatar.cc/150?u=admin', 'Fundador de Yumezone', 'SUPERADMIN', 'ACTIVE'),
(2, 'SCN001', 'GhostLeader', 'ghost@yumezone.com', '$2b$12$hash_fake_ghost', 'https://i.pravatar.cc/150?u=ghost', 'Líder de GhostScans', 'USER', 'ACTIVE'),
(3, 'USR001', 'KiritoFan', 'kirito@test.com', '$2b$12$hash_fake_user1', 'https://i.pravatar.cc/150?u=kirito', 'Fan del cultivo espectral', 'USER', 'ACTIVE'),
(4, 'USR002', 'SakuraChan', 'sakura@test.com', '$2b$12$hash_fake_user2', 'https://i.pravatar.cc/150?u=sakura', 'Amante del shoujo y la fantasía', 'USER', 'ACTIVE'),
(5, 'USR003', 'OtakuKing', 'otaku@test.com', '$2b$12$hash_fake_user3', 'https://i.pravatar.cc/150?u=otaku', 'Devoro 100 caps al día', 'USER', 'ACTIVE');

INSERT INTO reading_settings (user_id, reading_mode, zoom_level, brightness, background_color, image_quality) VALUES
(1, 'VERTICAL', 100, 100, 'DARK', 'HIGH'),
(2, 'VERTICAL', 100, 90, 'DARK', 'HIGH'),
(3, 'PAGINATED', 110, 80, 'SEPIA', 'MEDIUM'),
(4, 'VERTICAL', 100, 100, 'DARK', 'HIGH'),
(5, 'PAGINATED', 90, 70, 'BLACK', 'HIGH');

-- ==========================================
-- 2. GRUPOS SCAN
-- ==========================================
INSERT INTO scan_groups (id, name, slug, logo_url, banner_url, description, social_links, status) VALUES
(1, 'GhostScans', 'ghostscans', 'https://placehold.co/200x200/22c55e/ffffff?text=GS', 'https://placehold.co/1200x400/22c55e/ffffff?text=GhostScans', 'Grupo líder en manhuas de cultivo espectral.', '{"discord":"https://discord.gg/ghostscans","web":"https://ghostscans.com"}', 'ACTIVE'),
(2, 'YumeScans', 'yumescans', 'https://placehold.co/200x200/8b5cf6/ffffff?text=YS', 'https://placehold.co/1200x400/8b5cf6/ffffff?text=YumeScans', 'Especialistas en manhwas de acción y romance.', '{"discord":"https://discord.gg/yumescans"}', 'ACTIVE'),
(3, 'DragonTL', 'dragontl', 'https://placehold.co/200x200/ef4444/ffffff?text=DT', 'https://placehold.co/1200x400/ef4444/ffffff?text=DragonTL', 'Traducciones de los mejores mangas shonen.', '{"discord":"https://discord.gg/dragontl"}', 'ACTIVE'),
(4, 'SakuraTeam', 'sakurateam', 'https://placehold.co/200x200/ec4899/ffffff?text=ST', 'https://placehold.co/1200x400/ec4899/ffffff?text=SakuraTeam', 'Enfoque en shoujo y josei.', '{"discord":"https://discord.gg/sakurateam"}', 'ACTIVE'),
(5, 'ShadowTL', 'shadowtl', 'https://placehold.co/200x200/0ea5e9/ffffff?text=SH', 'https://placehold.co/1200x400/0ea5e9/ffffff?text=ShadowTL', 'Traducciones oscuras y de fantasía.', '{"discord":"https://discord.gg/shadowtl"}', 'ACTIVE');

INSERT INTO scan_group_members (group_id, user_id, role, permissions) VALUES
(1, 2, 'ADMIN', '{"can_upload": true, "can_edit": true}'),
(1, 3, 'MEMBER', '{"can_upload": false, "can_comment": true}'),
(2, 4, 'ADMIN', '{"can_upload": true, "can_edit": true}'),
(3, 5, 'MEMBER', '{"can_upload": false}');

-- ==========================================
-- 3. CLASIFICACIÓN
-- ==========================================
INSERT INTO statuses (id, name) VALUES
(1, 'En emisión'), (2, 'Finalizado'), (3, 'En pausa'), (4, 'Cancelado');

INSERT INTO formats (id, name) VALUES
(1, 'Manga'), (2, 'Manhua'), (3, 'Manhwa'), (4, 'Webtoon');

INSERT INTO demographics (id, name) VALUES
(1, 'Shonen'), (2, 'Seinen'), (3, 'Shojo'), (4, 'Josei');

INSERT INTO genres (id, name) VALUES
(1, 'Acción'), (2, 'Aventura'), (3, 'Fantasía'), (4, 'Romance'),
(5, 'Comedia'), (6, 'Drama'), (7, 'Terror'), (8, 'Misterio'),
(9, 'Cultivo'), (10, 'Reencarnación'), (11, 'Venganza'), (12, 'Sobrenatural'),
(13, 'Escolar'), (14, 'Isekai'), (15, 'Artes Marciales'),
(16, 'Apocalíptico'), (17, 'Sistema'), (18, 'Mazmorras');

INSERT INTO tags (id, name) VALUES
(1, 'Protagonista Fuerte'), (2, 'Sistema'), (3, 'Harem'), (4, 'Mundo Mágico'),
(5, 'Venganza'), (6, 'Dragones'), (7, 'Dioses'), (8, 'Sectas'),
(9, 'Cultivo Espectral'), (10, 'Reencarnado en otro mundo'),
(11, 'OP MC'), (12, 'Time Travel'), (13, 'Regresión');

-- ==========================================
-- 4. OBRAS REALES (12 obras populares)
-- ==========================================
INSERT INTO works (id, title, slug, alternative_title, synopsis, author, cover_url, banner_url, status_id, format_id, demographic_id, scan_group_id) VALUES
(1, 'Solo Leveling', 'solo-leveling', 'Na Honjaman Level Up',
 'En un mundo donde los cazadores luchan contra monstruos que salen de portales, Sung Jin-Woo es conocido como el cazador más débil de rango E. Tras sobrevivir a una mazmorra doble que acaba con casi todo su equipo, despierta con un sistema misterioso que le permite subir de nivel infinitamente como en un videojuego. Ahora tiene la oportunidad de convertirse en el cazador más fuerte de la historia.',
 'Chugong',
 'https://placehold.co/400x600/1a1a1a/60a5fa?text=Solo+Leveling',
 'https://placehold.co/1920x1080/0a0a0a/60a5fa?text=Solo+Leveling',
 2, 3, 1, 1),

(2, 'Martial Peak', 'martial-peak', 'Wu Lian Feng Dian',
 'Yang Kai es un discípulo ordinario del Secta High Heaven Pavilion que un día encuentra un libro negro misterioso. Ese libro resulta ser un artefacto legendario que le permite cultivar a un ritmo imposible. Ahora deberá escalar la cima del mundo marcial, enfrentando sectas poderosas, demonios y dioses, mientras descubre la verdad sobre el universo.',
 'Momo',
 'https://placehold.co/400x600/dc2626/ffffff?text=Martial+Peak',
 'https://placehold.co/1920x1080/450a0a/ffffff?text=Martial+Peak',
 1, 2, 1, 1),

(3, 'The Beginning After the End', 'the-beginning-after-the-end', 'TBATE',
 'El Rey Grey, un poderoso monarca que dominaba el mundo gracias a su fuerza y conocimiento, muere y renace en un mundo de magia como Arthur Leywin. Con las memorias de su vida pasada, decide esta vez vivir sin arrepentimientos, protegiendo a su familia y entrenándose para enfrentar una amenaza que podría destruir todo lo que ama.',
 'TurtleMe',
 'https://placehold.co/400x600/7c3aed/ffffff?text=TBATE',
 'https://placehold.co/1920x1080/3b0764/ffffff?text=TBATE',
 1, 3, 1, 2),

(4, 'Omniscient Reader\'s Viewpoint', 'omniscient-readers-viewpoint', 'ORV',
 'Kim Dokja es un oficinista común cuya única pasión es leer la novela web "Tres formas de sobrevivir". Cuando la novela termina, el mundo real se convierte en el escenario de esa historia. Ahora, siendo el único que conoce el final, Dokja deberá usar su conocimiento para sobrevivir al apocalipsis y a los escenarios que se desarrollan a su alrededor.',
 'Sing Shong',
 'https://placehold.co/400x600/06b6d4/ffffff?text=ORV',
 'https://placehold.co/1920x1080/083344/ffffff?text=ORV',
 1, 3, 1, 2),

(5, 'Who Made Me a Princess', 'who-made-me-a-princess', 'WMMAP',
 'Athanasia despierta en el cuerpo de la hija del emperador Claude, un hombre temido que en la novela original asesina a su propia hija. Sabiendo que su muerte es inevitable si no cambia el destino, decide ganarse el afecto de su padre para sobrevivir. Pero los sentimientos que empiezan a surgir entre ellos van más allá de lo que esperaba.',
 'Plutus',
 'https://placehold.co/400x600/ec4899/ffffff?text=WMMAP',
 'https://placehold.co/1920x1080/831843/ffffff?text=WMMAP',
 2, 4, 3, 4),

(6, 'Tales of Demons and Gods', 'tales-of-demons-and-gods', 'Yao Shen Ji',
 'Nie Li, el guerrero más fuerte de su era, muere en la batalla final contra los sabios demonios. Renace en su cuerpo de 13 años, cuando era el estudiante más débil de su clase. Con el conocimiento de sus años de experiencia, ahora puede reescribir el destino y salvar a sus seres queridos de la tragedia que se avecina.',
 'Mad Snail',
 'https://placehold.co/400x600/f59e0b/ffffff?text=Yao+Shen+Ji',
 'https://placehold.co/1920x1080/78350f/ffffff?text=Yao+Shen+Ji',
 1, 2, 1, 3),

(7, 'Nano Machine', 'nano-machine', 'Nano Mashin',
 'Cheon Yeo-Woon es el príncipe abandonado de la Secta Demoníaca, destinado a morir a manos de sus hermanos. Pero un descendiente del futuro le inyecta nanomáquinas que reparan y mejoran su cuerpo. Ahora, con un poder tecnológico siglos por delante de su era, Cheon Yeo-Woon comenzará su ascenso para reclamar lo que le pertenece.',
 'Hanjungwol',
 'https://placehold.co/400x600/8b5cf6/ffffff?text=Nano+Machine',
 'https://placehold.co/1920x1080/2e1065/ffffff?text=Nano+Machine',
 1, 3, 1, 5),

(8, 'The Great Mage Returns After 4000 Years', 'the-great-mage-returns-after-4000-years', 'TGMR',
 'Lucas Traumen, el mago más poderoso de su era, fue traicionado y sellado durante 4000 años. Al despertar, descubre que la magia ha decaído y que el mundo está gobernado por falsos dioses. Ahora, en el cuerpo de un joven noble débil, buscará venganza contra aquellos que lo traicionaron y restaurará el verdadero arte de la magia.',
 'Yeon Sanho',
 'https://placehold.co/400x600/6366f1/ffffff?text=TGMR',
 'https://placehold.co/1920x1080/1e1b4b/ffffff?text=TGMR',
 1, 3, 1, 5),

(9, 'Villains Are Destined to Die', 'villains-are-destined-to-die', 'VADTD',
 'Penelope Eckhart despierta en el cuerpo de la villana de una novela otome. En el juego, su personaje muere siempre antes del final. Decidida a sobrevivir, Penelope deberá ganar el afecto de los tres hermanos del protagonista y del misterioso príncipe heredero, mientras intenta escapar del destino que le espera.',
 'Gwon Gyeoeul',
 'https://placehold.co/400x600/f472b6/ffffff?text=VADTD',
 'https://placehold.co/1920x1080/831843/ffffff?text=VADTD',
 1, 4, 3, 4),

(10, 'Against the Gods', 'against-the-gods', 'Ni Tian Xie Shen',
 'Yun Che, un joven que muere persiguiendo un tesoro legendario, renace en el cuerpo de un muchacho ciego y maltratado en un continente donde la fuerza lo es todo. Con el conocimiento de su vida pasada y la ayuda del misterioso Espejo Celestial, comenzará su camino para desafiar a los cielos y vengar las injusticias cometidas contra él.',
 'Mars Gravity',
 'https://placehold.co/400x600/10b981/ffffff?text=ATG',
 'https://placehold.co/1920x1080/064e3b/ffffff?text=Against+the+Gods',
 1, 2, 1, 3),

(11, 'Battle Through the Heavens', 'battle-through-the-heavens', 'Doupo Cangqiong',
 'Xiao Yan fue un genio de la alquimia y el cultivo hasta que perdió sus poderes a los 12 años. Ahora, siendo el hazmerreír de su clan, recibe la visita del espíritu de Yao Chen, un alquimista legendario atrapado en un anillo. Con su ayuda, Xiao Yan emprenderá un viaje para recuperar su poder y convertirse en el alquimista más fuerte del continente.',
 'Tian Can Tu Dou',
 'https://placehold.co/400x600/ef4444/ffffff?text=BTTH',
 'https://placehold.co/1920x1080/7f1d1d/ffffff?text=BTTH',
 2, 2, 1, 3),

(12, 'Overgeared', 'overgeared', 'Temppal',
 'Shin Youngwoo es un jugador pobre que dedica su vida a un videojuego de realidad virtual para mantener a su familia. Tras conseguir un objeto legendario por accidente, se transforma en un jugador con un potencial inimaginable. Ahora deberá equilibrar su vida real con su ascenso para convertirse en la leyenda del servidor.',
 'Park Saenal',
 'https://placehold.co/400x600/f97316/ffffff?text=Overgeared',
 'https://placehold.co/1920x1080/7c2d12/ffffff?text=Overgeared',
 1, 3, 1, 2);

-- ==========================================
-- 5. RELACIONES OBRA-GÉNERO Y OBRA-TAG
-- ==========================================
INSERT INTO work_genres (work_id, genre_id) VALUES
-- Solo Leveling
(1, 1),(1, 2),(1, 3),(1, 12),(1, 18),
-- Martial Peak
(2, 1),(2, 3),(2, 9),(2, 15),
-- TBATE
(3, 1),(3, 2),(3, 3),(3, 10),
-- ORV
(4, 1),(4, 3),(4, 8),(4, 16),
-- WMMAP
(5, 4),(5, 6),(5, 3),
-- Tales of Demons and Gods
(6, 1),(6, 3),(6, 10),(6, 15),
-- Nano Machine
(7, 1),(7, 3),(7, 9),(7, 15),
-- TGMR
(8, 1),(8, 3),(8, 10),(8, 17),
-- VADTD
(9, 4),(9, 6),(9, 14),
-- Against the Gods
(10, 1),(10, 3),(10, 9),(10, 15),
-- BTTH
(11, 1),(11, 3),(11, 9),(11, 15),
-- Overgeared
(12, 1),(12, 2),(12, 3),(12, 17);

INSERT INTO work_tags (work_id, tag_id) VALUES
(1, 1),(1, 2),(1, 11),
(2, 1),(2, 8),(2, 9),
(3, 1),(3, 10),(3, 11),
(4, 1),(4, 2),(4, 13),
(5, 4),(5, 10),
(6, 1),(6, 10),(6, 12),
(7, 1),(7, 8),(7, 11),
(8, 1),(8, 11),(8, 12),
(9, 10),(9, 13),
(10, 1),(10, 8),(10, 9),
(11, 1),(11, 9),(11, 8),
(12, 1),(12, 2),(12, 11);

-- ==========================================
-- 6. CAPÍTULOS
-- ==========================================
INSERT INTO chapters (id, work_id, scan_group_id, chapter_number, title, slug, status, published_at) VALUES
-- Solo Leveling (ya finalizado, 179 caps)
(1, 1, 1, 1.00, 'El Cazador Más Débil', 'sl-cap-1', 'PUBLISHED', '2023-01-01 10:00:00'),
(2, 1, 1, 100.00, 'El Rey de las Sombras', 'sl-cap-100', 'PUBLISHED', '2023-06-01 10:00:00'),
(3, 1, 1, 178.00, 'El Último Cazador', 'sl-cap-178', 'PUBLISHED', NOW() - INTERVAL 2 HOUR),
(4, 1, 1, 179.00, 'Epílogo: El Nuevo Comienzo', 'sl-cap-179', 'SCHEDULED', NOW() + INTERVAL 2 DAY),

-- Martial Peak (en emisión, 3600+ caps - aquí solo 3 de prueba)
(5, 2, 1, 1.00, 'El Libro Negro', 'mp-cap-1', 'PUBLISHED', '2022-01-01 10:00:00'),
(6, 2, 1, 3000.00, 'La Cima Marcial', 'mp-cap-3000', 'PUBLISHED', NOW() - INTERVAL 1 DAY),
(7, 2, 1, 3600.00, 'El Nuevo Mundo', 'mp-cap-3600', 'PUBLISHED', NOW() - INTERVAL 4 HOUR),

-- TBATE
(8, 3, 2, 1.00, 'El Rey Gris', 'tbate-cap-1', 'PUBLISHED', '2022-03-15 10:00:00'),
(9, 3, 2, 175.00, 'La Guerra de los Dioses', 'tbate-cap-175', 'PUBLISHED', NOW() - INTERVAL 5 HOUR),

-- ORV
(10, 4, 2, 1.00, 'El Escenario Comienza', 'orv-cap-1', 'PUBLISHED', '2022-05-01 10:00:00'),
(11, 4, 2, 190.00, 'El Lector Omnisciente', 'orv-cap-190', 'PUBLISHED', NOW() - INTERVAL 12 HOUR),

-- WMMAP
(12, 5, 4, 1.00, 'El Despertar', 'wmmap-cap-1', 'PUBLISHED', '2022-04-01 10:00:00'),
(13, 5, 4, 120.00, 'El Amor del Emperador', 'wmmap-cap-120', 'PUBLISHED', NOW() - INTERVAL 3 DAY),

-- Tales of Demons and Gods
(14, 6, 3, 1.00, 'El Renacer de Nie Li', 'tdg-cap-1', 'PUBLISHED', '2022-06-01 10:00:00'),
(15, 6, 3, 400.00, 'La Secta Divina', 'tdg-cap-400', 'PUBLISHED', NOW() - INTERVAL 10 HOUR),

-- Nano Machine
(16, 7, 5, 1.00, 'Las Nanomáquinas', 'nm-cap-1', 'PUBLISHED', '2023-02-01 10:00:00'),
(17, 7, 5, 200.00, 'El Príncipe Demonio', 'nm-cap-200', 'PUBLISHED', NOW() - INTERVAL 6 HOUR),

-- TGMR
(18, 8, 5, 1.00, 'El Regreso', 'tgmr-cap-1', 'PUBLISHED', '2023-03-01 10:00:00'),
(19, 8, 5, 150.00, 'La Nueva Era', 'tgmr-cap-150', 'PUBLISHED', NOW() - INTERVAL 8 HOUR),

-- VADTD
(20, 9, 4, 1.00, 'La Villana Despierta', 'vadtd-cap-1', 'PUBLISHED', '2023-04-01 10:00:00'),
(21, 9, 4, 130.00, 'El Afecto del Príncipe', 'vadtd-cap-130', 'PUBLISHED', NOW() - INTERVAL 4 HOUR),

-- Against the Gods
(22, 10, 3, 1.00, 'El Renacer de Yun Che', 'atg-cap-1', 'PUBLISHED', NOW() - INTERVAL 20 HOUR),
(23, 10, 3, 2000.00, 'La Cima de los Dioses', 'atg-cap-2000', 'PUBLISHED', NOW() - INTERVAL 20 HOUR),

-- BTTH
(24, 11, 3, 1.00, 'La Caída del Genio', 'btth-cap-1', 'PUBLISHED', NOW() - INTERVAL 12 HOUR),
(25, 11, 3, 500.00, 'El Alquimista Legendario', 'btth-cap-500', 'PUBLISHED', NOW() - INTERVAL 12 HOUR),

-- Overgeared
(26, 12, 2, 1.00, 'El Objeto Legendario', 'og-cap-1', 'PUBLISHED', NOW() - INTERVAL 6 HOUR),
(27, 12, 2, 150.00, 'El Rey del Servidor', 'og-cap-150', 'PUBLISHED', NOW() - INTERVAL 6 HOUR);

-- ==========================================
-- 7. IMÁGENES DE CAPÍTULOS
-- ==========================================
INSERT INTO chapter_images (chapter_id, image_url, order_number) VALUES
(1, 'https://placehold.co/800x1200/1a1a1a/ffffff?text=Pagina+1', 1),
(1, 'https://placehold.co/800x1200/1a1a1a/ffffff?text=Pagina+2', 2),
(1, 'https://placehold.co/800x1200/1a1a1a/ffffff?text=Pagina+3', 3),
(3, 'https://placehold.co/800x1200/1a1a1a/ffffff?text=Pagina+1', 1),
(3, 'https://placehold.co/800x1200/1a1a1a/ffffff?text=Pagina+2', 2),
(7, 'https://placehold.co/800x1200/1a1a1a/ffffff?text=Pagina+1', 1),
(7, 'https://placehold.co/800x1200/1a1a1a/ffffff?text=Pagina+2', 2);

-- ==========================================
-- 8. ESTADÍSTICAS
-- ==========================================
INSERT INTO work_statistics (work_id, total_views, daily_views, weekly_views, monthly_views, rating_average, rating_count, trending_score, views_last_24h, followers_count, favorites_count) VALUES
-- TOP 3: Solo Leveling, Martial Peak, TBATE
(1, 5500000, 120000, 850000, 4800000, 9.94, 125000, 9850.00, 120000, 95000, 88000),
(2, 4200000, 98000, 720000, 3800000, 9.87, 95000, 9200.00, 98000, 72000, 65000),
(3, 3800000, 85000, 680000, 3400000, 9.75, 88000, 8700.00, 85000, 68000, 60000),

-- POPULARES SEMANAL: ORV, WMMAP, Tales of Demons and Gods
(4, 2900000, 72000, 890000, 2600000, 9.65, 78000, 7800.00, 72000, 58000, 52000),
(5, 2400000, 65000, 850000, 2200000, 9.50, 62000, 7200.00, 65000, 48000, 42000),
(6, 3100000, 68000, 820000, 2800000, 9.20, 85000, 7500.00, 68000, 62000, 55000),

-- NUEVAS: Nano Machine, TGMR, VADTD
(7, 180000, 45000, 180000, 180000, 8.50, 12500, 1200.00, 45000, 8200, 6800),
(8, 150000, 38000, 150000, 150000, 8.20, 9800, 1000.00, 38000, 6400, 5200),
(9, 210000, 52000, 210000, 210000, 8.90, 15800, 1500.00, 52000, 9400, 7800),

-- Otras obras (relleno)
(10, 1800000, 48000, 620000, 1700000, 9.10, 62000, 5500.00, 48000, 42000, 36000),
(11, 2200000, 42000, 580000, 2100000, 8.80, 75000, 4200.00, 42000, 52000, 44000),
(12, 1650000, 40000, 550000, 1550000, 9.30, 58000, 6000.00, 40000, 38000, 32000);

-- ==========================================
-- 9. BIBLIOTECA DE USUARIOS
-- ==========================================
INSERT INTO user_library (user_id, work_id, status, rating, notify_new_chapters) VALUES
(3, 1, 'FAVORITE', 10.0, TRUE),
(3, 4, 'FAVORITE', 9.5, TRUE),
(3, 7, 'FOLLOWING', NULL, TRUE),
(3, 2, 'READ_LATER', NULL, FALSE),
(4, 5, 'FAVORITE', 10.0, TRUE),
(4, 9, 'FAVORITE', 9.0, TRUE),
(4, 6, 'FOLLOWING', 8.5, TRUE),
(5, 1, 'FOLLOWING', 9.0, TRUE),
(5, 11, 'COMPLETED', 9.5, FALSE),
(5, 7, 'FAVORITE', 10.0, TRUE),
(5, 12, 'FOLLOWING', NULL, TRUE),
(2, 1, 'FAVORITE', 10.0, TRUE),
(2, 3, 'FAVORITE', 9.0, TRUE);

-- ==========================================
-- 10. HISTORIAL DE LECTURA
-- ==========================================
INSERT INTO reading_history (user_id, work_id, chapter_id, last_page_read, read_at) VALUES
(3, 1, 3, 15, NOW() - INTERVAL 1 HOUR),
(3, 4, 11, 8, NOW() - INTERVAL 3 HOUR),
(3, 7, 17, 20, NOW() - INTERVAL 1 DAY),
(4, 5, 13, 5, NOW() - INTERVAL 2 HOUR),
(4, 9, 21, 18, NOW() - INTERVAL 1 DAY),
(5, 1, 3, 22, NOW() - INTERVAL 30 MINUTE),
(5, 7, 17, 12, NOW() - INTERVAL 4 HOUR),
(5, 12, 27, 10, NOW() - INTERVAL 5 HOUR),
(2, 1, 3, 25, NOW() - INTERVAL 10 MINUTE);

-- ==========================================
-- 11. LOGS DE VISTAS
-- ==========================================
INSERT INTO view_logs (work_id, chapter_id, user_id, ip_address, viewed_at) VALUES
-- Solo Leveling (muchas vistas)
(1, 3, 3, '192.168.1.10', NOW() - INTERVAL 5 MINUTE),
(1, 3, 5, '192.168.1.11', NOW() - INTERVAL 10 MINUTE),
(1, 3, 2, '192.168.1.12', NOW() - INTERVAL 15 MINUTE),
(1, 1, NULL, '192.168.1.13', NOW() - INTERVAL 30 MINUTE),
(1, 3, NULL, '192.168.1.14', NOW() - INTERVAL 1 HOUR),
(1, 3, 3, '192.168.1.15', NOW() - INTERVAL 2 HOUR),
-- Martial Peak
(2, 7, 3, '192.168.1.20', NOW() - INTERVAL 8 MINUTE),
(2, 7, 5, '192.168.1.21', NOW() - INTERVAL 20 MINUTE),
(2, 7, NULL, '192.168.1.22', NOW() - INTERVAL 45 MINUTE),
-- TBATE
(3, 9, NULL, '192.168.1.30', NOW() - INTERVAL 12 MINUTE),
(3, 9, NULL, '192.168.1.31', NOW() - INTERVAL 40 MINUTE),
-- Nuevas (pocas vistas)
(7, 17, NULL, '192.168.1.40', NOW() - INTERVAL 1 HOUR),
(7, 16, NULL, '192.168.1.41', NOW() - INTERVAL 3 HOUR),
(8, 19, NULL, '192.168.1.42', NOW() - INTERVAL 2 HOUR),
(9, 21, 5, '192.168.1.43', NOW() - INTERVAL 30 MINUTE),
(9, 20, NULL, '192.168.1.44', NOW() - INTERVAL 4 HOUR);

-- ==========================================
-- 12. COLA DEL HERO (3 obras nuevas activas)
-- ==========================================
INSERT INTO hero_new_queue (work_id, status, queued_at, activated_at, expires_at) VALUES
(7, 'ACTIVE', NOW() - INTERVAL 20 HOUR, NOW() - INTERVAL 20 HOUR, NOW() + INTERVAL 4 HOUR),
(8, 'ACTIVE', NOW() - INTERVAL 12 HOUR, NOW() - INTERVAL 12 HOUR, NOW() + INTERVAL 12 HOUR),
(9, 'ACTIVE', NOW() - INTERVAL 6 HOUR, NOW() - INTERVAL 6 HOUR, NOW() + INTERVAL 18 HOUR);