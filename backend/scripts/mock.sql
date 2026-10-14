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
INSERT IGNORE INTO users (id, user_code, username, email, password, avatar_url, banner_url, anillo_url, bio, platform_role, status, coins, xp, streak_days) VALUES
(1, '3F1EBC225197C5CB', 'YumeMaster', 'manuel7xs@gmail.com', '$argon2id$v=19$m=65536,t=3,p=4$oqDEHluADePJ1vRyFtXhRg$HLQ0nz8Q/mUt5BBdvQo0We0tkKDmWuKBv6qnPkNoG4k', 'https://s1.cdnlxd.xyz/avatars/gqjoqnqwzqr3z42t_1787169934547.webp?v=1787169934793', '/assets/images/shop/banner1.gif', '/assets/images/shop/anillo1.gif', 'Administrador principal de YumeZone.', 'SUPERADMIN', 'ACTIVE', 3000, 45000, 14),
(2, 'SCN001', 'GhostMaster', 'ghost@yumezone.com', '$2b$12$hash_fake_ghost', 'https://i.pravatar.cc/150?u=ghost', '/assets/images/shop/banner2.gif', '/assets/images/shop/anillo2.gif', 'Líder de GhostScans. MOD del chat.', 'SUPERADMIN', 'ACTIVE', 800, 40000, 3),
(3, 'USR001', 'KiritoFan', 'kirito@test.com', '$2b$12$hash_fake_user1', 'https://i.pravatar.cc/150?u=kirito', NULL, NULL, 'Fan del cultivo espectral', 'USER', 'ACTIVE', 350, 17000, 7),
(4, 'USR002', 'SakuraChan', 'sakura@test.com', '$2b$12$hash_fake_user2', 'https://i.pravatar.cc/150?u=sakura', NULL, NULL, 'Amante del shoujo y la fantasía', 'USER', 'ACTIVE', 200, 12000, 1),
(5, 'USR003', 'OtakuKing', 'otaku@test.com', '$2b$12$hash_fake_user3', 'https://i.pravatar.cc/150?u=otaku', NULL, NULL, 'Devoro 100 caps al día', 'USER', 'ACTIVE', 650, 28000, 5);

INSERT IGNORE INTO reading_settings (user_id, zoom_level, brightness, background_color) VALUES
(1, 100, 100, 'DARK'),
(2, 100, 90, 'DARK'),
(3, 110, 80, 'SEPIA'),
(4, 100, 100, 'DARK'),
(5, 90, 70, 'BLACK');

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
 '/assets/comic/manhua/solo-leveling/portada/portada.jpeg',
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
-- Solo Leveling (Capítulos reales organizados)
(28, 1,1,  0.00,'Prólogo','sl-cap-0','PUBLISHED','2023-01-01 09:00:00'),
(1,  1,1,  1.00,'El Cazador Más Débil','sl-cap-1','PUBLISHED','2023-01-01 10:00:00'),
(2,  1,1,  2.00,'La Doble Mazmorra','sl-cap-2','PUBLISHED','2023-01-08 10:00:00'),
(3,  1,1,  3.00,'La Estatua de Dios','sl-cap-3','PUBLISHED','2023-01-15 10:00:00'),
(4,  1,1,  4.00,'Prueba de Valor','sl-cap-4','PUBLISHED','2023-01-22 10:00:00'),
(29, 1,1,  5.00,'Misiones Diarias','sl-cap-5','PUBLISHED','2023-01-29 10:00:00'),
(30, 1,1,  6.00,'Mazmorra Instantánea','sl-cap-6','PUBLISHED','2023-02-05 10:00:00'),
(31, 1,1,  7.00,'El Asesino del Pantano','sl-cap-7','PUBLISHED','2023-02-12 10:00:00'),
(32, 1,1,  8.00,'El Escuadrón C','sl-cap-8','PUBLISHED','2023-02-19 10:00:00'),
(33, 1,1,  9.00,'El Ejército de las Sombras','sl-cap-9','PUBLISHED',NOW() - INTERVAL 2 HOUR),
(34, 1,1, 10.00,'La Puerta Roja','sl-cap-10','SCHEDULED',NOW() + INTERVAL 2 DAY),
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
-- Capítulo 0 (Prólogo) de SL: 22 páginas reales
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_001.jpg', 1),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_002.jpg', 2),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_003.jpg', 3),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_004.jpg', 4),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_005.jpg', 5),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_006.jpg', 6),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_007.jpg', 7),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_008.jpg', 8),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_009.jpg', 9),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_010.jpg', 10),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_011.jpg', 11),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_012.jpg', 12),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_013.jpg', 13),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_014.jpg', 14),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_015.jpg', 15),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_016.jpg', 16),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_017.jpg', 17),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_018.jpg', 18),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_019.jpg', 19),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_020.jpg', 20),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_021.jpg', 21),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_022.jpg', 22),
-- Capítulo 1 de SL: 25 páginas reales
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_001.jpg', 1),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_002.jpg', 2),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_003.jpg', 3),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_004.jpg', 4),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_005.jpg', 5),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_006.jpg', 6),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_007.jpg', 7),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_008.jpg', 8),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_009.jpg', 9),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_010.jpg', 10),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_011.jpg', 11),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_012.jpg', 12),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_013.jpg', 13),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_014.jpg', 14),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_015.jpg', 15),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_016.jpg', 16),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_017.jpg', 17),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_018.jpg', 18),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_019.jpg', 19),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_020.jpg', 20),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_021.jpg', 21),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_022.jpg', 22),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_023.jpg', 23),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_024.jpg', 24),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_025.jpg', 25),
-- Capítulo 2 de SL: 11 páginas reales
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_001.jpg', 1),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_002.jpg', 2),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_003.jpg', 3),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_004.jpg', 4),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_005.jpg', 5),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_006.jpg', 6),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_007.jpg', 7),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_008.jpg', 8),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_009.jpg', 9),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_010.jpg', 10),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_011.jpg', 11),
-- Capítulo 3 de SL: 17 páginas reales
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_001.jpg', 1),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_002.jpg', 2),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_003.jpg', 3),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_004.jpg', 4),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_005.jpg', 5),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_006.jpg', 6),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_007.jpg', 7),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_008.jpg', 8),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_009.jpg', 9),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_010.jpg', 10),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_011.jpg', 11),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_012.jpg', 12),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_013.jpg', 13),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_014.jpg', 14),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_015.jpg', 15),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_016.jpg', 16),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_017.jpg', 17),
-- Capítulo 4 de SL: 16 páginas reales
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_001.jpg', 1),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_002.jpg', 2),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_003.jpg', 3),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_004.jpg', 4),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_005.jpg', 5),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_006.jpg', 6),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_007.jpg', 7),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_008.jpg', 8),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_009.jpg', 9),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_010.jpg', 10),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_011.jpg', 11),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_012.jpg', 12),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_013.jpg', 13),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_014.jpg', 14),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_015.jpg', 15),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_016.jpg', 16),
-- Capítulo 5 de SL: 14 páginas reales
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_001.jpg', 1),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_002.jpg', 2),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_003.jpg', 3),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_004.jpg', 4),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_005.jpg', 5),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_006.jpg', 6),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_007.jpg', 7),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_008.jpg', 8),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_009.jpg', 9),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_010.jpg', 10),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_011.jpg', 11),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_012.jpg', 12),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_013.jpg', 13),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_014.jpg', 14),
-- Capítulo 6 de SL: 16 páginas reales
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_001.jpg', 1),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_002.jpg', 2),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_003.jpg', 3),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_004.jpg', 4),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_005.jpg', 5),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_006.jpg', 6),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_007.jpg', 7),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_008.jpg', 8),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_009.jpg', 9),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_010.jpg', 10),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_011.jpg', 11),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_012.jpg', 12),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_013.jpg', 13),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_014.jpg', 14),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_015.jpg', 15),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_016.jpg', 16),
-- Capítulo 7 de SL: 22 páginas reales
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_001.jpg', 1),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_002.jpg', 2),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_003.jpg', 3),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_004.jpg', 4),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_005.jpg', 5),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_006.jpg', 6),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_007.jpg', 7),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_008.jpg', 8),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_009.jpg', 9),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_010.jpg', 10),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_011.jpg', 11),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_012.jpg', 12),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_013.jpg', 13),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_014.jpg', 14),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_015.jpg', 15),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_016.jpg', 16),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_017.jpg', 17),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_018.jpg', 18),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_019.jpg', 19),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_020.jpg', 20),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_021.jpg', 21),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_022.jpg', 22),
-- Capítulo 8 de SL: 21 páginas reales
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_001.jpg', 1),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_002.jpg', 2),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_003.jpg', 3),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_004.jpg', 4),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_005.jpg', 5),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_006.jpg', 6),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_007.jpg', 7),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_008.jpg', 8),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_009.jpg', 9),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_010.jpg', 10),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_011.jpg', 11),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_012.jpg', 12),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_013.jpg', 13),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_014.jpg', 14),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_015.jpg', 15),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_016.jpg', 16),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_017.jpg', 17),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_018.jpg', 18),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_019.jpg', 19),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_020.jpg', 20),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_021.jpg', 21),
-- Capítulo 9 de SL: 16 páginas reales
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_001.jpg', 1),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_002.jpg', 2),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_003.jpg', 3),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_004.jpg', 4),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_005.jpg', 5),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_006.jpg', 6),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_007.jpg', 7),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_008.jpg', 8),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_009.jpg', 9),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_010.jpg', 10),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_011.jpg', 11),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_012.jpg', 12),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_013.jpg', 13),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_014.jpg', 14),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_015.jpg', 15),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_016.jpg', 16),
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
(1, 5500000,120000, 850000,4800000, 9.94,125000, 9850.00,120000, 95000,88000, NOW() - INTERVAL 2 HOUR, 33, 9.00, 28),
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
(1, 'FRAME', 'Marco Anillo Alpha', 'Anillo cinético animado con pulsos de energía celeste.', 350, '/assets/images/shop/anillo1.gif', 1, 'RARE'),
(2, 'FRAME', 'Marco Anillo Espectral', 'Vórtice espectral animado imbuido en llamas oscuras.', 500, '/assets/images/shop/anillo2.gif', 2, 'EPIC'),
(3, 'BANNER', 'Banner Celestial Azul', 'Horizonte dinámico de energía celestial y zafiro.', 400, '/assets/images/shop/banner1.gif', 1, 'RARE'),
(4, 'BANNER', 'Banner Sombra Dimensional', 'Manto dinámico de sombras purpúreas en movimiento.', 450, '/assets/images/shop/banner2.gif', 2, 'EPIC'),
(5, 'BANNER', 'Banner Fuego Carmesí', 'Llamas abrasadoras continuas de combate.', 500, '/assets/images/shop/banner3.gif', 3, 'EPIC'),
(6, 'BANNER', 'Banner Abismo Infinito', 'Vacío estelar infinito de alta densidad cósmica.', 650, '/assets/images/shop/banner4.gif', 4, 'LEGENDARY'),
(7, 'BANNER', 'Banner Cyber Pulse', 'Pulso continuo de redes cibernéticas en verde neón.', 350, '/assets/images/shop/banner5.gif', 1, 'RARE');

-- ==========================================
-- 17. INVENTARIO DE USUARIOS (USER_INVENTORY)
-- ==========================================
INSERT IGNORE INTO user_inventory (user_id, item_id, is_equipped) VALUES
(1, 1, TRUE),
(1, 3, TRUE),
(2, 1, TRUE),
(2, 4, TRUE),
(3, 2, TRUE),
(3, 5, TRUE);
-- ==========================================
-- 18. COMENTARIOS DE OBRAS
-- ==========================================
INSERT IGNORE INTO comments (id, work_id, chapter_id, user_id, parent_id, content, contains_spoiler, status) VALUES
(1, 1, NULL, 1, NULL, 'obra maestra', FALSE, 'VISIBLE'),
(2, 1, NULL, 2, 1, 'Totalmente de acuerdo, el dibujo del manhwa es de otro nivel.', FALSE, 'VISIBLE'),
(3, 1, NULL, 3, NULL, '¿Cada cuánto tiempo salen los capítulos traducidos?', FALSE, 'VISIBLE');
