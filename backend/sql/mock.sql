-- YumeZone PostgreSQL 15+ Mock Data (Conversion 1:1 desde mock.sql)
-- Ejecutar DESPUÉS de crear las tablas con postgresql_schema.sql

TRUNCATE TABLE
    view_logs,
    reading_history,
    user_read_chapters,
    user_library,
    work_statistics,
    chapter_submissions,
    chapter_images,
    chapters,
    work_tags,
    work_genres,
    demographics,
    formats,
    statuses,
    tags,
    genres,
    announcements,
    hero_queue,
    scan_group_members,
    scan_roles,
    scan_groups,
    platform_settings,
    notifications,
    user_coin_transactions,
    scan_treasury_transactions,
    scan_funding_goals,
    user_daily_missions,
    user_inventory,
    shop_items,
    user_roles,
    role_permissions,
    permissions,
    roles,
    comment_reactions,
    comments,
    content_reports,
    audit_logs
RESTART IDENTITY CASCADE;

DELETE FROM users WHERE id != 1;

INSERT INTO users (id, user_code, username, email, password, avatar_url, banner_url, avatar_frame_url, country, bio, platform_role, status, coins, clan_tokens, xp, streak_days) VALUES
(1, '3F1EBC225197C5CB', 'YumeMaster', 'manuel7xs@gmail.com', '$argon2id$v=19$m=65536,t=3,p=4$oqDEHluADePJ1vRyFtXhRg$HLQ0nz8Q/mUt5BBdvQo0We0tkKDmWuKBv6qnPkNoG4k', 'https://s1.cdnlxd.xyz/avatars/gqjoqnqwzqr3z42t_1787169934547.webp?v=1787169934793', NULL, NULL, 'CO', 'Administrador principal de YumeZone.', 'SUPERADMIN', 'ACTIVE', 0, 0, 0, 0),
(2, 'SCN001', 'GhostMaster', 'ghost@yumezone.com', '$2b$12$hash_fake_ghost', 'https://i.pravatar.cc/150?u=ghost', NULL, NULL, 'MX', 'Líder de GhostScans. MOD del chat.', 'SUPERADMIN', 'ACTIVE', 0, 0, 0, 0),
(3, 'USR001', 'KiritoFan', 'kirito@test.com', '$2b$12$hash_fake_user1', 'https://i.pravatar.cc/150?u=kirito', NULL, NULL, 'ES', 'Fan del cultivo espectral', 'USER', 'ACTIVE', 0, 0, 0, 0),
(4, 'USR002', 'SakuraChan', 'sakura@test.com', '$2b$12$hash_fake_user2', 'https://i.pravatar.cc/150?u=sakura', NULL, NULL, 'AR', 'Amante del shoujo y la fantasía', 'USER', 'ACTIVE', 0, 0, 0, 0),
(5, 'USR003', 'OtakuKing', 'otaku@test.com', '$2b$12$hash_fake_user3', 'https://i.pravatar.cc/150?u=otaku', NULL, NULL, 'CL', 'Devoro 100 caps al día', 'USER', 'ACTIVE', 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

UPDATE users SET coins = 0, clan_tokens = 0, xp = 0, streak_days = 0, last_streak_date = NULL;

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

INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES
(1, 6, 1),
(2, 5, 1),
(2, 3, 1),
(3, 1, 1),
(4, 1, 1),
(5, 1, 1)
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO scan_roles (id, code, name) VALUES
(1, 'LEADER', 'Líder de Scan'),
(2, 'CO_LEADER', 'Colíder'),
(3, 'UPLOADER', 'Subidor de Capítulos'),
(4, 'EDITOR', 'Editor / Typesetter'),
(5, 'TRANSLATOR', 'Traductor')
ON CONFLICT (id) DO NOTHING;

INSERT INTO scan_groups (id, owner_user_id, name, slug, logo_url, banner_url, description, social_links, status) VALUES
(1, 1, 'YumeScans', 'yumescans', '/assets/icons/logo.png', '/assets/images/shop/banner1.webp', 'Scan oficial de YumeZone liderado por YumeMaster. Especialistas en los mejores mangas, manhwas y manhuas en español.', '{"discord":"https://discord.gg/yumezone","web":"https://yumezone.page"}'::jsonb, 'ACTIVE'),
(2, 2, 'GhostScans', 'ghostscans', 'https://s1.cdnlxd.xyz/avatars/gqjoqnqwzqr3z42t_1787169934547.webp?v=1787169934793', 'https://placehold.co/1200x400/10b981/ffffff?text=GhostScans', 'Grupo líder en manhuas de cultivo espectral.', '{"discord":"https://discord.gg/ghostscans","web":"https://ghostscans.com"}'::jsonb, 'ACTIVE'),
(3, 2, 'DragonTL', 'dragontl', 'https://placehold.co/200x200/ef4444/ffffff?text=DT', 'https://placehold.co/1200x400/ef4444/ffffff?text=DragonTL', 'Traducciones de los mejores mangas shonen.', '{"discord":"https://discord.gg/dragontl"}'::jsonb, 'ACTIVE'),
(4, 4, 'SakuraTeam', 'sakurateam', 'https://placehold.co/200x200/ec4899/ffffff?text=ST', 'https://placehold.co/1200x400/ec4899/ffffff?text=SakuraTeam', 'Enfoque en shoujo y josei.', '{"discord":"https://discord.gg/sakurateam"}'::jsonb, 'ACTIVE'),
(5, 1, 'ShadowTL', 'shadowtl', 'https://placehold.co/200x200/0ea5e9/ffffff?text=SH', 'https://placehold.co/1200x400/0ea5e9/ffffff?text=ShadowTL', 'Traducciones oscuras y de fantasía.', '{"discord":"https://discord.gg/shadowtl"}'::jsonb, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO scan_group_members (group_id, user_id, role, permissions) VALUES
(1, 1, 'LEADER', '{"can_upload":true,"can_manage_members":true,"can_edit_group":true}'::jsonb),
(1, 2, 'CO_LEADER', '{"can_upload":true,"can_manage_members":true,"can_edit_group":true}'::jsonb),
(1, 3, 'TRANSLATOR', '{"can_upload":false,"can_submit_draft":true}'::jsonb),
(1, 4, 'EDITOR', '{"can_upload":false,"can_submit_draft":true}'::jsonb),
(1, 5, 'UPLOADER', '{"can_upload":true}'::jsonb),
(2, 2, 'LEADER', '{"can_upload":true,"can_edit_group":true}'::jsonb),
(3, 5, 'TRANSLATOR', '{"can_upload":false,"can_submit_draft":true}'::jsonb),
(4, 4, 'LEADER', '{"can_upload":true,"can_edit_group":true}'::jsonb)
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO statuses (id, name) VALUES
(1,'En emisión'),(2,'Finalizado'),(3,'En pausa'),(4,'Cancelado')
ON CONFLICT (id) DO NOTHING;

INSERT INTO formats (id, name) VALUES
(1,'Manga'),(2,'Manhua'),(3,'Manhwa'),(4,'Webtoon')
ON CONFLICT (id) DO NOTHING;

INSERT INTO demographics (id, name) VALUES
(1,'Shonen'),(2,'Seinen'),(3,'Shojo'),(4,'Josei')
ON CONFLICT (id) DO NOTHING;

INSERT INTO genres (id, name) VALUES
(1,'Acción'),(2,'Aventura'),(3,'Fantasía'),(4,'Romance'),
(5,'Comedia'),(6,'Drama'),(7,'Terror'),(8,'Misterio'),
(9,'Cultivo'),(10,'Reencarnación'),(11,'Venganza'),(12,'Sobrenatural'),
(13,'Escolar'),(14,'Isekai'),(15,'Artes Marciales'),
(16,'Apocalíptico'),(17,'Sistema'),(18,'Mazmorras')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tags (id, name) VALUES
(1,'Protagonista Fuerte'),(2,'Sistema'),(3,'Harem'),(4,'Mundo Mágico'),
(5,'Venganza'),(6,'Dragones'),(7,'Dioses'),(8,'Sectas'),
(9,'Cultivo Espectral'),(10,'Reencarnado en otro mundo'),
(11,'OP MC'),(12,'Time Travel'),(13,'Regresión')
ON CONFLICT (id) DO NOTHING;

INSERT INTO works (id, title, slug, alternative_title, synopsis, author, cover_url, banner_url, status_id, format_id, demographic_id, scan_group_id) VALUES
(1,'Solo Leveling','solo-leveling','Na Honjaman Level Up',
 'En un mundo donde los cazadores luchan contra monstruos que salen de portales, Sung Jin-Woo es conocido como el cazador más débil de rango E. Tras sobrevivir a una mazmorra doble que acaba con casi todo su equipo, despierta con un sistema misterioso que le permite subir de nivel infinitamente como en un videojuego. Ahora tiene la oportunidad de convertirse en el cazador más fuerte de la historia.',
 'Chugong',
 '/assets/comic/manhua/solo-leveling/portada/portada.webp',
 '/assets/comic/manhua/solo-leveling/portada/portada.webp',
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
 1,3,1,1),
(4,'Omniscient Reader''s Viewpoint','omniscient-readers-viewpoint','ORV',
 'Kim Dokja es un oficinista común cuya única pasión es leer la novela web "Tres formas de sobrevivir". Cuando la novela termina, el mundo real se convierte en el escenario de esa historia. Ahora, siendo el único que conoce el final, Dokja deberá usar su conocimiento para sobrevivir al apocalipsis y a los escenarios que se desarrollan a su alrededor.',
 'Sing Shong',
 'https://cdn.mahoureader.com/series/16/posterImage.webp',
 'https://cdn.mahoureader.com/series/16/posterImage.webp',
 1,3,1,1),
(5,'Who Made Me a Princess','who-made-me-a-princess','WMMAP',
 'Athanasia despierta en el cuerpo de la hija del emperador Claude, un hombre temido que en la novela original asesina a su propia hija. Sabiendo que su muerte es inevitable si no cambia el destino, decide ganarse el afecto de su padre para sobrevivir. Pero los sentimientos que empiezan a surgir entre ellos van más allá de lo que esperaba.',
 'Plutus',
 'https://tse1.mm.bing.net/th/id/OIP.lHvoLHmLxalfO3PkE3NDQQHaKX?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
 'https://tse1.mm.bing.net/th/id/OIP.lHvoLHmLxalfO3PkE3NDQQHaKX?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
 2,4,3,1),
(6,'Tales of Demons and Gods','tales-of-demons-and-gods','Yao Shen Ji',
 'Nie Li, el guerrero más fuerte de su era, muere en la batalla final contra los sabios demonios. Renace en su cuerpo de 13 años, cuando era el estudiante más débil de su clase. Con el conocimiento de sus años de experiencia, ahora puede reescribir el destino y salvar a sus seres queridos de la tragedia que se avecina.',
 'Mad Snail',
 'https://cdn.mahoureader.com/series/157/posterImage.jpg',
 'https://cdn.mahoureader.com/series/157/posterImage.jpg',
 1,2,1,1),
(7,'Nano Machine','nano-machine','Nano Mashin',
 'Cheon Yeo-Woon es el príncipe abandonado de la Secta Demoníaca, destinado a morir a manos de sus hermanos. Pero un descendiente del futuro le inyecta nanomáquinas que reparan y mejoran su cuerpo. Ahora, con un poder tecnológico siglos por delante de su era, Cheon Yeo-Woon comenzará su ascenso para reclamar lo que le pertenece.',
 'Hanjungwol',
 'https://tse3.mm.bing.net/th/id/OIP.kkSKWZgrROr7aa3u37N-3AHaKu?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
 'https://tse3.mm.bing.net/th/id/OIP.kkSKWZgrROr7aa3u37N-3AHaKu?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
 1,3,1,1),
(8,'The Great Mage Returns After 4000 Years','the-great-mage-returns-after-4000-years','TGMR',
 'Lucas Traumen, el mago más poderoso de su era, fue traicionado y sellado durante 4000 años. Al despertar, descubre que la magia ha decaído y que el mundo está gobernado por falsos dioses. Ahora, en el cuerpo de un joven noble débil, buscará venganza contra aquellos que lo traicionaron y restaurará el verdadero arte de la magia.',
 'Yeon Sanho',
 'https://greatmageafter4000.com/wp-content/uploads/2025/10/The-Archmage-Returns-After-4000-Years.webp',
 'https://greatmageafter4000.com/wp-content/uploads/2025/10/The-Archmage-Returns-After-4000-Years.webp',
 1,3,1,1),
(9,'Villains Are Destined to Die','villains-are-destined-to-die','VADTD',
 'Penelope Eckhart despierta en el cuerpo de la villana de una novela otome. En el juego, su personaje muere siempre antes del final. Decidida a sobrevivir, Penelope deberá ganar el afecto de los tres hermanos del protagonista y del misterioso príncipe heredero, mientras intenta escapar del destino que le espera.',
 'Gwon Gyeoeul',
 'https://www.normaeditorial.com/upload/media/albumes/0001/37/thumb_36916_albumes_medium.jpeg',
 'https://i.ytimg.com/vi/ujq0-UvdEwA/maxresdefault.jpg',
 1,4,3,1),
(10,'Against the Gods','against-the-gods','Ni Tian Xie Shen',
 'Yun Che, un joven que muere persiguiendo un tesoro legendario, renace en el cuerpo de un muchacho ciego y maltratado en un continente donde la fuerza lo es todo. Con el conocimiento de su vida pasada y la ayuda del misterioso Espejo Celestial, comenzará su camino para desafiar a los cielos y vengar las injusticias cometidas contra él.',
 'Mars Gravity',
 'https://www.mangaread.org/wp-content/uploads/WP-manga/data/manga_5e2144c7bd723/81d01cbc099825a9df9fced36a4d1892/2.jpg',
 'https://www.mangaread.org/wp-content/uploads/WP-manga/data/manga_5e2144c7bd723/81d01cbc099825a9df9fced36a4d1892/2.jpg',
 1,2,1,1),
(11,'Battle Through the Heavens','battle-through-the-heavens','Doupo Cangqiong',
 'Xiao Yan fue un genio de la alquimia y el cultivo hasta que perdió sus poderes a los 12 años. Ahora, siendo el hazmerreír de su clan, recibe la visita del espíritu de Yao Chen, un alquimista legendario atrapado en un anillo. Con su ayuda, Xiao Yan emprenderá un viaje para recuperar su poder y convertirse en el alquimista más fuerte del continente.',
 'Tian Can Tu Dou',
 'https://temp.compsci88.com/cover/fallback/01J76XYBEESPMGZV48J6NHH7NE.jpg',
 'https://temp.compsci88.com/cover/fallback/01J76XYBEESPMGZV48J6NHH7NE.jpg',
 2,2,1,1),
(12,'Overgeared','overgeared','Temppal',
 'Shin Youngwoo es un jugador pobre que dedica su vida a un videojuego de realidad virtual para mantener a su familia. Tras conseguir un objeto legendario por accidente, se transforma en un jugador con un potencial inimaginable. Ahora deberá equilibrar su vida real con su ascenso para convertirse en la leyenda del servidor.',
 'Park Saenal',
 '',
 '',
 1,3,1,1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO work_genres (work_id, genre_id) VALUES
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
(12,1),(12,2),(12,3),(12,17)
ON CONFLICT (work_id, genre_id) DO NOTHING;

INSERT INTO work_tags (work_id, tag_id) VALUES
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
(12,1),(12,2),(12,11)
ON CONFLICT (work_id, tag_id) DO NOTHING;

INSERT INTO chapters (id, work_id, scan_group_id, chapter_number, title, slug, status, translator_user_id, reward_coins, published_at) VALUES
(28, 1,1,  0.00,'Prólogo','sl-cap-0','PUBLISHED', 2, 20, '2023-01-01 09:00:00'),
(1,  1,1,  1.00,'El Cazador Más Débil','sl-cap-1','PUBLISHED', 3, 20, '2023-01-01 10:00:00'),
(2,  1,1,  2.00,'La Doble Mazmorra','sl-cap-2','PUBLISHED', 3, 20, '2023-01-08 10:00:00'),
(3,  1,1,  3.00,'La Estatua de Dios','sl-cap-3','PUBLISHED', 3, 20, '2023-01-15 10:00:00'),
(4,  1,1,  4.00,'Prueba de Valor','sl-cap-4','PUBLISHED', 3, 20, '2023-01-22 10:00:00'),
(29, 1,1,  5.00,'Misiones Diarias','sl-cap-5','PUBLISHED', 2, 20, '2023-01-29 10:00:00'),
(30, 1,1,  6.00,'Mazmorra Instantánea','sl-cap-6','PUBLISHED', 2, 20, '2023-02-05 10:00:00'),
(31, 1,1,  7.00,'El Asesino del Pantano','sl-cap-7','PUBLISHED', 2, 20, '2023-02-12 10:00:00'),
(32, 1,1,  8.00,'El Escuadrón C','sl-cap-8','PUBLISHED', 2, 20, '2023-02-19 10:00:00'),
(33, 1,1,  9.00,'El Ejército de las Sombras','sl-cap-9','PUBLISHED', 2, 20, NOW() - INTERVAL '2 hours'),
(34, 1,1, 10.00,'La Puerta Roja','sl-cap-10','SCHEDULED', 3, 25, NOW() + INTERVAL '2 days'),
(5, 2,1,  1.00,'El Libro Negro','mp-cap-1','PUBLISHED', 5, 20, '2022-01-01 10:00:00'),
(6, 2,1,3000.00,'La Cima Marcial','mp-cap-3000','PUBLISHED', 5, 20, NOW() - INTERVAL '1 day'),
(7, 2,1,3600.00,'El Nuevo Mundo','mp-cap-3600','PUBLISHED', 5, 20, NOW() - INTERVAL '4 hours'),
(8, 3,1,  1.00,'El Rey Gris','tbate-cap-1','PUBLISHED', 4, 20, '2022-03-15 10:00:00'),
(9, 3,1,175.00,'La Guerra de los Dioses','tbate-cap-175','PUBLISHED', 4, 20, NOW() - INTERVAL '5 hours'),
(10,4,1,  1.00,'El Escenario Comienza','orv-cap-1','PUBLISHED', 1, 20, '2022-05-01 10:00:00'),
(11,4,1,190.00,'El Lector Omnisciente','orv-cap-190','PUBLISHED', 1, 20, NOW() - INTERVAL '12 hours'),
(12,5,1,  1.00,'El Despertar','wmmap-cap-1','PUBLISHED', 4, 20, '2022-04-01 10:00:00'),
(13,5,1,120.00,'El Amor del Emperador','wmmap-cap-120','PUBLISHED', 4, 20, NOW() - INTERVAL '3 days'),
(14,6,1,  1.00,'El Renacer de Nie Li','tdg-cap-1','PUBLISHED', 5, 20, '2022-06-01 10:00:00'),
(15,6,1,400.00,'La Secta Divina','tdg-cap-400','PUBLISHED', 5, 20, NOW() - INTERVAL '10 hours'),
(16,7,1,  1.00,'Las Nanomáquinas','nm-cap-1','PUBLISHED', 2, 20, '2023-02-01 10:00:00'),
(17,7,1,200.00,'El Príncipe Demonio','nm-cap-200','PUBLISHED', 2, 20, NOW() - INTERVAL '6 hours'),
(18,8,1,  1.00,'El Regreso','tgmr-cap-1','PUBLISHED', 2, 20, '2023-03-01 10:00:00'),
(19,8,1,150.00,'La Nueva Era','tgmr-cap-150','PUBLISHED', 2, 20, NOW() - INTERVAL '8 hours'),
(20,9,1,  1.00,'La Villana Despierta','vadtd-cap-1','PUBLISHED', 4, 20, '2023-04-01 10:00:00'),
(21,9,1,130.00,'El Afecto del Príncipe','vadtd-cap-130','PUBLISHED', 4, 20, NOW() - INTERVAL '4 hours'),
(22,10,1,  1.00,'El Renacer de Yun Che','atg-cap-1','PUBLISHED', 5, 20, NOW() - INTERVAL '20 hours'),
(23,10,1,2000.00,'La Cima de los Dioses','atg-cap-2000','PUBLISHED', 5, 20, NOW() - INTERVAL '20 hours'),
(24,11,1,  1.00,'La Caída del Genio','btth-cap-1','PUBLISHED', 5, 20, NOW() - INTERVAL '12 hours'),
(25,11,1,500.00,'El Alquimista Legendario','btth-cap-500','PUBLISHED', 5, 20, NOW() - INTERVAL '12 hours'),
(26,12,1,  1.00,'El Objeto Legendario','og-cap-1','PUBLISHED', 3, 20, NOW() - INTERVAL '6 hours'),
(27,12,1,150.00,'El Rey del Servidor','og-cap-150','PUBLISHED', 3, 20, NOW() - INTERVAL '6 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO chapter_images (chapter_id, image_url, order_number) VALUES
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_001.webp', 1),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_002.webp', 2),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_003.webp', 3),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_004.webp', 4),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_005.webp', 5),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_006.webp', 6),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_007.webp', 7),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_008.webp', 8),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_009.webp', 9),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_010.webp', 10),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_011.webp', 11),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_012.webp', 12),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_013.webp', 13),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_014.webp', 14),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_015.webp', 15),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_016.webp', 16),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_017.webp', 17),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_018.webp', 18),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_019.webp', 19),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_020.webp', 20),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_021.webp', 21),
(28, '/assets/comic/manhua/solo-leveling/capitulo-0/page_022.webp', 22),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_001.webp', 1),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_002.webp', 2),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_003.webp', 3),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_004.webp', 4),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_005.webp', 5),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_006.webp', 6),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_007.webp', 7),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_008.webp', 8),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_009.webp', 9),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_010.webp', 10),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_011.webp', 11),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_012.webp', 12),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_013.webp', 13),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_014.webp', 14),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_015.webp', 15),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_016.webp', 16),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_017.webp', 17),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_018.webp', 18),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_019.webp', 19),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_020.webp', 20),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_021.webp', 21),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_022.webp', 22),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_023.webp', 23),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_024.webp', 24),
(1, '/assets/comic/manhua/solo-leveling/capitulo-1/page_025.webp', 25),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_001.webp', 1),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_002.webp', 2),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_003.webp', 3),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_004.webp', 4),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_005.webp', 5),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_006.webp', 6),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_007.webp', 7),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_008.webp', 8),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_009.webp', 9),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_010.webp', 10),
(2, '/assets/comic/manhua/solo-leveling/capitulo-2/page_011.webp', 11),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_001.webp', 1),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_002.webp', 2),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_003.webp', 3),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_004.webp', 4),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_005.webp', 5),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_006.webp', 6),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_007.webp', 7),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_008.webp', 8),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_009.webp', 9),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_010.webp', 10),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_011.webp', 11),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_012.webp', 12),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_013.webp', 13),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_014.webp', 14),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_015.webp', 15),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_016.webp', 16),
(3, '/assets/comic/manhua/solo-leveling/capitulo-3/page_017.webp', 17),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_001.webp', 1),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_002.webp', 2),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_003.webp', 3),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_004.webp', 4),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_005.webp', 5),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_006.webp', 6),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_007.webp', 7),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_008.webp', 8),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_009.webp', 9),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_010.webp', 10),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_011.webp', 11),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_012.webp', 12),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_013.webp', 13),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_014.webp', 14),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_015.webp', 15),
(4, '/assets/comic/manhua/solo-leveling/capitulo-4/page_016.webp', 16),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_001.webp', 1),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_002.webp', 2),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_003.webp', 3),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_004.webp', 4),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_005.webp', 5),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_006.webp', 6),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_007.webp', 7),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_008.webp', 8),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_009.webp', 9),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_010.webp', 10),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_011.webp', 11),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_012.webp', 12),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_013.webp', 13),
(29, '/assets/comic/manhua/solo-leveling/capitulo-5/page_014.webp', 14),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_001.webp', 1),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_002.webp', 2),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_003.webp', 3),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_004.webp', 4),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_005.webp', 5),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_006.webp', 6),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_007.webp', 7),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_008.webp', 8),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_009.webp', 9),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_010.webp', 10),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_011.webp', 11),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_012.webp', 12),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_013.webp', 13),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_014.webp', 14),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_015.webp', 15),
(30, '/assets/comic/manhua/solo-leveling/capitulo-6/page_016.webp', 16),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_001.webp', 1),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_002.webp', 2),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_003.webp', 3),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_004.webp', 4),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_005.webp', 5),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_006.webp', 6),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_007.webp', 7),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_008.webp', 8),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_009.webp', 9),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_010.webp', 10),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_011.webp', 11),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_012.webp', 12),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_013.webp', 13),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_014.webp', 14),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_015.webp', 15),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_016.webp', 16),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_017.webp', 17),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_018.webp', 18),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_019.webp', 19),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_020.webp', 20),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_021.webp', 21),
(31, '/assets/comic/manhua/solo-leveling/capitulo-7/page_022.webp', 22),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_001.webp', 1),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_002.webp', 2),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_003.webp', 3),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_004.webp', 4),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_005.webp', 5),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_006.webp', 6),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_007.webp', 7),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_008.webp', 8),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_009.webp', 9),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_010.webp', 10),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_011.webp', 11),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_012.webp', 12),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_013.webp', 13),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_014.webp', 14),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_015.webp', 15),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_016.webp', 16),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_017.webp', 17),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_018.webp', 18),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_019.webp', 19),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_020.webp', 20),
(32, '/assets/comic/manhua/solo-leveling/capitulo-8/page_021.webp', 21),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_001.webp', 1),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_002.webp', 2),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_003.webp', 3),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_004.webp', 4),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_005.webp', 5),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_006.webp', 6),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_007.webp', 7),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_008.webp', 8),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_009.webp', 9),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_010.webp', 10),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_011.webp', 11),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_012.webp', 12),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_013.webp', 13),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_014.webp', 14),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_015.webp', 15),
(33, '/assets/comic/manhua/solo-leveling/capitulo-9/page_016.webp', 16),
(7,'',1),(7,'',2),(7,'',3),(7,'',4),(7,'',5),(7,'',6),(7,'',7),(7,'',8),(7,'',9),(7,'',10),(7,'',11),(7,'',12),(7,'',13),(7,'',14),(7,'',15),(7,'',16),
(9,'',1),(9,'',2),(9,'',3),(9,'',4),(9,'',5),(9,'',6),(9,'',7),(9,'',8),(9,'',9),(9,'',10),(9,'',11),(9,'',12),(9,'',13),(9,'',14),
(11,'',1),(11,'',2),(11,'',3),(11,'',4),(11,'',5),(11,'',6),(11,'',7),(11,'',8),(11,'',9),(11,'',10),(11,'',11),(11,'',12),(11,'',13),(11,'',14),(11,'',15),
(17,'',1),(17,'',2),(17,'',3),(17,'',4),(17,'',5),(17,'',6),(17,'',7),(17,'',8),(17,'',9),(17,'',10),(17,'',11),(17,'',12)
ON CONFLICT (chapter_id, order_number) DO NOTHING;

INSERT INTO chapter_submissions (id, chapter_id, user_id, content_url, page_count, status, notes, rejection_reason, reviewed_by, reviewed_at, created_at) VALUES
(1, 1, 3, '/assets/comic/manhua/solo-leveling/capitulo-1/', 24, 'APPROVED', 'Traducción inicial completa del capítulo 1.', NULL, 1, NOW() - INTERVAL '10 days', NOW() - INTERVAL '11 days'),
(2, 2, 3, '/assets/comic/manhua/solo-leveling/capitulo-2/', 20, 'APPROVED', 'Revisión y edición aprobada por YumeMaster.', NULL, 1, NOW() - INTERVAL '5 days', NOW() - INTERVAL '6 days'),
(3, 34, 3, '/assets/comic/manhua/solo-leveling/capitulo-10/', 22, 'PENDING', 'Borrador del capítulo 10 listo para control de calidad.', NULL, NULL, NULL, NOW() - INTERVAL '2 hours'),
(4, 7, 5, 'https://cdn.example.com/drafts/mp-3600.zip', 18, 'PENDING', 'Traducción completa de Martial Peak 3600.', NULL, NULL, NULL, NOW() - INTERVAL '4 hours'),
(5, 6, 5, 'https://cdn.example.com/drafts/mp-3000-v1.zip', 15, 'REJECTED', 'Primera versión con marcas de agua del raw.', 'Imágenes de baja resolución con marcas de agua del raw original. Por favor resubir en HD.', 2, NOW() - INTERVAL '2 days', NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO work_statistics (work_id, total_views, daily_views, weekly_views, monthly_views, rating_average, rating_count, trending_score, views_last_24h, favorites_count, last_published_at, latest_chapter_id, latest_chapter_number, first_chapter_id, chapters_count) VALUES
(1, 0, 0, 0, 0, 0.00, 0, 0.00, 0, 0, NOW() - INTERVAL '2 hours', 33, 9.00, 28, 9),
(2, 0, 0, 0, 0, 0.00, 0, 0.00, 0, 0, NOW() - INTERVAL '4 hours', 7, 3600.00, 5, 3),
(3, 0, 0, 0, 0, 0.00, 0, 0.00, 0, 0, NOW() - INTERVAL '5 hours', 9, 175.00, 8, 2),
(4, 0, 0, 0, 0, 0.00, 0, 0.00, 0, 0, NOW() - INTERVAL '12 hours', 11, 190.00, 10, 2),
(5, 0, 0, 0, 0, 0.00, 0, 0.00, 0, 0, NOW() - INTERVAL '3 days', 13, 120.00, 12, 2),
(6, 0, 0, 0, 0, 0.00, 0, 0.00, 0, 0, NOW() - INTERVAL '10 hours', 15, 400.00, 14, 2),
(7, 0, 0, 0, 0, 0.00, 0, 0.00, 0, 0, NOW() - INTERVAL '6 hours', 17, 200.00, 16, 2),
(8, 0, 0, 0, 0, 0.00, 0, 0.00, 0, 0, NOW() - INTERVAL '8 hours', 19, 150.00, 18, 2),
(9, 0, 0, 0, 0, 0.00, 0, 0.00, 0, 0, NOW() - INTERVAL '4 hours', 21, 130.00, 20, 2),
(10, 0, 0, 0, 0, 0.00, 0, 0.00, 0, 0, NOW() - INTERVAL '20 hours', 23, 2000.00, 22, 2),
(11, 0, 0, 0, 0, 0.00, 0, 0.00, 0, 0, NOW() - INTERVAL '12 hours', 25, 500.00, 24, 2),
(12, 0, 0, 0, 0, 0.00, 0, 0.00, 0, 0, NOW() - INTERVAL '6 hours', 27, 150.00, 26, 2)
ON CONFLICT (work_id) DO NOTHING;

INSERT INTO hero_queue (work_id, status, queued_at, activated_at, expires_at) VALUES
(7,'ACTIVE',NOW() - INTERVAL '20 hours',NOW() - INTERVAL '20 hours',NOW() + INTERVAL '30 days'),
(8,'ACTIVE',NOW() - INTERVAL '12 hours',NOW() - INTERVAL '12 hours',NOW() + INTERVAL '30 days'),
(9,'ACTIVE',NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours', NOW() + INTERVAL '30 days')
ON CONFLICT (work_id) DO NOTHING;

INSERT INTO announcements (id, scan_group_id, type, type_label, source, title, description, created_at, expires_at, is_resolved, is_active) VALUES
(1, NULL, 'sistema', 'Sistema', 'DevTeam', 'Servidores CDN 4K activados', 'Se ha completado el despliegue de nuestra infraestructura global CDN de ultra baja latencia. Ahora podrás disfrutar de una lectura fluida en 4K con precarga instantánea y sin interrupciones.', NOW() - INTERVAL '15 minutes', NULL, FALSE, TRUE),
(8, NULL, 'evento', 'Evento', 'Comunidad', 'Torneo de Trivia Manga', 'Participa este sábado en el Discord oficial de la comunidad de YumeZone en nuestro gran torneo de trivia manga y compite contra otros lectores para ganar monedas, llaves y suscripciones VIP.', NOW() - INTERVAL '1 hour', NULL, FALSE, TRUE),
(2, NULL, 'sistema', 'Sistema', 'DevTeam', 'Mantenimiento programado', 'El mantenimiento preventivo en nuestros clústeres de bases de datos y servidores de almacenamiento concluyó exitosamente. Todos los servicios y sincronizaciones de lectura operan al 100%.', NOW() - INTERVAL '2 hours', NULL, TRUE, TRUE),
(3, NULL, 'evento', 'Evento', 'GhostFest', 'Doble XP & Llaves esta semana', 'Durante este evento especial, completa tus lecturas y misiones diarias para obtener el doble de experiencia, llaves doradas de desbloqueo anticipado y marcos de perfil de edición limitada.', NOW() - INTERVAL '6 hours', NULL, TRUE, TRUE),
(4, NULL, 'evento', 'Evento', 'YumeZone', 'Concurso de Fan Art', 'Envía tus mejores ilustraciones originales de tus obras favoritas al canal de arte en Discord. Las obras ganadoras recibirán membresías VIP anuales, monedas de la tienda y marcos exclusivos.', NOW() - INTERVAL '1 day', NULL, TRUE, TRUE),
(7, NULL, 'sistema', 'Sistema', 'DevTeam', 'Actualización v2.4 del Lector', 'La versión 2.4 de nuestro lector web ya está disponible con mejoras en renderizado de alta velocidad, soporte optimizado para gestos táctiles en móviles y un consumo de batería reducido.', NOW() - INTERVAL '3 days', NULL, TRUE, TRUE),
(5, 1, 'scan', 'Scans', 'GhostScans', 'Convocatoria para traductores', 'Buscamos traductores de coreano y chino con pago por capítulo y horarios flexibles.', NOW() - INTERVAL '4 days', NOW() + INTERVAL '2 days', FALSE, TRUE),
(6, 2, 'scan', 'Scans', 'YumeScans', 'Proyecto nuevo: Tower of God', 'YumeScans anuncia la traducción oficial de Tower of God con publicaciones semanales en alta resolución.', NOW() - INTERVAL '5 days', NOW() + INTERVAL '2 days', FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO notifications (user_id, type, payload, read_at) VALUES
(1, 'system', '{"title": "¡Bienvenido a YumeZone! Explora las mejores obras y mantén tu racha diaria activa."}'::jsonb, NULL),
(1, 'chapter', '{"title": "Nuevo capítulo disponible: Solo Leveling Cap. 1 ya está listo para leer."}'::jsonb, NULL),
(1, 'system', '{"title": "Tu cuenta ha sido verificada exitosamente como SuperAdmin."}'::jsonb, NOW() - INTERVAL '1 day');

INSERT INTO shop_items (id, category, name, description, price_coins, preview_url, required_level, rarity) VALUES
(1, 'FRAME', 'Marco Anillo Alpha', 'Anillo cinético animado con pulsos de energía celeste.', 450, '/assets/images/shop/anillo1.webp', 1, 'RARE'),
(2, 'FRAME', 'Marco Anillo Espectral', 'Vórtice espectral animado imbuido en llamas oscuras.', 950, '/assets/images/shop/anillo2.webp', 2, 'EPIC'),
(3, 'BANNER', 'Banner Celestial Azul', 'Horizonte dinámico de energía celestial y zafiro.', 450, '/assets/images/shop/banner1.webp', 1, 'RARE'),
(4, 'BANNER', 'Banner Sombra Dimensional', 'Manto dinámico de sombras purpúreas en movimiento.', 950, '/assets/images/shop/banner2.webp', 2, 'EPIC'),
(5, 'BANNER', 'Banner Fuego Carmesí', 'Llamas abrasadoras continuas de combate.', 950, '/assets/images/shop/banner3.webp', 3, 'EPIC'),
(6, 'BANNER', 'Banner Abismo Infinito', 'Vacío estelar infinito de alta densidad cósmica.', 1800, '/assets/images/shop/banner4.webp', 4, 'LEGENDARY'),
(7, 'BANNER', 'Banner Cyber Pulse', 'Pulso continuo de redes cibernéticas en verde neón.', 450, '/assets/images/shop/banner5.webp', 1, 'RARE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO comments (id, work_id, chapter_id, user_id, parent_id, content, contains_spoiler, status) VALUES
(1, 1, NULL, 1, NULL, 'obra maestra', FALSE, 'VISIBLE'),
(2, 1, NULL, 2, 1, 'Totalmente de acuerdo, el dibujo del manhwa es de otro nivel.', FALSE, 'VISIBLE'),
(3, 1, NULL, 3, NULL, '¿Cada cuánto tiempo salen los capítulos traducidos?', FALSE, 'VISIBLE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO comment_reactions (comment_id, user_id, reaction, created_at) VALUES
(1, 2, 'LIKE', NOW() - INTERVAL '20 minutes'),
(1, 3, 'LIKE', NOW() - INTERVAL '15 minutes'),
(1, 4, 'LIKE', NOW() - INTERVAL '10 minutes'),
(2, 1, 'LIKE', NOW() - INTERVAL '10 minutes'),
(3, 1, 'LIKE', NOW() - INTERVAL '5 minutes')
ON CONFLICT (comment_id, user_id) DO NOTHING;

INSERT INTO content_reports (id, reporter_user_id, entity_type, entity_id, reason, details, status, reviewed_by, reviewed_at, created_at) VALUES
(1, 3, 'COMMENT', 3, 'Spam o publicidad encubierta', 'Pregunta reiterada en múltiples capítulos sin aportar al debate.', 'OPEN', NULL, NULL, NOW() - INTERVAL '2 hours'),
(2, 4, 'COMMENT', 2, 'Lenguaje inapropiado o spoiler', 'Comentario revelando giros de la trama sin etiqueta de advertencia.', 'REVIEWING', 2, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '1 hour'),
(3, 5, 'WORK', 1, 'Error en metadatos o sinopsis', 'El autor de la obra tenía un error tipográfico en la traducción.', 'RESOLVED', 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, before_data, after_data, ip_address, created_at) VALUES
(1, 1, 'UPDATE_ROLE', 'USER', '2', '{"role":"USER"}'::jsonb, '{"role":"ADMIN"}'::jsonb, '192.168.1.1', NOW() - INTERVAL '7 days'),
(2, 1, 'APPROVE_SUBMISSION', 'CHAPTER_SUBMISSION', '1', '{"status":"PENDING"}'::jsonb, '{"status":"APPROVED"}'::jsonb, '192.168.1.1', NOW() - INTERVAL '10 days'),
(3, 2, 'REJECT_SUBMISSION', 'CHAPTER_SUBMISSION', '5', '{"status":"PENDING"}'::jsonb, '{"status":"REJECTED"}'::jsonb, '192.168.1.12', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_settings (id, setting_key, setting_value, description) VALUES
(1, 'hero_new_rotation_hours', '{"hours": 24}'::jsonb, 'Duración en horas de cada obra nueva en el Hero'),
(2, 'site_maintenance_mode', '{"enabled": false}'::jsonb, 'Interruptor global de modo de mantenimiento'),
(3, 'default_chapter_reward', '{"coins": 20}'::jsonb, 'Recompensa estándar en monedas por capítulo traducido')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('roles', 'id'), COALESCE((SELECT MAX(id) FROM roles), 1));
SELECT setval(pg_get_serial_sequence('permissions', 'id'), COALESCE((SELECT MAX(id) FROM permissions), 1));
SELECT setval(pg_get_serial_sequence('scan_roles', 'id'), COALESCE((SELECT MAX(id) FROM scan_roles), 1));
SELECT setval(pg_get_serial_sequence('scan_groups', 'id'), COALESCE((SELECT MAX(id) FROM scan_groups), 1));
SELECT setval(pg_get_serial_sequence('statuses', 'id'), COALESCE((SELECT MAX(id) FROM statuses), 1));
SELECT setval(pg_get_serial_sequence('formats', 'id'), COALESCE((SELECT MAX(id) FROM formats), 1));
SELECT setval(pg_get_serial_sequence('demographics', 'id'), COALESCE((SELECT MAX(id) FROM demographics), 1));
SELECT setval(pg_get_serial_sequence('genres', 'id'), COALESCE((SELECT MAX(id) FROM genres), 1));
SELECT setval(pg_get_serial_sequence('tags', 'id'), COALESCE((SELECT MAX(id) FROM tags), 1));
SELECT setval(pg_get_serial_sequence('works', 'id'), COALESCE((SELECT MAX(id) FROM works), 1));
SELECT setval(pg_get_serial_sequence('chapters', 'id'), COALESCE((SELECT MAX(id) FROM chapters), 1));
SELECT setval(pg_get_serial_sequence('chapter_images', 'id'), COALESCE((SELECT MAX(id) FROM chapter_images), 1));
SELECT setval(pg_get_serial_sequence('chapter_submissions', 'id'), COALESCE((SELECT MAX(id) FROM chapter_submissions), 1));
SELECT setval(pg_get_serial_sequence('hero_queue', 'id'), COALESCE((SELECT MAX(id) FROM hero_queue), 1));
SELECT setval(pg_get_serial_sequence('announcements', 'id'), COALESCE((SELECT MAX(id) FROM announcements), 1));
SELECT setval(pg_get_serial_sequence('notifications', 'id'), COALESCE((SELECT MAX(id) FROM notifications), 1));
SELECT setval(pg_get_serial_sequence('shop_items', 'id'), COALESCE((SELECT MAX(id) FROM shop_items), 1));
SELECT setval(pg_get_serial_sequence('comments', 'id'), COALESCE((SELECT MAX(id) FROM comments), 1));
SELECT setval(pg_get_serial_sequence('content_reports', 'id'), COALESCE((SELECT MAX(id) FROM content_reports), 1));
SELECT setval(pg_get_serial_sequence('audit_logs', 'id'), COALESCE((SELECT MAX(id) FROM audit_logs), 1));
SELECT setval(pg_get_serial_sequence('platform_settings', 'id'), COALESCE((SELECT MAX(id) FROM platform_settings), 1));
