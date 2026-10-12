-- ==========================================
-- MOCK DATA: YUMEZONE — DATOS COMPLETOS DE PRUEBA
-- Ejecutar DESPUÉS de crear las tablas con yumezone.sql
-- ==========================================
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE view_logs;
TRUNCATE TABLE reading_history;
TRUNCATE TABLE user_library;
TRUNCATE TABLE work_statistics;
TRUNCATE TABLE chapter_images;
TRUNCATE TABLE chapters;
TRUNCATE TABLE work_tags;
TRUNCATE TABLE work_genres;
-- NO HACEMOS TRUNCATE A works PARA NO PERDER LA OBRA/PORTADA EXISTENTE
TRUNCATE TABLE demographics;
TRUNCATE TABLE formats;
TRUNCATE TABLE statuses;
TRUNCATE TABLE tags;
TRUNCATE TABLE genres;
TRUNCATE TABLE home_chats;
TRUNCATE TABLE home_announcements;
TRUNCATE TABLE hero_new_queue;
TRUNCATE TABLE scan_group_members;
TRUNCATE TABLE scan_groups;
TRUNCATE TABLE reading_settings;
TRUNCATE TABLE platform_settings;
TRUNCATE TABLE notifications;
TRUNCATE TABLE user_daily_missions;
TRUNCATE TABLE user_inventory;
TRUNCATE TABLE shop_items;
TRUNCATE TABLE badges;
DELETE FROM users WHERE id != 1;

SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================
-- 1. USUARIOS
-- ==========================================
INSERT IGNORE INTO users (id, user_code, username, email, password, avatar_url, banner_url, bio, platform_role, status, coins, xp, streak_days) VALUES
(1, '3F1EBC225197C5CB', 'YumeMaster', 'manuel7xs@gmail.com', '$argon2id$v=19$m=65536,t=3,p=4$oqDEHluADePJ1vRyFtXhRg$HLQ0nz8Q/mUt5BBdvQo0We0tkKDmWuKBv6qnPkNoG4k', 'https://s1.cdnlxd.xyz/avatars/gqjoqnqwzqr3z42t_1787169934547.webp?v=1787169934793', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80', 'Administrador principal de YumeZone.', 'SUPERADMIN', 'ACTIVE', 1200, 45000, 14),
(2, 'SCN001', 'GhostMaster', 'ghost@yumezone.com', '$2b$12$hash_fake_ghost', 'https://i.pravatar.cc/150?u=ghost', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80', 'Líder de GhostScans. MOD del chat.', 'SUPERADMIN', 'ACTIVE', 800, 40000, 3),
(3, 'USR001', 'KiritoFan', 'kirito@test.com', '$2b$12$hash_fake_user1', 'https://i.pravatar.cc/150?u=kirito', NULL, 'Fan del cultivo espectral', 'USER', 'ACTIVE', 350, 17000, 7),
(4, 'USR002', 'SakuraChan', 'sakura@test.com', '$2b$12$hash_fake_user2', 'https://i.pravatar.cc/150?u=sakura', NULL, 'Amante del shoujo y la fantasía', 'USER', 'ACTIVE', 200, 12000, 1),
(5, 'USR003', 'OtakuKing', 'otaku@test.com', '$2b$12$hash_fake_user3', 'https://i.pravatar.cc/150?u=otaku', NULL, 'Devoro 100 caps al día', 'USER', 'ACTIVE', 650, 28000, 5);

INSERT IGNORE INTO reading_settings (user_id, reading_mode, zoom_level, brightness, background_color, image_quality) VALUES
(1, 'VERTICAL', 100, 100, 'DARK', 'HIGH'),
(2, 'VERTICAL', 100, 90, 'DARK', 'HIGH'),
(3, 'PAGINATED', 110, 80, 'SEPIA', 'MEDIUM'),
(4, 'VERTICAL', 100, 100, 'DARK', 'HIGH'),
(5, 'PAGINATED', 90, 70, 'BLACK', 'HIGH');

-- ==========================================
-- 2. GRUPOS SCAN
-- ==========================================
INSERT IGNORE INTO scan_groups (id, name, slug, logo_url, banner_url, description, social_links, status) VALUES
(1, 'GhostScans', 'ghostscans', 'https://s1.cdnlxd.xyz/avatars/gqjoqnqwzqr3z42t_1787169934547.webp?v=1787169934793', 'https://placehold.co/1200x400/10b981/ffffff?text=GhostScans', 'Grupo líder en manhuas de cultivo espectral.', '{"discord":"https://discord.gg/ghostscans","web":"https://ghostscans.com"}', 'ACTIVE'),
(2, 'YumeScans', 'yumescans', 'https://placehold.co/200x200/8b5cf6/ffffff?text=YS', 'https://placehold.co/1200x400/8b5cf6/ffffff?text=YumeScans', 'Especialistas en manhwas de acción y romance.', '{"discord":"https://discord.gg/yumescans"}', 'ACTIVE'),
(3, 'DragonTL', 'dragontl', 'https://placehold.co/200x200/ef4444/ffffff?text=DT', 'https://placehold.co/1200x400/ef4444/ffffff?text=DragonTL', 'Traducciones de los mejores mangas shonen.', '{"discord":"https://discord.gg/dragontl"}', 'ACTIVE'),
(4, 'SakuraTeam', 'sakurateam', 'https://placehold.co/200x200/ec4899/ffffff?text=ST', 'https://placehold.co/1200x400/ec4899/ffffff?text=SakuraTeam', 'Enfoque en shoujo y josei.', '{"discord":"https://discord.gg/sakurateam"}', 'ACTIVE'),
(5, 'ShadowTL', 'shadowtl', 'https://placehold.co/200x200/0ea5e9/ffffff?text=SH', 'https://placehold.co/1200x400/0ea5e9/ffffff?text=ShadowTL', 'Traducciones oscuras y de fantasía.', '{"discord":"https://discord.gg/shadowtl"}', 'ACTIVE');

INSERT IGNORE INTO scan_group_members (group_id, user_id, role, permissions) VALUES
(1, 2, 'ADMIN', '{"can_upload":true,"can_edit":true}'),
(1, 3, 'MEMBER', '{"can_upload":false,"can_comment":true}'),
(2, 4, 'ADMIN', '{"can_upload":true,"can_edit":true}'),
(3, 5, 'MEMBER', '{"can_upload":false}');

-- ==========================================
-- 3. CLASIFICACIÓN
-- ==========================================
INSERT IGNORE INTO statuses (id, name) VALUES
(1,'En emisión'),(2,'Finalizado'),(3,'En pausa'),(4,'Cancelado');

INSERT IGNORE INTO formats (id, name) VALUES
(1,'Manga'),(2,'Manhua'),(3,'Manhwa'),(4,'Webtoon');

INSERT IGNORE INTO demographics (id, name) VALUES
(1,'Shonen'),(2,'Seinen'),(3,'Shojo'),(4,'Josei');

INSERT IGNORE INTO genres (id, name) VALUES
(1,'Acción'),(2,'Aventura'),(3,'Fantasía'),(4,'Romance'),
(5,'Comedia'),(6,'Drama'),(7,'Terror'),(8,'Misterio'),
(9,'Cultivo'),(10,'Reencarnación'),(11,'Venganza'),(12,'Sobrenatural'),
(13,'Escolar'),(14,'Isekai'),(15,'Artes Marciales'),
(16,'Apocalíptico'),(17,'Sistema'),(18,'Mazmorras');

INSERT IGNORE INTO tags (id, name) VALUES
(1,'Protagonista Fuerte'),(2,'Sistema'),(3,'Harem'),(4,'Mundo Mágico'),
(5,'Venganza'),(6,'Dragones'),(7,'Dioses'),(8,'Sectas'),
(9,'Cultivo Espectral'),(10,'Reencarnado en otro mundo'),
(11,'OP MC'),(12,'Time Travel'),(13,'Regresión');

-- ==========================================
-- 4. OBRAS (12 obras con imágenes reales)
-- ==========================================
INSERT IGNORE INTO works (id, title, slug, alternative_title, synopsis, author, cover_url, banner_url, status_id, format_id, demographic_id, scan_group_id) VALUES
(1,'Solo Leveling','solo-leveling','Na Honjaman Level Up',
 'En un mundo donde los cazadores luchan contra monstruos que salen de portales, Sung Jin-Woo es conocido como el cazador más débil de rango E. Tras sobrevivir a una mazmorra doble que acaba con casi todo su equipo, despierta con un sistema misterioso que le permite subir de nivel infinitamente como en un videojuego. Ahora tiene la oportunidad de convertirse en el cazador más fuerte de la historia.',
 'Chugong',
 'https://static1.cbrimages.com/wordpress/wp-content/uploads/2024/11/87dff2b5-bd7d-4211-b7f9-d1c668e190dc.jpeg',
 'https://i.pinimg.com/originals/a7/2f/0a/a72f0adb6991d05d8b4d64cdd73727c2.jpg',
 2,3,1,1),

(2,'Martial Peak','martial-peak','Wu Lian Feng Dian',
 'Yang Kai es un discípulo ordinario del Secta High Heaven Pavilion que un día encuentra un libro negro misterioso. Ese libro resulta ser un artefacto legendario que le permite cultivar a un ritmo imposible. Ahora deberá escalar la cima del mundo marcial, enfrentando sectas poderosas, demonios y dioses, mientras descubre la verdad sobre el universo.',
 'Momo',
 'https://i.pinimg.com/736x/34/71/ba/3471ba77970a7fcd02f397ff70a4949f.jpg',
 'https://i.pinimg.com/736x/34/71/ba/3471ba77970a7fcd02f397ff70a4949f.jpg',
 1,2,1,1),

(3,'The Beginning After the End','the-beginning-after-the-end','TBATE',
 'El Rey Grey, un poderoso monarca que dominaba el mundo gracias a su fuerza y conocimiento, muere y renace en un mundo de magia como Arthur Leywin. Con las memorias de su vida pasada, decide esta vez vivir sin arrepentimientos, protegiendo a su familia y entrenándose para enfrentar una amenaza que podría destruir todo lo que ama.',
 'TurtleMe',
 'https://static1.cbrimages.com/wordpress/wp-content/uploads/2025/03/the-beginning-after-the-end-anime-cover-art.jpg',
 'https://static1.cbrimages.com/wordpress/wp-content/uploads/2025/03/the-beginning-after-the-end-anime-cover-art.jpg',
 1,3,1,2),

(4,'Omniscient Reader\'s Viewpoint','omniscient-readers-viewpoint','ORV',
 'Kim Dokja es un oficinista común cuya única pasión es leer la novela web "Tres formas de sobrevivir". Cuando la novela termina, el mundo real se convierte en el escenario de esa historia. Ahora, siendo el único que conoce el final, Dokja deberá usar su conocimiento para sobrevivir al apocalipsis y a los escenarios que se desarrollan a su alrededor.',
 'Sing Shong',
 'https://cdn.mahoureader.com/series/16/posterImage.webp',
 'https://cdn.mahoureader.com/series/16/posterImage.webp',
 1,3,1,2),

(5,'Who Made Me a Princess','who-made-me-a-princess','WMMAP',
 'Athanasia despierta en el cuerpo de la hija del emperador Claude, un hombre temido que en la novela original asesina a su propia hija. Sabiendo que su muerte es inevitable si no cambia el destino, decide ganarse el afecto de su padre para sobrevivir. Pero los sentimientos que empiezan a surgir entre ellos van más allá de lo que esperaba.',
 'Plutus',
 'https://tse1.mm.bing.net/th/id/OIP.lHvoLHmLxalfO3PkE3NDQQHaKX?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
 'https://tse1.mm.bing.net/th/id/OIP.lHvoLHmLxalfO3PkE3NDQQHaKX?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
 2,4,3,4),

(6,'Tales of Demons and Gods','tales-of-demons-and-gods','Yao Shen Ji',
 'Nie Li, el guerrero más fuerte de su era, muere en la batalla final contra los sabios demonios. Renace en su cuerpo de 13 años, cuando era el estudiante más débil de su clase. Con el conocimiento de sus años de experiencia, ahora puede reescribir el destino y salvar a sus seres queridos de la tragedia que se avecina.',
 'Mad Snail',
 'https://cdn.mahoureader.com/series/157/posterImage.jpg',
 'https://cdn.mahoureader.com/series/157/posterImage.jpg',
 1,2,1,3),

(7,'Nano Machine','nano-machine','Nano Mashin',
 'Cheon Yeo-Woon es el príncipe abandonado de la Secta Demoníaca, destinado a morir a manos de sus hermanos. Pero un descendiente del futuro le inyecta nanomáquinas que reparan y mejoran su cuerpo. Ahora, con un poder tecnológico siglos por delante de su era, Cheon Yeo-Woon comenzará su ascenso para reclamar lo que le pertenece.',
 'Hanjungwol',
 'https://tse3.mm.bing.net/th/id/OIP.kkSKWZgrROr7aa3u37N-3AHaKu?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
 'https://tse3.mm.bing.net/th/id/OIP.kkSKWZgrROr7aa3u37N-3AHaKu?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
 1,3,1,5),

(8,'The Great Mage Returns After 4000 Years','the-great-mage-returns-after-4000-years','TGMR',
 'Lucas Traumen, el mago más poderoso de su era, fue traicionado y sellado durante 4000 años. Al despertar, descubre que la magia ha decaído y que el mundo está gobernado por falsos dioses. Ahora, en el cuerpo de un joven noble débil, buscará venganza contra aquellos que lo traicionaron y restaurará el verdadero arte de la magia.',
 'Yeon Sanho',
 'https://greatmageafter4000.com/wp-content/uploads/2025/10/The-Archmage-Returns-After-4000-Years.webp',
 'https://greatmageafter4000.com/wp-content/uploads/2025/10/The-Archmage-Returns-After-4000-Years.webp',
 1,3,1,5),

(9,'Villains Are Destined to Die','villains-are-destined-to-die','VADTD',
 'Penelope Eckhart despierta en el cuerpo de la villana de una novela otome. En el juego, su personaje muere siempre antes del final. Decidida a sobrevivir, Penelope deberá ganar el afecto de los tres hermanos del protagonista y del misterioso príncipe heredero, mientras intenta escapar del destino que le espera.',
 'Gwon Gyeoeul',
 'https://www.normaeditorial.com/upload/media/albumes/0001/37/thumb_36916_albumes_medium.jpeg',
 'https://i.ytimg.com/vi/ujq0-UvdEwA/maxresdefault.jpg',
 1,4,3,4),

(10,'Against the Gods','against-the-gods','Ni Tian Xie Shen',
 'Yun Che, un joven que muere persiguiendo un tesoro legendario, renace en el cuerpo de un muchacho ciego y maltratado en un continente donde la fuerza lo es todo. Con el conocimiento de su vida pasada y la ayuda del misterioso Espejo Celestial, comenzará su camino para desafiar a los cielos y vengar las injusticias cometidas contra él.',
 'Mars Gravity',
 'https://www.mangaread.org/wp-content/uploads/WP-manga/data/manga_5e2144c7bd723/81d01cbc099825a9df9fced36a4d1892/2.jpg',
 'https://www.mangaread.org/wp-content/uploads/WP-manga/data/manga_5e2144c7bd723/81d01cbc099825a9df9fced36a4d1892/2.jpg',
 1,2,1,3),

(11,'Battle Through the Heavens','battle-through-the-heavens','Doupo Cangqiong',
 'Xiao Yan fue un genio de la alquimia y el cultivo hasta que perdió sus poderes a los 12 años. Ahora, siendo el hazmerreír de su clan, recibe la visita del espíritu de Yao Chen, un alquimista legendario atrapado en un anillo. Con su ayuda, Xiao Yan emprenderá un viaje para recuperar su poder y convertirse en el alquimista más fuerte del continente.',
 'Tian Can Tu Dou',
 'https://temp.compsci88.com/cover/fallback/01J76XYBEESPMGZV48J6NHH7NE.jpg',
 'https://temp.compsci88.com/cover/fallback/01J76XYBEESPMGZV48J6NHH7NE.jpg',
 2,2,1,3),

(12,'Overgeared','overgeared','Temppal',
 'Shin Youngwoo es un jugador pobre que dedica su vida a un videojuego de realidad virtual para mantener a su familia. Tras conseguir un objeto legendario por accidente, se transforma en un jugador con un potencial inimaginable. Ahora deberá equilibrar su vida real con su ascenso para convertirse en la leyenda del servidor.',
 'Park Saenal',
 '',
 '',
 1,3,1,2);

-- ==========================================
-- 5. GÉNEROS Y TAGS POR OBRA
-- ==========================================
INSERT IGNORE INTO work_genres (work_id, genre_id) VALUES
(1,1),(1,2),(1,3),(1,12),(1,18),
(2,1),(2,3),(2,9),(2,15),
(3,1),(3,2),(3,3),(3,10),
(4,1),(4,3),(4,8),(4,16),
(5,4),(5,6),(5,3),
(6,1),(6,3),(6,10),(6,15),
(7,1),(7,3),(7,9),(7,15),
(8,1),(8,3),(8,10),(8,17),
(9,4),(9,6),(9,14),
(10,1),(10,3),(10,9),(10,15),
(11,1),(11,3),(11,9),(11,15),
(12,1),(12,2),(12,3),(12,17);

INSERT IGNORE INTO work_tags (work_id, tag_id) VALUES
(1,1),(1,2),(1,11),
(2,1),(2,8),(2,9),
(3,1),(3,10),(3,11),
(4,1),(4,2),(4,13),
(5,4),(5,10),
(6,1),(6,10),(6,12),
(7,1),(7,8),(7,11),
(8,1),(8,11),(8,12),
(9,10),(9,13),
(10,1),(10,8),(10,9),
(11,1),(11,9),(11,8),
(12,1),(12,2),(12,11);

-- ==========================================
-- 6. CAPÍTULOS
-- ==========================================
INSERT IGNORE INTO chapters (id, work_id, scan_group_id, chapter_number, title, slug, status, published_at) VALUES
-- Solo Leveling
(1, 1,1,  1.00,'El Cazador Más Débil','sl-cap-1','PUBLISHED','2023-01-01 10:00:00'),
(2, 1,1,100.00,'El Rey de las Sombras','sl-cap-100','PUBLISHED','2023-06-01 10:00:00'),
(3, 1,1,178.00,'El Último Cazador','sl-cap-178','PUBLISHED',NOW() - INTERVAL 2 HOUR),
(4, 1,1,179.00,'Epílogo: El Nuevo Comienzo','sl-cap-179','SCHEDULED',NOW() + INTERVAL 2 DAY),
-- Martial Peak
(5, 2,1,  1.00,'El Libro Negro','mp-cap-1','PUBLISHED','2022-01-01 10:00:00'),
(6, 2,1,3000.00,'La Cima Marcial','mp-cap-3000','PUBLISHED',NOW() - INTERVAL 1 DAY),
(7, 2,1,3600.00,'El Nuevo Mundo','mp-cap-3600','PUBLISHED',NOW() - INTERVAL 4 HOUR),
-- TBATE
(8, 3,2,  1.00,'El Rey Gris','tbate-cap-1','PUBLISHED','2022-03-15 10:00:00'),
(9, 3,2,175.00,'La Guerra de los Dioses','tbate-cap-175','PUBLISHED',NOW() - INTERVAL 5 HOUR),
-- ORV
(10,4,2,  1.00,'El Escenario Comienza','orv-cap-1','PUBLISHED','2022-05-01 10:00:00'),
(11,4,2,190.00,'El Lector Omnisciente','orv-cap-190','PUBLISHED',NOW() - INTERVAL 12 HOUR),
-- WMMAP
(12,5,4,  1.00,'El Despertar','wmmap-cap-1','PUBLISHED','2022-04-01 10:00:00'),
(13,5,4,120.00,'El Amor del Emperador','wmmap-cap-120','PUBLISHED',NOW() - INTERVAL 3 DAY),
-- Tales of Demons and Gods
(14,6,3,  1.00,'El Renacer de Nie Li','tdg-cap-1','PUBLISHED','2022-06-01 10:00:00'),
(15,6,3,400.00,'La Secta Divina','tdg-cap-400','PUBLISHED',NOW() - INTERVAL 10 HOUR),
-- Nano Machine
(16,7,5,  1.00,'Las Nanomáquinas','nm-cap-1','PUBLISHED','2023-02-01 10:00:00'),
(17,7,5,200.00,'El Príncipe Demonio','nm-cap-200','PUBLISHED',NOW() - INTERVAL 6 HOUR),
-- TGMR
(18,8,5,  1.00,'El Regreso','tgmr-cap-1','PUBLISHED','2023-03-01 10:00:00'),
(19,8,5,150.00,'La Nueva Era','tgmr-cap-150','PUBLISHED',NOW() - INTERVAL 8 HOUR),
-- VADTD
(20,9,4,  1.00,'La Villana Despierta','vadtd-cap-1','PUBLISHED','2023-04-01 10:00:00'),
(21,9,4,130.00,'El Afecto del Príncipe','vadtd-cap-130','PUBLISHED',NOW() - INTERVAL 4 HOUR),
-- Against the Gods
(22,10,3,  1.00,'El Renacer de Yun Che','atg-cap-1','PUBLISHED',NOW() - INTERVAL 20 HOUR),
(23,10,3,2000.00,'La Cima de los Dioses','atg-cap-2000','PUBLISHED',NOW() - INTERVAL 20 HOUR),
-- BTTH
(24,11,3,  1.00,'La Caída del Genio','btth-cap-1','PUBLISHED',NOW() - INTERVAL 12 HOUR),
(25,11,3,500.00,'El Alquimista Legendario','btth-cap-500','PUBLISHED',NOW() - INTERVAL 12 HOUR),
-- Overgeared
(26,12,2,  1.00,'El Objeto Legendario','og-cap-1','PUBLISHED',NOW() - INTERVAL 6 HOUR),
(27,12,2,150.00,'El Rey del Servidor','og-cap-150','PUBLISHED',NOW() - INTERVAL 6 HOUR);

-- ==========================================
-- 7. IMÁGENES DE CAPÍTULOS (suficientes para pruebas)
-- ==========================================
INSERT IGNORE INTO chapter_images (chapter_id, image_url, order_number) VALUES
-- Capítulo 1 de SL: 189 páginas reales
(1, '/assets/solo-leveling/capitulo-1/page_001.jpg', 1),
(1, '/assets/solo-leveling/capitulo-1/page_002.jpg', 2),
(1, '/assets/solo-leveling/capitulo-1/page_003.jpg', 3),
(1, '/assets/solo-leveling/capitulo-1/page_004.jpg', 4),
(1, '/assets/solo-leveling/capitulo-1/page_005.jpg', 5),
(1, '/assets/solo-leveling/capitulo-1/page_006.jpg', 6),
(1, '/assets/solo-leveling/capitulo-1/page_007.jpg', 7),
(1, '/assets/solo-leveling/capitulo-1/page_008.jpg', 8),
(1, '/assets/solo-leveling/capitulo-1/page_009.jpg', 9),
(1, '/assets/solo-leveling/capitulo-1/page_010.jpg', 10),
(1, '/assets/solo-leveling/capitulo-1/page_011.jpg', 11),
(1, '/assets/solo-leveling/capitulo-1/page_012.jpg', 12),
(1, '/assets/solo-leveling/capitulo-1/page_013.jpg', 13),
(1, '/assets/solo-leveling/capitulo-1/page_014.jpg', 14),
(1, '/assets/solo-leveling/capitulo-1/page_015.jpg', 15),
(1, '/assets/solo-leveling/capitulo-1/page_016.jpg', 16),
(1, '/assets/solo-leveling/capitulo-1/page_017.jpg', 17),
(1, '/assets/solo-leveling/capitulo-1/page_018.jpg', 18),
(1, '/assets/solo-leveling/capitulo-1/page_019.jpg', 19),
(1, '/assets/solo-leveling/capitulo-1/page_020.jpg', 20),
(1, '/assets/solo-leveling/capitulo-1/page_021.jpg', 21),
(1, '/assets/solo-leveling/capitulo-1/page_022.jpg', 22),
(1, '/assets/solo-leveling/capitulo-1/page_023.jpg', 23),
(1, '/assets/solo-leveling/capitulo-1/page_024.jpg', 24),
(1, '/assets/solo-leveling/capitulo-1/page_025.jpg', 25),
(1, '/assets/solo-leveling/capitulo-1/page_026.jpg', 26),
(1, '/assets/solo-leveling/capitulo-1/page_027.jpg', 27),
(1, '/assets/solo-leveling/capitulo-1/page_028.jpg', 28),
(1, '/assets/solo-leveling/capitulo-1/page_029.jpg', 29),
(1, '/assets/solo-leveling/capitulo-1/page_030.jpg', 30),
(1, '/assets/solo-leveling/capitulo-1/page_031.jpg', 31),
(1, '/assets/solo-leveling/capitulo-1/page_032.jpg', 32),
(1, '/assets/solo-leveling/capitulo-1/page_033.jpg', 33),
(1, '/assets/solo-leveling/capitulo-1/page_034.jpg', 34),
(1, '/assets/solo-leveling/capitulo-1/page_035.jpg', 35),
(1, '/assets/solo-leveling/capitulo-1/page_036.jpg', 36),
(1, '/assets/solo-leveling/capitulo-1/page_037.jpg', 37),
(1, '/assets/solo-leveling/capitulo-1/page_038.jpg', 38),
(1, '/assets/solo-leveling/capitulo-1/page_039.jpg', 39),
(1, '/assets/solo-leveling/capitulo-1/page_040.jpg', 40),
(1, '/assets/solo-leveling/capitulo-1/page_041.jpg', 41),
(1, '/assets/solo-leveling/capitulo-1/page_042.jpg', 42),
(1, '/assets/solo-leveling/capitulo-1/page_043.jpg', 43),
(1, '/assets/solo-leveling/capitulo-1/page_044.jpg', 44),
(1, '/assets/solo-leveling/capitulo-1/page_045.jpg', 45),
(1, '/assets/solo-leveling/capitulo-1/page_046.jpg', 46),
(1, '/assets/solo-leveling/capitulo-1/page_047.jpg', 47),
(1, '/assets/solo-leveling/capitulo-1/page_048.jpg', 48),
(1, '/assets/solo-leveling/capitulo-1/page_049.jpg', 49),
(1, '/assets/solo-leveling/capitulo-1/page_050.jpg', 50),
(1, '/assets/solo-leveling/capitulo-1/page_051.jpg', 51),
(1, '/assets/solo-leveling/capitulo-1/page_052.jpg', 52),
(1, '/assets/solo-leveling/capitulo-1/page_053.jpg', 53),
(1, '/assets/solo-leveling/capitulo-1/page_054.jpg', 54),
(1, '/assets/solo-leveling/capitulo-1/page_055.jpg', 55),
(1, '/assets/solo-leveling/capitulo-1/page_056.jpg', 56),
(1, '/assets/solo-leveling/capitulo-1/page_057.jpg', 57),
(1, '/assets/solo-leveling/capitulo-1/page_058.jpg', 58),
(1, '/assets/solo-leveling/capitulo-1/page_059.jpg', 59),
(1, '/assets/solo-leveling/capitulo-1/page_060.jpg', 60),
(1, '/assets/solo-leveling/capitulo-1/page_061.jpg', 61),
(1, '/assets/solo-leveling/capitulo-1/page_062.jpg', 62),
(1, '/assets/solo-leveling/capitulo-1/page_063.jpg', 63),
(1, '/assets/solo-leveling/capitulo-1/page_064.jpg', 64),
(1, '/assets/solo-leveling/capitulo-1/page_065.jpg', 65),
(1, '/assets/solo-leveling/capitulo-1/page_066.jpg', 66),
(1, '/assets/solo-leveling/capitulo-1/page_067.jpg', 67),
(1, '/assets/solo-leveling/capitulo-1/page_068.jpg', 68),
(1, '/assets/solo-leveling/capitulo-1/page_069.jpg', 69),
(1, '/assets/solo-leveling/capitulo-1/page_070.jpg', 70),
(1, '/assets/solo-leveling/capitulo-1/page_071.jpg', 71),
(1, '/assets/solo-leveling/capitulo-1/page_072.jpg', 72),
(1, '/assets/solo-leveling/capitulo-1/page_073.jpg', 73),
(1, '/assets/solo-leveling/capitulo-1/page_074.jpg', 74),
(1, '/assets/solo-leveling/capitulo-1/page_075.jpg', 75),
(1, '/assets/solo-leveling/capitulo-1/page_076.jpg', 76),
(1, '/assets/solo-leveling/capitulo-1/page_077.jpg', 77),
(1, '/assets/solo-leveling/capitulo-1/page_078.jpg', 78),
(1, '/assets/solo-leveling/capitulo-1/page_079.jpg', 79),
(1, '/assets/solo-leveling/capitulo-1/page_080.jpg', 80),
(1, '/assets/solo-leveling/capitulo-1/page_081.jpg', 81),
(1, '/assets/solo-leveling/capitulo-1/page_082.jpg', 82),
(1, '/assets/solo-leveling/capitulo-1/page_083.jpg', 83),
(1, '/assets/solo-leveling/capitulo-1/page_084.jpg', 84),
(1, '/assets/solo-leveling/capitulo-1/page_085.jpg', 85),
(1, '/assets/solo-leveling/capitulo-1/page_086.jpg', 86),
(1, '/assets/solo-leveling/capitulo-1/page_087.jpg', 87),
(1, '/assets/solo-leveling/capitulo-1/page_088.jpg', 88),
(1, '/assets/solo-leveling/capitulo-1/page_089.jpg', 89),
(1, '/assets/solo-leveling/capitulo-1/page_090.jpg', 90),
(1, '/assets/solo-leveling/capitulo-1/page_091.jpg', 91),
(1, '/assets/solo-leveling/capitulo-1/page_092.jpg', 92),
(1, '/assets/solo-leveling/capitulo-1/page_093.jpg', 93),
(1, '/assets/solo-leveling/capitulo-1/page_094.jpg', 94),
(1, '/assets/solo-leveling/capitulo-1/page_095.jpg', 95),
(1, '/assets/solo-leveling/capitulo-1/page_096.jpg', 96),
(1, '/assets/solo-leveling/capitulo-1/page_097.jpg', 97),
(1, '/assets/solo-leveling/capitulo-1/page_098.jpg', 98),
(1, '/assets/solo-leveling/capitulo-1/page_099.jpg', 99),
(1, '/assets/solo-leveling/capitulo-1/page_100.jpg', 100),
(1, '/assets/solo-leveling/capitulo-1/page_101.jpg', 101),
(1, '/assets/solo-leveling/capitulo-1/page_102.jpg', 102),
(1, '/assets/solo-leveling/capitulo-1/page_103.jpg', 103),
(1, '/assets/solo-leveling/capitulo-1/page_104.jpg', 104),
(1, '/assets/solo-leveling/capitulo-1/page_105.jpg', 105),
(1, '/assets/solo-leveling/capitulo-1/page_106.jpg', 106),
(1, '/assets/solo-leveling/capitulo-1/page_107.jpg', 107),
(1, '/assets/solo-leveling/capitulo-1/page_108.jpg', 108),
(1, '/assets/solo-leveling/capitulo-1/page_109.jpg', 109),
(1, '/assets/solo-leveling/capitulo-1/page_110.jpg', 110),
(1, '/assets/solo-leveling/capitulo-1/page_111.jpg', 111),
(1, '/assets/solo-leveling/capitulo-1/page_112.jpg', 112),
(1, '/assets/solo-leveling/capitulo-1/page_113.jpg', 113),
(1, '/assets/solo-leveling/capitulo-1/page_114.jpg', 114),
(1, '/assets/solo-leveling/capitulo-1/page_115.jpg', 115),
(1, '/assets/solo-leveling/capitulo-1/page_116.jpg', 116),
(1, '/assets/solo-leveling/capitulo-1/page_117.jpg', 117),
(1, '/assets/solo-leveling/capitulo-1/page_118.jpg', 118),
(1, '/assets/solo-leveling/capitulo-1/page_119.jpg', 119),
(1, '/assets/solo-leveling/capitulo-1/page_120.jpg', 120),
(1, '/assets/solo-leveling/capitulo-1/page_121.jpg', 121),
(1, '/assets/solo-leveling/capitulo-1/page_122.jpg', 122),
(1, '/assets/solo-leveling/capitulo-1/page_123.jpg', 123),
(1, '/assets/solo-leveling/capitulo-1/page_124.jpg', 124),
(1, '/assets/solo-leveling/capitulo-1/page_125.jpg', 125),
(1, '/assets/solo-leveling/capitulo-1/page_126.jpg', 126),
(1, '/assets/solo-leveling/capitulo-1/page_127.jpg', 127),
(1, '/assets/solo-leveling/capitulo-1/page_128.jpg', 128),
(1, '/assets/solo-leveling/capitulo-1/page_129.jpg', 129),
(1, '/assets/solo-leveling/capitulo-1/page_130.jpg', 130),
(1, '/assets/solo-leveling/capitulo-1/page_131.jpg', 131),
(1, '/assets/solo-leveling/capitulo-1/page_132.jpg', 132),
(1, '/assets/solo-leveling/capitulo-1/page_133.jpg', 133),
(1, '/assets/solo-leveling/capitulo-1/page_134.jpg', 134),
(1, '/assets/solo-leveling/capitulo-1/page_135.jpg', 135),
(1, '/assets/solo-leveling/capitulo-1/page_136.jpg', 136),
(1, '/assets/solo-leveling/capitulo-1/page_137.jpg', 137),
(1, '/assets/solo-leveling/capitulo-1/page_138.jpg', 138),
(1, '/assets/solo-leveling/capitulo-1/page_139.jpg', 139),
(1, '/assets/solo-leveling/capitulo-1/page_140.jpg', 140),
(1, '/assets/solo-leveling/capitulo-1/page_141.jpg', 141),
(1, '/assets/solo-leveling/capitulo-1/page_142.jpg', 142),
(1, '/assets/solo-leveling/capitulo-1/page_143.jpg', 143),
(1, '/assets/solo-leveling/capitulo-1/page_144.jpg', 144),
(1, '/assets/solo-leveling/capitulo-1/page_145.jpg', 145),
(1, '/assets/solo-leveling/capitulo-1/page_146.jpg', 146),
(1, '/assets/solo-leveling/capitulo-1/page_147.jpg', 147),
(1, '/assets/solo-leveling/capitulo-1/page_148.jpg', 148),
(1, '/assets/solo-leveling/capitulo-1/page_149.jpg', 149),
(1, '/assets/solo-leveling/capitulo-1/page_150.jpg', 150),
(1, '/assets/solo-leveling/capitulo-1/page_151.jpg', 151),
(1, '/assets/solo-leveling/capitulo-1/page_152.jpg', 152),
(1, '/assets/solo-leveling/capitulo-1/page_153.jpg', 153),
(1, '/assets/solo-leveling/capitulo-1/page_154.jpg', 154),
(1, '/assets/solo-leveling/capitulo-1/page_155.jpg', 155),
(1, '/assets/solo-leveling/capitulo-1/page_156.jpg', 156),
(1, '/assets/solo-leveling/capitulo-1/page_157.jpg', 157),
(1, '/assets/solo-leveling/capitulo-1/page_158.jpg', 158),
(1, '/assets/solo-leveling/capitulo-1/page_159.jpg', 159),
(1, '/assets/solo-leveling/capitulo-1/page_160.jpg', 160),
(1, '/assets/solo-leveling/capitulo-1/page_161.jpg', 161),
(1, '/assets/solo-leveling/capitulo-1/page_162.jpg', 162),
(1, '/assets/solo-leveling/capitulo-1/page_163.jpg', 163),
(1, '/assets/solo-leveling/capitulo-1/page_164.jpg', 164),
(1, '/assets/solo-leveling/capitulo-1/page_165.jpg', 165),
(1, '/assets/solo-leveling/capitulo-1/page_166.jpg', 166),
(1, '/assets/solo-leveling/capitulo-1/page_167.jpg', 167),
(1, '/assets/solo-leveling/capitulo-1/page_168.jpg', 168),
(1, '/assets/solo-leveling/capitulo-1/page_169.jpg', 169),
(1, '/assets/solo-leveling/capitulo-1/page_170.jpg', 170),
(1, '/assets/solo-leveling/capitulo-1/page_171.jpg', 171),
(1, '/assets/solo-leveling/capitulo-1/page_172.jpg', 172),
(1, '/assets/solo-leveling/capitulo-1/page_173.jpg', 173),
(1, '/assets/solo-leveling/capitulo-1/page_174.jpg', 174),
(1, '/assets/solo-leveling/capitulo-1/page_175.jpg', 175),
(1, '/assets/solo-leveling/capitulo-1/page_176.jpg', 176),
(1, '/assets/solo-leveling/capitulo-1/page_177.jpg', 177),
(1, '/assets/solo-leveling/capitulo-1/page_178.jpg', 178),
(1, '/assets/solo-leveling/capitulo-1/page_179.jpg', 179),
(1, '/assets/solo-leveling/capitulo-1/page_180.jpg', 180),
(1, '/assets/solo-leveling/capitulo-1/page_181.jpg', 181),
(1, '/assets/solo-leveling/capitulo-1/page_182.jpg', 182),
(1, '/assets/solo-leveling/capitulo-1/page_183.jpg', 183),
(1, '/assets/solo-leveling/capitulo-1/page_184.jpg', 184),
(1, '/assets/solo-leveling/capitulo-1/page_185.jpg', 185),
(1, '/assets/solo-leveling/capitulo-1/page_186.jpg', 186),
(1, '/assets/solo-leveling/capitulo-1/page_187.jpg', 187),
(1, '/assets/solo-leveling/capitulo-1/page_188.jpg', 188),
(1, '/assets/solo-leveling/capitulo-1/page_189.jpg', 189),
-- Cap 178 SL: 18 páginas
(3,'',1),
(3,'',2),
(3,'',3),
(3,'',4),
(3,'',5),
(3,'',6),
(3,'',7),
(3,'',8),
(3,'',9),
(3,'',10),
(3,'',11),
(3,'',12),
(3,'',13),
(3,'',14),
(3,'',15),
(3,'',16),
(3,'',17),
(3,'',18),
-- Martial Peak cap 3600: 16 páginas
(7,'',1),
(7,'',2),
(7,'',3),
(7,'',4),
(7,'',5),
(7,'',6),
(7,'',7),
(7,'',8),
(7,'',9),
(7,'',10),
(7,'',11),
(7,'',12),
(7,'',13),
(7,'',14),
(7,'',15),
(7,'',16),
-- TBATE cap 175: 14 páginas
(9,'',1),
(9,'',2),
(9,'',3),
(9,'',4),
(9,'',5),
(9,'',6),
(9,'',7),
(9,'',8),
(9,'',9),
(9,'',10),
(9,'',11),
(9,'',12),
(9,'',13),
(9,'',14),
-- ORV cap 190: 15 páginas
(11,'',1),
(11,'',2),
(11,'',3),
(11,'',4),
(11,'',5),
(11,'',6),
(11,'',7),
(11,'',8),
(11,'',9),
(11,'',10),
(11,'',11),
(11,'',12),
(11,'',13),
(11,'',14),
(11,'',15),
-- Nano Machine cap 200
(17,'',1),
(17,'',2),
(17,'',3),
(17,'',4),
(17,'',5),
(17,'',6),
(17,'',7),
(17,'',8),
(17,'',9),
(17,'',10),
(17,'',11),
(17,'',12);

-- ==========================================
-- 8. ESTADÍSTICAS
-- ==========================================
INSERT IGNORE INTO work_statistics (work_id, total_views, daily_views, weekly_views, monthly_views, rating_average, rating_count, trending_score, views_last_24h, followers_count, favorites_count, last_published_at, latest_chapter_id, latest_chapter_number, first_chapter_id) VALUES
(1, 5500000,120000, 850000,4800000, 9.94,125000, 9850.00,120000, 95000,88000, NOW() - INTERVAL 2 HOUR, 3, 178.00, 1),
(2, 4200000, 98000, 720000,3800000, 9.87, 95000, 9200.00, 98000, 72000,65000, NOW() - INTERVAL 4 HOUR, 7, 3600.00, 5),
(3, 3800000, 85000, 680000,3400000, 9.75, 88000, 8700.00, 85000, 68000,60000, NOW() - INTERVAL 5 HOUR, 9, 175.00, 8),
(4, 2900000, 72000, 890000,2600000, 9.65, 78000, 7800.00, 72000, 58000,52000, NOW() - INTERVAL 12 HOUR, 11, 190.00, 10),
(5, 2400000, 65000, 850000,2200000, 9.50, 62000, 7200.00, 65000, 48000,42000, NOW() - INTERVAL 3 DAY, 13, 120.00, 12),
(6, 3100000, 68000, 820000,2800000, 9.20, 85000, 7500.00, 68000, 62000,55000, NOW() - INTERVAL 10 HOUR, 15, 400.00, 14),
(7,  180000, 45000, 180000, 180000, 8.50, 12500, 1200.00, 45000,  8200, 6800, NOW() - INTERVAL 6 HOUR, 17, 200.00, 16),
(8,  150000, 38000, 150000, 150000, 8.20,  9800, 1000.00, 38000,  6400, 5200, NOW() - INTERVAL 8 HOUR, 19, 150.00, 18),
(9,  210000, 52000, 210000, 210000, 8.90, 15800, 1500.00, 52000,  9400, 7800, NOW() - INTERVAL 4 HOUR, 21, 130.00, 20),
(10,1800000, 48000, 620000,1700000, 9.10, 62000, 5500.00, 48000, 42000,36000, NOW() - INTERVAL 20 HOUR, 23, 2000.00, 22),
(11,2200000, 42000, 580000,2100000, 8.80, 75000, 4200.00, 42000, 52000,44000, NOW() - INTERVAL 12 HOUR, 25, 500.00, 24),
(12,1650000, 40000, 550000,1550000, 9.30, 58000, 6000.00, 40000, 38000,32000, NOW() - INTERVAL 6 HOUR, 27, 150.00, 26);

-- ==========================================
-- 9. BIBLIOTECA DE USUARIOS
-- ==========================================
INSERT IGNORE INTO user_library (user_id, work_id, status, rating, notify_new_chapters) VALUES
(1,1,'FAVORITE',10.0,TRUE),
(1,3,'FOLLOWING',NULL,TRUE),
(1,7,'FAVORITE',9.5,TRUE),
(2,1,'FAVORITE',10.0,TRUE),(2,3,'FAVORITE',9.0,TRUE),
(3,1,'FAVORITE',10.0,TRUE),(3,4,'FAVORITE',9.5,TRUE),(3,7,'FOLLOWING',NULL,TRUE),(3,2,'READ_LATER',NULL,FALSE),
(4,5,'FAVORITE',10.0,TRUE),(4,9,'FAVORITE',9.0,TRUE),(4,6,'FOLLOWING',8.5,TRUE),
(5,1,'FOLLOWING',9.0,TRUE),(5,11,'COMPLETED',9.5,FALSE),(5,7,'FAVORITE',10.0,TRUE),(5,12,'FOLLOWING',NULL,TRUE);

-- ==========================================
-- 10. HISTORIAL DE LECTURA
-- ==========================================
INSERT IGNORE INTO reading_history (user_id, work_id, chapter_id, last_page_read, read_at) VALUES
-- Usuario 1 (YumeMaster): 3 lecturas activas
(1,1,3,10,NOW() - INTERVAL 1 HOUR),
(1,2,7, 8,NOW() - INTERVAL 2 HOUR),
(1,3,9, 5,NOW() - INTERVAL 4 HOUR),
-- Otros usuarios
(2,1,3,25,NOW() - INTERVAL 10 MINUTE),
(3,1,3,15,NOW() - INTERVAL 1 HOUR),(3,4,11,8,NOW() - INTERVAL 3 HOUR),(3,7,17,20,NOW() - INTERVAL 1 DAY),
(4,5,13,5,NOW() - INTERVAL 2 HOUR),(4,9,21,18,NOW() - INTERVAL 1 DAY),
(5,1,3,22,NOW() - INTERVAL 30 MINUTE),(5,7,17,12,NOW() - INTERVAL 4 HOUR),(5,12,27,10,NOW() - INTERVAL 5 HOUR);

-- ==========================================
-- 11. LOGS DE VISTAS
-- ==========================================
INSERT IGNORE INTO view_logs (work_id, chapter_id, user_id, ip_address, viewed_at) VALUES
(1,3,3,'192.168.1.10',NOW() - INTERVAL 5 MINUTE),
(1,3,5,'192.168.1.11',NOW() - INTERVAL 10 MINUTE),
(1,3,2,'192.168.1.12',NOW() - INTERVAL 15 MINUTE),
(1,1,NULL,'192.168.1.13',NOW() - INTERVAL 30 MINUTE),
(1,3,NULL,'192.168.1.14',NOW() - INTERVAL 1 HOUR),
(2,7,3,'192.168.1.20',NOW() - INTERVAL 8 MINUTE),
(2,7,5,'192.168.1.21',NOW() - INTERVAL 20 MINUTE),
(3,9,NULL,'192.168.1.30',NOW() - INTERVAL 12 MINUTE),
(7,17,NULL,'192.168.1.40',NOW() - INTERVAL 1 HOUR),
(8,19,NULL,'192.168.1.42',NOW() - INTERVAL 2 HOUR),
(9,21,5,'192.168.1.43',NOW() - INTERVAL 30 MINUTE);

-- ==========================================
-- 12. HERO QUEUE
-- ==========================================
INSERT IGNORE INTO hero_new_queue (work_id, status, queued_at, activated_at, expires_at) VALUES
(7,'ACTIVE',NOW() - INTERVAL 20 HOUR,NOW() - INTERVAL 20 HOUR,NOW() + INTERVAL 30 DAY),
(8,'ACTIVE',NOW() - INTERVAL 12 HOUR,NOW() - INTERVAL 12 HOUR,NOW() + INTERVAL 30 DAY),
(9,'ACTIVE',NOW() - INTERVAL 6 HOUR, NOW() - INTERVAL 6 HOUR, NOW() + INTERVAL 30 DAY);

-- ==========================================
-- 13. CHAT Y ANUNCIOS
-- ==========================================
INSERT IGNORE INTO home_chats (user_id, content) VALUES
(2,'📌 Recordatorio: los spoilers de novelas van exclusivamente en #spoilers con tags activados.'),
(2,'¡Nuevo cap de Solo Leveling disponible! Cap 178 está brutal 🔥'),
(3,'Alguien más vio el cap 175 de TBATE? La batalla final estuvo épica'),
(4,'¿Cuándo suben el cap 3600 de Martial Peak completo?'),
(5,'Ya está disponible en GhostScans, revisen la sección de lanzamientos'),
(1,'Gracias a todos por su apoyo. Yumezone sigue creciendo 🙏');

INSERT IGNORE INTO home_announcements (type, type_label, source, title, description) VALUES
('sistema','Sistema','DevTeam','Servidores CDN 4K activados','Se ha desplegado la infraestructura a CDN de latencia ultra baja para lectura sin búfer en resoluciones de 4K. La velocidad de carga de imágenes mejoró un 60%.'),
('sistema','Sistema','DevTeam','Mantenimiento programado','El próximo sábado de 2am a 4am realizaremos mantenimiento preventivo. Los servicios podrían estar intermitentes.'),
('evento','Evento','GhostFest','Doble XP & Llaves esta semana','Completa 3 capítulos diarios para desbloquear recompensas exclusivas, marcos de perfil y llaves de acceso anticipado al próximo gran evento.'),
('evento','Evento','YumeZone','Concurso de Fan Art','Participa en nuestro concurso de fan art. Las 3 mejores obras ganarán 1 mes de acceso premium y merchandise exclusivo.'),
('scan','Scans','GhostScans','Convocatoria para traductores','Buscamos traductores de coreano y chino con pago por capítulo. Experiencia en manhua de cultivo requerida.'),
('scan','Scans','YumeScans','Proyecto nuevo: Tower of God','YumeScans anuncia la traducción oficial de Tower of God. Primer capítulo disponible el próximo lunes.');

-- ==========================================
-- 14. NOTIFICACIONES
-- ==========================================
INSERT IGNORE INTO notifications (user_id, type, payload, read_at) VALUES
(1, 'system', '{"title": "¡Bienvenido a YumeZone! Explora las mejores obras y mantén tu racha diaria activa."}', NULL),
(1, 'chapter', '{"title": "Nuevo capítulo disponible: Solo Leveling Cap. 1 ya está listo para leer."}', NULL),
(1, 'system', '{"title": "Tu cuenta ha sido verificada exitosamente como SuperAdmin."}', NOW() - INTERVAL 1 DAY);

-- ==========================================
-- 15. MEDALLAS (BADGES)
-- ==========================================
INSERT IGNORE INTO badges (id, name, tier, icon, description, condition_type, condition_value, sort_order) VALUES
('chapters_1', 'Primer Paso', 'Bronce', 'book', 'Leer tu primer capítulo en la plataforma YumeZone', 'chapters', 1, 1),
('streak_3d', 'Constancia Diaria', 'Bronce', 'fire', 'Mantener una racha activa de lectura de al menos 3 días', 'streak', 3, 2),
('streak_7d', 'Fuego Semanal', 'Plata', 'fire', 'Leer diariamente durante 7 días continuos', 'streak', 7, 3),
('chapters_25', 'Lector Dedicado', 'Plata', 'book', 'Completar la lectura de al menos 25 capítulos', 'chapters', 25, 4),
('chapters_100', 'Devorador de Capítulos', 'Oro', 'book', 'Superar los 100 capítulos leídos en YumeZone', 'chapters', 100, 5),
('library_5', 'Coleccionista', 'Jade', 'library', 'Guardar al menos 5 obras en tu biblioteca personal', 'following', 5, 6),
('critic', 'Voz Activa', 'Azul', 'comment', 'Participar con al menos 3 comentarios en la comunidad', 'comments', 3, 7),
('verified', 'Insignia Oficial Staff / Scan', 'Especial', 'verified', 'Verificación reservada a Staff oficial o miembros de Scan groups', 'staff_scan', 1, 8);

-- ==========================================
-- 16. TIENDA DE ARTÍCULOS (SHOP_ITEMS)
-- ==========================================
INSERT IGNORE INTO shop_items (id, category, name, description, price_coins, preview_url, required_level, rarity) VALUES
(1, 'BANNER', 'Abismo Cósmico', 'Nebulosa verde espectral con rocas astrales suspendidas en el vacío cósmico.', 150, 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1600&q=80', 1, 'RARE'),
(2, 'BANNER', 'Sombra del Monarca', 'Fuego espectral púrpura y un ejército de sombras emergiendo de la oscuridad.', 300, 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80', 3, 'EPIC'),
(3, 'BANNER', 'Cyberpunk Neo-Tokyo', 'Lluvia de neón turquesa y rascacielos futuristas bajo un cielo distópico.', 250, 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1600&q=80', 2, 'RARE'),
(4, 'BANNER', 'Santuario Celestial', 'Templo milenario flotando entre nubes doradas al amanecer del cultivo.', 450, 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1600&q=80', 5, 'EPIC'),
(5, 'BANNER', 'Infierno Carmesí', 'Tierras volcánicas con dragones de fuego y cenizas en llamas vivas.', 600, 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?auto=format&fit=crop&w=1600&q=80', 8, 'LEGENDARY'),
(6, 'BANNER', 'Bosque de los Espíritus', 'Cerezos nocturnos iluminados por la luna llena y linternas ancestrales.', 200, 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1600&q=80', 1, 'RARE'),
(7, 'BANNER', 'Horizonte Synthwave', 'Sol retro ochentoso y cuadrícula láser en el horizonte digital.', 350, 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1600&q=80', 4, 'EPIC'),
(8, 'BANNER', 'Trono del Soberano Cósmico', 'Obsidiana dorada y runas arcanas celestiales de máxima jerarquía.', 800, 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80', 10, 'LEGENDARY'),
(9, 'FRAME', 'Marco Éter Dorado', 'Marco ornamentado con destellos dorados que engalana tu avatar.', 350, '/assets/images/shop/frame-golden.svg', 2, 'EPIC'),
(10, 'FRAME', 'Aura Neón Cyberpunk', 'Anillo cibernético violeta y cian de alta frecuencia.', 400, '/assets/images/shop/frame-neon.svg', 2, 'EPIC'),
(11, 'FRAME', 'Corona Astral', 'Marco cósmico forjado con fragmentos de nebulosa.', 750, '/assets/images/shop/frame-astral.svg', 3, 'LEGENDARY'),
(12, 'BADGE', 'Insignia Devorador de Manhwas', 'Emblema otorgado a los lectores más insaciables de la comunidad.', 200, '/assets/images/shop/badge-manhwa.svg', 1, 'RARE'),
(13, 'BADGE', 'Medalla Cazador Rango S', 'Condecoración mítica para los maestros de la lectura extrema.', 850, '/assets/images/shop/badge-rank-s.svg', 3, 'LEGENDARY'),
(14, 'TITLE', 'Título: Erudito del Abismo', 'Concede el título honorífico de erudito en tu tarjeta de usuario.', 180, '/assets/images/shop/title-erudite.svg', 1, 'RARE'),
(15, 'TITLE', 'Título: Monarca de las Sombras', 'Título supremo para quien domina los rankings de lectura.', 900, '/assets/images/shop/title-monarch.svg', 4, 'LEGENDARY'),
(16, 'CONSUMABLE', 'Poción de Doble XP (24h)', 'Duplica la experiencia de lectura obtenida durante un día entero.', 120, '/assets/images/shop/potion-double-xp.svg', 1, 'RARE'),
(17, 'CONSUMABLE', 'Ticket VIP de Scanlation', 'Pase especial canjeable para desbloquear capítulos con acceso previo.', 250, '/assets/images/shop/ticket-vip.svg', 1, 'EPIC');

-- ==========================================
-- 17. INVENTARIO DE USUARIOS (USER_INVENTORY)
-- ==========================================
INSERT IGNORE INTO user_inventory (user_id, item_id, is_equipped) VALUES
(1, 1, FALSE),
(1, 2, FALSE),
(1, 8, TRUE),
(1, 11, TRUE),
(2, 2, TRUE),
(2, 9, TRUE),
(3, 1, TRUE),
(3, 14, TRUE),
(4, 6, TRUE),
(5, 7, TRUE);


