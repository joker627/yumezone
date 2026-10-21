from typing import Optional, List
import aiomysql
from app.core.database import get_db_pool

class UserRepository:
    async def get_user_by_identifier(self, identifier: str) -> Optional[dict]:
        """Busca por username (ej. 'juan' o '@juan'), code o id exacto."""
        if not identifier:
            return None
        raw_id = identifier.strip()
        clean_id = raw_id.lstrip('@')
        
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                where_clause = "username = %s OR user_code = %s"
                values = [clean_id, clean_id]
                
                if clean_id.isdigit():
                    where_clause += " OR id = %s"
                    values.append(int(clean_id))
                    
                # Perfil base
                await cur.execute(
                    f"""
                    SELECT id, user_code, username, avatar_url, banner_url, anillo_url, anillo_url AS avatar_frame_url, 
                           active_title, country, bio, is_private, platform_role, coins, xp, streak_days, 
                           last_streak_date, created_at, status
                    FROM users
                    WHERE ({where_clause}) AND status != 'DELETED'
                    LIMIT 1
                    """,
                    tuple(values)
                )
                user = await cur.fetchone()
                if not user:
                    return None

                uid = user["id"]

                # Scan group
                await cur.execute(
                    """
                    SELECT sg.id, sg.name, sg.slug, sg.logo_url, sgm.role
                    FROM scan_group_members sgm
                    JOIN scan_groups sg ON sg.id = sgm.group_id
                    WHERE sgm.user_id = %s
                    ORDER BY FIELD(sgm.role, 'ADMIN', 'MODERATOR', 'MEMBER') ASC
                    LIMIT 1
                    """,
                    (uid,)
                )
                user["scan_group"] = await cur.fetchone()

                # Estadísticas
                await cur.execute(
                    """
                    SELECT
                        (SELECT COUNT(*) FROM user_read_chapters WHERE user_id = %s) AS total_chapters_read,
                        (SELECT COUNT(*) FROM user_library WHERE user_id = %s AND status = 'COMPLETED') AS completed_works,
                        (SELECT COUNT(*) FROM user_library WHERE user_id = %s AND status = 'FAVORITE') AS favorites_count,
                        (SELECT COUNT(*) FROM user_library WHERE user_id = %s AND status = 'FOLLOWING') AS following_count,
                        (SELECT COUNT(*) FROM comments WHERE user_id = %s) AS total_comments
                    """,
                    (uid, uid, uid, uid, uid)
                )
                user["stats"] = await cur.fetchone() or {
                    "total_chapters_read": 0, "completed_works": 0,
                    "favorites_count": 0, "following_count": 0, "total_comments": 0
                }

                # Obras favoritas / biblioteca
                await cur.execute(
                    """
                    SELECT 
                        w.id, w.title, w.slug, w.cover_url, w.author, ul.status, ul.rating, ul.added_at,
                        COALESCE(f.name, 'Manga') AS format_name,
                        COALESCE((
                            SELECT GROUP_CONCAT(g.name SEPARATOR ' • ')
                            FROM work_genres wg
                            JOIN genres g ON g.id = wg.genre_id
                            WHERE wg.work_id = w.id
                        ), '') AS genres,
                        (SELECT COUNT(*) FROM user_read_chapters urc WHERE urc.user_id = %s AND urc.work_id = w.id) AS chapters_read,
                        (SELECT COUNT(*) FROM chapters ch WHERE ch.work_id = w.id AND ch.status = 'PUBLISHED') AS total_chapters
                    FROM user_library ul
                    JOIN works w ON w.id = ul.work_id
                    LEFT JOIN formats f ON f.id = w.format_id
                    WHERE ul.user_id = %s
                    ORDER BY (ul.status = 'FAVORITE') DESC, ul.rating DESC, ul.added_at DESC
                    LIMIT 6
                    """,
                    (uid, uid)
                )
                user["favorite_works"] = await cur.fetchall() or []

                # Actividad reciente
                await cur.execute(
                    """
                    (
                        SELECT 'READ' AS type, rh.read_at AS created_at,
                               w.id AS work_id, w.title AS work_title, w.slug AS work_slug, w.cover_url AS work_cover_url,
                               ch.chapter_number, ch.title AS chapter_title, NULL AS content
                        FROM reading_history rh
                        JOIN works w ON w.id = rh.work_id
                        JOIN chapters ch ON ch.id = rh.chapter_id
                        WHERE rh.user_id = %s
                    )
                    UNION ALL
                    (
                        SELECT 'COMMENT' AS type, c.created_at,
                               w.id AS work_id, w.title AS work_title, w.slug AS work_slug, w.cover_url AS work_cover_url,
                               ch.chapter_number, ch.title AS chapter_title, c.content
                        FROM comments c
                        LEFT JOIN works w ON w.id = c.work_id
                        LEFT JOIN chapters ch ON ch.id = c.chapter_id
                        WHERE c.user_id = %s
                    )
                    ORDER BY created_at DESC
                    LIMIT 8
                    """,
                    (uid, uid)
                )
                user["recent_activity"] = await cur.fetchall() or []

                # Top géneros (unificado en 1 query)
                await cur.execute(
                    """
                    SELECT g.name, COUNT(*) AS count
                    FROM (
                        SELECT wg.genre_id FROM user_read_chapters urc
                        JOIN work_genres wg ON wg.work_id = urc.work_id
                        WHERE urc.user_id = %s
                        UNION ALL
                        SELECT wg.genre_id FROM user_library ul
                        JOIN work_genres wg ON wg.work_id = ul.work_id
                        WHERE ul.user_id = %s
                    ) AS combined
                    JOIN genres g ON g.id = combined.genre_id
                    GROUP BY g.id, g.name
                    ORDER BY count DESC
                    LIMIT 4
                    """,
                    (uid, uid)
                )
                genres_data = await cur.fetchall() or []
                total_genre_counts = sum(item["count"] for item in genres_data) or 1
                for g_item in genres_data:
                    g_item["percentage"] = round((g_item["count"] / total_genre_counts) * 100)
                user["genres_breakdown"] = genres_data

                return user

    async def update_user(self, user_id: int, data: dict) -> bool:
        if not data:
            return True
            
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                set_clauses = []
                values = []
                for k, v in data.items():
                    set_clauses.append(f"{k} = %s")
                    values.append(v)
                
                values.append(user_id)
                query = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = %s"
                
                await cur.execute(query, tuple(values))
                await conn.commit()
                return True

    async def search_users(self, query: str, limit: int = 10) -> List[dict]:
        """Busca usuarios por aproximación en username o user_code."""
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                search_term = f"%{query}%"
                await cur.execute(
                    """
                    SELECT id, user_code, username, avatar_url, xp, platform_role
                    FROM users
                    WHERE (username LIKE %s OR user_code LIKE %s) AND status != 'DELETED'
                    ORDER BY xp DESC
                    LIMIT %s
                    """,
                    (search_term, search_term, limit)
                )
                return await cur.fetchall() or []

    async def get_all_badges(self) -> List[dict]:
        """Obtiene todas las medallas configuradas en la base de datos SQL."""
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    """
                    SELECT id, name, tier, icon, description, condition_type, condition_value, sort_order
                    FROM badges
                    WHERE is_active = TRUE
                    ORDER BY sort_order ASC
                    """
                )
                return await cur.fetchall() or []

