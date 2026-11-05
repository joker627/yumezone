from typing import Optional, List
import aiomysql
from app.core.database import resolve_connection


class UserRepository:
    def __init__(self, conn: Optional[aiomysql.Connection] = None):
        self.conn = conn

    # buscar perfil completo por username, user_code o id
    async def get_user_by_identifier(self, identifier: str) -> Optional[dict]:
        if not identifier:
            return None
        raw_id = identifier.strip()
        clean_id = raw_id.lstrip('@')

        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                where_clause = "username = %s OR user_code = %s"
                values = [clean_id, clean_id]

                if clean_id.isdigit():
                    where_clause += " OR id = %s"
                    values.append(int(clean_id))

                # 1. Perfil base
                await cur.execute(
                    f"""
                    SELECT id, user_code, username, avatar_url, banner_url, 
                           avatar_frame_url, avatar_frame_url AS anillo_url, 
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

                # 2. Grupo Scan del usuario (con conteo de obras traducidas)
                await cur.execute(
                    """
                    SELECT sg.id, sg.name, sg.slug, sg.logo_url, sg.description, sgm.role,
                           (SELECT COUNT(*) FROM works w WHERE w.scan_group_id = sg.id) AS works_count
                    FROM scan_group_members sgm
                    JOIN scan_groups sg ON sg.id = sgm.group_id
                    WHERE sgm.user_id = %s
                    ORDER BY FIELD(sgm.role, 'LEADER', 'CO_LEADER', 'UPLOADER', 'EDITOR', 'TRANSLATOR') ASC
                    LIMIT 1
                    """,
                    (uid,)
                )
                user["scan_group"] = await cur.fetchone()

                # 3. Estadísticas clave de lectura y biblioteca (agregación en 1 pasada sobre user_library)
                await cur.execute(
                    """
                    SELECT
                        (SELECT COUNT(*) FROM user_read_chapters WHERE user_id = %s) AS total_chapters_read,
                        (SELECT COUNT(*) FROM comments WHERE user_id = %s) AS total_comments,
                        COALESCE(ul.completed_works, 0) AS completed_works,
                        COALESCE(ul.favorites_count, 0) AS favorites_count,
                        COALESCE(ul.pending_works, 0) AS pending_works
                    FROM (
                        SELECT
                            SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_works,
                            SUM(CASE WHEN status IN ('READING', 'COMPLETED', 'ON_HOLD', 'PLAN_TO_READ') THEN 1 ELSE 0 END) AS favorites_count,
                            SUM(CASE WHEN status = 'PLAN_TO_READ' THEN 1 ELSE 0 END) AS pending_works
                        FROM user_library
                        WHERE user_id = %s
                    ) AS ul
                    """,
                    (uid, uid, uid)
                )
                user["stats"] = await cur.fetchone() or {
                    "total_chapters_read": 0,
                    "completed_works": 0,
                    "favorites_count": 0,
                    "pending_works": 0,
                    "total_comments": 0,
                }

                # 4. Vitrina de Biblioteca por estado con progreso para Reanudar
                await cur.execute(
                    """
                    SELECT 
                        w.id, w.title, w.slug, w.cover_url, w.author, ul.status, ul.rating, ul.added_at,
                        COALESCE(f.name, 'Manga') AS format_name,
                        (SELECT COUNT(*) FROM user_read_chapters urc WHERE urc.user_id = %s AND urc.work_id = w.id) AS chapters_read,
                        COALESCE(ws.chapters_count, 0) AS total_chapters,
                        rh.chapter_id AS last_chapter_id,
                        rh_c.chapter_number AS last_chapter_number
                    FROM user_library ul
                    JOIN works w ON w.id = ul.work_id
                    LEFT JOIN work_statistics ws ON ws.work_id = w.id
                    LEFT JOIN formats f ON f.id = w.format_id
                    LEFT JOIN reading_history rh ON rh.user_id = ul.user_id AND rh.work_id = w.id
                    LEFT JOIN chapters rh_c ON rh_c.id = rh.chapter_id
                    WHERE ul.user_id = %s AND ul.status IS NOT NULL
                    ORDER BY COALESCE(ul.rating, 0) DESC, COALESCE(rh.read_at, ul.added_at) DESC
                    LIMIT 24
                    """,
                    (uid, uid)
                )
                user["favorite_works"] = await cur.fetchall() or []

                # 5. Colección Cosmética / Inventario del usuario
                await cur.execute(
                    """
                    SELECT 
                        si.id AS item_id, UPPER(si.category) AS category, si.name, si.description,
                        si.preview_url, si.rarity, ui.is_equipped
                    FROM user_inventory ui
                    JOIN shop_items si ON si.id = ui.item_id
                    WHERE ui.user_id = %s
                    ORDER BY ui.is_equipped DESC, si.required_level ASC, si.id ASC
                    """,
                    (uid,)
                )
                user["inventory_items"] = await cur.fetchall() or []

                return user

    # actualizar perfil de usuario (con validacion de propiedad en inventario)
    async def update_user(self, user_id: int, data: dict) -> bool:
        allowed_fields = {"username", "bio", "avatar_url", "banner_url", "anillo_url", "avatar_frame_url", "active_title", "country", "is_private"}
        filtered_data = {k: v for k, v in data.items() if k in allowed_fields}
        if not filtered_data:
            return False

        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                # Validar unicidad si cambia username
                if "username" in filtered_data:
                    new_uname = (filtered_data["username"] or "").strip()
                    if not new_uname:
                        filtered_data.pop("username", None)
                    else:
                        await cur.execute("SELECT id FROM users WHERE username = %s AND id != %s", (new_uname, user_id))
                        if await cur.fetchone():
                            raise ValueError("El nombre de usuario ya está en uso por otra cuenta")
                        filtered_data["username"] = new_uname

                # Obtener inventario del usuario para validar items que intenta equipar
                await cur.execute(
                    """
                    SELECT si.id AS item_id, UPPER(si.category) AS category, si.preview_url, si.name
                    FROM user_inventory ui
                    JOIN shop_items si ON si.id = ui.item_id
                    WHERE ui.user_id = %s
                    """,
                    (user_id,)
                )
                owned_items = await cur.fetchall() or []
                owned_banners = {r["preview_url"]: r["item_id"] for r in owned_items if r["category"] == "BANNER" and r.get("preview_url")}
                owned_frames = {r["preview_url"]: r["item_id"] for r in owned_items if r["category"] == "FRAME" and r.get("preview_url")}
                owned_titles = {r["name"]: r["item_id"] for r in owned_items if r["category"] == "TITLE" and r.get("name")}

                if "banner_url" in filtered_data:
                    b_val = (filtered_data["banner_url"] or "").strip() or None
                    if b_val and b_val not in owned_banners:
                        filtered_data.pop("banner_url", None)
                    else:
                        filtered_data["banner_url"] = b_val
                        await cur.execute(
                            """
                            UPDATE user_inventory ui
                            JOIN shop_items si ON si.id = ui.item_id
                            SET ui.is_equipped = FALSE
                            WHERE ui.user_id = %s AND UPPER(si.category) = 'BANNER'
                            """,
                            (user_id,)
                        )
                        if b_val and b_val in owned_banners:
                            await cur.execute(
                                "UPDATE user_inventory SET is_equipped = TRUE WHERE user_id = %s AND item_id = %s",
                                (user_id, owned_banners[b_val])
                            )

                # Unificar anillo_url y avatar_frame_url al nombre canónico de columna avatar_frame_url
                frame_input = filtered_data.pop("avatar_frame_url", None) or filtered_data.pop("anillo_url", None)
                if frame_input is not None or "avatar_frame_url" in data or "anillo_url" in data:
                    f_val = (frame_input or "").strip() or None
                    if f_val and f_val not in owned_frames:
                        pass
                    else:
                        filtered_data["avatar_frame_url"] = f_val
                        await cur.execute(
                            """
                            UPDATE user_inventory ui
                            JOIN shop_items si ON si.id = ui.item_id
                            SET ui.is_equipped = FALSE
                            WHERE ui.user_id = %s AND UPPER(si.category) = 'FRAME'
                            """,
                            (user_id,)
                        )
                        if f_val and f_val in owned_frames:
                            await cur.execute(
                                "UPDATE user_inventory SET is_equipped = TRUE WHERE user_id = %s AND item_id = %s",
                                (user_id, owned_frames[f_val])
                            )

                if "active_title" in filtered_data:
                    t_val = (filtered_data["active_title"] or "").strip() or None
                    if t_val and t_val not in owned_titles:
                        filtered_data.pop("active_title", None)
                    else:
                        filtered_data["active_title"] = t_val
                        await cur.execute(
                            """
                            UPDATE user_inventory ui
                            JOIN shop_items si ON si.id = ui.item_id
                            SET ui.is_equipped = FALSE
                            WHERE ui.user_id = %s AND UPPER(si.category) = 'TITLE'
                            """,
                            (user_id,)
                        )
                        if t_val and t_val in owned_titles:
                            await cur.execute(
                                "UPDATE user_inventory SET is_equipped = TRUE WHERE user_id = %s AND item_id = %s",
                                (user_id, owned_titles[t_val])
                            )

                if not filtered_data:
                    return True

                set_clauses = []
                values = []
                for k, v in filtered_data.items():
                    set_clauses.append(f"{k} = %s")
                    values.append(v)

                values.append(user_id)
                query = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = %s"

                await cur.execute(query, tuple(values))
                if self.conn is None:
                    await conn.commit()
                return True

    # buscar usuarios por username o user_code
    async def search_users(self, query: str, limit: int = 10) -> List[dict]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                search_term = f"%{query}%"
                await cur.execute(
                    """
                    SELECT id, user_code, username, avatar_url, avatar_frame_url, avatar_frame_url AS anillo_url, 
                           active_title, platform_role, xp
                    FROM users
                    WHERE (username LIKE %s OR user_code LIKE %s)
                      AND status = 'ACTIVE'
                      AND is_private = FALSE
                    ORDER BY xp DESC
                    LIMIT %s
                    """,
                    (search_term, search_term, limit)
                )
                return await cur.fetchall() or []

    # listar historial de transacciones de monedas
    async def list_coin_transactions(self, user_id: int, limit: int = 50, offset: int = 0) -> List[dict]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    """
                    SELECT id, user_id, amount, balance_after, type, description, reference_id, created_at
                    FROM user_coin_transactions
                    WHERE user_id = %s
                    ORDER BY created_at DESC, id DESC
                    LIMIT %s OFFSET %s
                    """,
                    (user_id, limit, offset),
                )
                return await cur.fetchall() or []

    # obtener rangos de cultivo desde la base de datos
    async def get_cultivation_ranks(self) -> List[dict]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    """
                    SELECT min_level, max_level, title, badge_icon, reward_coins
                    FROM cultivation_ranks
                    ORDER BY min_level ASC
                    """
                )
                return await cur.fetchall() or []
