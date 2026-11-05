from decimal import Decimal
from typing import Any, Dict, List, Optional
import aiomysql
from app.core.database import resolve_connection
from app.modules.chapters.models import Chapter, ChapterImage
from app.utils import to_json_safe


class ChapterRepository:
    def __init__(self, conn: Optional[aiomysql.Connection] = None):
        self.conn = conn

    # obtener capitulo por id
    async def get_chapter(self, chapter_id: int) -> Optional[Chapter]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    """
                    SELECT c.*, u.username AS translator_username
                    FROM chapters c
                    LEFT JOIN users u ON u.id = c.translator_user_id
                    WHERE c.id = %s
                    """,
                    (chapter_id,),
                )
                row = await cur.fetchone()
                return Chapter(**row) if row else None

    # obtener capitulo por numero y obra
    async def get_chapter_by_number(self, work_id: int, chapter_number: Decimal) -> Optional[Chapter]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    """
                    SELECT c.*, u.username AS translator_username
                    FROM chapters c
                    LEFT JOIN users u ON u.id = c.translator_user_id
                    WHERE c.work_id = %s AND c.chapter_number = %s
                    """,
                    (work_id, chapter_number),
                )
                row = await cur.fetchone()
                return Chapter(**row) if row else None

    # listar capitulos de la obra
    async def get_chapters(
        self,
        work_id: int,
        published_only: bool = False,
        order: str = "asc",
    ) -> List[Chapter]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                where_clause = "WHERE c.work_id = %s"
                if published_only:
                    where_clause += " AND c.status = 'PUBLISHED'"
                order_dir = "DESC" if order.lower() == "desc" else "ASC"
                await cur.execute(
                    f"""
                    SELECT c.*, u.username AS translator_username
                    FROM chapters c
                    LEFT JOIN users u ON u.id = c.translator_user_id
                    {where_clause}
                    ORDER BY c.chapter_number {order_dir}
                    """,
                    (work_id,),
                )
                rows = await cur.fetchall()
                return [Chapter(**row) for row in rows]

    # obtener datos completos para el visor de capítulos (1 solo viaje a base de datos)
    async def get_chapter_reader_data(
        self,
        chapter_id: Optional[int] = None,
        work_slug: Optional[str] = None,
        chapter_number: Optional[Decimal] = None,
        user_id: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                chapter_row = None
                work_row = None

                # 1. Resolver por chapter_id si fue provisto
                if chapter_id:
                    await cur.execute(
                        """
                        SELECT c.id, c.work_id, c.scan_group_id, c.chapter_number, c.title, c.slug, c.status,
                               c.translator_user_id, c.reward_coins, c.published_at,
                               u.username AS translator_username,
                               sg.name AS scan_group_name,
                               w.id AS w_id, w.title AS w_title, w.slug AS w_slug,
                               w.cover_url AS w_cover_url, w.banner_url AS w_banner_url, w.author AS w_author
                        FROM chapters c
                        JOIN works w ON w.id = c.work_id
                        LEFT JOIN users u ON u.id = c.translator_user_id
                        LEFT JOIN scan_groups sg ON sg.id = c.scan_group_id
                        WHERE c.id = %s
                        """,
                        (chapter_id,),
                    )
                    joined_row = await cur.fetchone()
                    if joined_row:
                        chapter_row = {
                            "id": joined_row["id"],
                            "work_id": joined_row["work_id"],
                            "scan_group_id": joined_row["scan_group_id"],
                            "scan_group_name": joined_row["scan_group_name"],
                            "chapter_number": joined_row["chapter_number"],
                            "title": joined_row["title"],
                            "slug": joined_row["slug"],
                            "status": joined_row["status"],
                            "translator_user_id": joined_row["translator_user_id"],
                            "translator_username": joined_row["translator_username"],
                            "reward_coins": joined_row["reward_coins"],
                            "published_at": joined_row["published_at"],
                        }
                        work_row = {
                            "id": joined_row["w_id"],
                            "title": joined_row["w_title"],
                            "slug": joined_row["w_slug"],
                            "cover_url": joined_row["w_cover_url"],
                            "banner_url": joined_row["w_banner_url"],
                            "author": joined_row["w_author"],
                        }

                # 2. Si no se resolvió por chapter_id, intentar resolver vía work_slug (+ chapter_number opcional)
                if not chapter_row and work_slug:
                    await cur.execute(
                        """
                        SELECT id, title, slug, cover_url, banner_url, author
                        FROM works
                        WHERE slug = %s
                        """,
                        (work_slug,),
                    )
                    work_row = await cur.fetchone()
                    if not work_row:
                        return None

                    if chapter_number is not None:
                        await cur.execute(
                            """
                            SELECT c.id, c.work_id, c.scan_group_id, c.chapter_number, c.title, c.slug, c.status,
                                   c.translator_user_id, c.reward_coins, c.published_at,
                                   u.username AS translator_username,
                                   sg.name AS scan_group_name
                            FROM chapters c
                            LEFT JOIN users u ON u.id = c.translator_user_id
                            LEFT JOIN scan_groups sg ON sg.id = c.scan_group_id
                            WHERE c.work_id = %s AND c.chapter_number = %s
                            LIMIT 1
                            """,
                            (work_row["id"], chapter_number),
                        )
                        chapter_row = await cur.fetchone()

                    # Fallback al primer capítulo publicado si no se encontró el número exacto o no se especificó
                    if not chapter_row:
                        await cur.execute(
                            """
                            SELECT c.id, c.work_id, c.scan_group_id, c.chapter_number, c.title, c.slug, c.status,
                                   c.translator_user_id, c.reward_coins, c.published_at,
                                   u.username AS translator_username,
                                   sg.name AS scan_group_name
                            FROM chapters c
                            LEFT JOIN users u ON u.id = c.translator_user_id
                            LEFT JOIN scan_groups sg ON sg.id = c.scan_group_id
                            WHERE c.work_id = %s AND c.status = 'PUBLISHED'
                            ORDER BY c.chapter_number ASC
                            LIMIT 1
                            """,
                            (work_row["id"],),
                        )
                        chapter_row = await cur.fetchone()

                if not chapter_row or not work_row:
                    return None

                resolved_chapter_id = chapter_row["id"]
                resolved_work_id = work_row["id"]

                # 3. Consultar páginas ordenadas
                await cur.execute(
                    """
                    SELECT id, chapter_id, image_url, order_number
                    FROM chapter_images
                    WHERE chapter_id = %s
                    ORDER BY order_number ASC
                    """,
                    (resolved_chapter_id,),
                )
                pages = await cur.fetchall() or []

                # 4. Consultar listado de capítulos publicados de la obra para el selector y navegación
                await cur.execute(
                    """
                    SELECT id, chapter_number, title, slug
                    FROM chapters
                    WHERE work_id = %s AND status = 'PUBLISHED'
                    ORDER BY chapter_number ASC
                    """,
                    (resolved_work_id,),
                )
                navigation_chapters = await cur.fetchall() or []

                prev_chapter_id = None
                next_chapter_id = None
                for idx, item in enumerate(navigation_chapters):
                    if item["id"] == resolved_chapter_id:
                        if idx > 0:
                            prev_chapter_id = navigation_chapters[idx - 1]["id"]
                        if idx < len(navigation_chapters) - 1:
                            next_chapter_id = navigation_chapters[idx + 1]["id"]
                        break

                # 5. Consultar estado del usuario si está autenticado
                user_state = {
                    "is_read": False,
                    "in_library": False,
                    "last_page_read": 1,
                    "has_higher_chapter_read": False,
                }

                if user_id:
                    await cur.execute(
                        """
                        SELECT
                            EXISTS(SELECT 1 FROM user_read_chapters WHERE user_id = %s AND chapter_id = %s) AS is_read,
                            EXISTS(SELECT 1 FROM user_library WHERE user_id = %s AND work_id = %s) AS in_library,
                            EXISTS(
                                SELECT 1 FROM user_read_chapters urc
                                JOIN chapters c ON c.id = urc.chapter_id
                                WHERE urc.user_id = %s AND urc.work_id = %s AND c.chapter_number > %s
                            ) AS has_higher_read,
                            (
                                SELECT CASE WHEN rh.chapter_id = %s THEN rh.last_page_read ELSE 1 END
                                FROM reading_history rh
                                WHERE rh.user_id = %s AND rh.work_id = %s
                                LIMIT 1
                            ) AS last_page_read
                        """,
                        (user_id, resolved_chapter_id, user_id, resolved_work_id, user_id, resolved_work_id, chapter_row["chapter_number"], resolved_chapter_id, user_id, resolved_work_id),
                    )
                    state_row = await cur.fetchone()
                    if state_row:
                        user_state["is_read"] = bool(state_row["is_read"])
                        user_state["in_library"] = bool(state_row["in_library"])
                        user_state["has_higher_chapter_read"] = bool(state_row["has_higher_read"])
                        user_state["last_page_read"] = state_row["last_page_read"] or 1

                    # Si el capítulo ya fue completado o superado, la relectura arranca en página 1
                    if user_state["is_read"] or user_state["has_higher_chapter_read"]:
                        user_state["last_page_read"] = 1

                return {
                    "chapter": chapter_row,
                    "work": work_row,
                    "pages": pages,
                    "navigation": {
                        "prev_chapter_id": prev_chapter_id,
                        "next_chapter_id": next_chapter_id,
                        "chapters": navigation_chapters,
                    },
                    "user_state": user_state,
                }

    # crear capitulo y actualizar estadisticas de obra
    async def create_chapter(self, chapter: Chapter) -> Chapter:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                query = """
                    INSERT INTO chapters (
                        work_id, chapter_number, title, slug,
                        scan_group_id, status, translator_user_id,
                        reward_coins, published_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                values = (
                    chapter.work_id,
                    chapter.chapter_number,
                    chapter.title,
                    chapter.slug,
                    chapter.scan_group_id,
                    chapter.status,
                    chapter.translator_user_id,
                    chapter.reward_coins,
                    chapter.published_at,
                )
                await cur.execute(query, values)
                chapter.id = cur.lastrowid

                if chapter.status == "PUBLISHED":
                    await cur.execute(
                        """
                        UPDATE work_statistics
                        SET latest_chapter_id = %s,
                            latest_chapter_number = %s,
                            last_published_at = %s,
                            first_chapter_id = COALESCE(first_chapter_id, %s)
                        WHERE work_id = %s
                          AND (%s >= COALESCE(latest_chapter_number, -1))
                        """,
                        (
                            chapter.id,
                            chapter.chapter_number,
                            chapter.published_at,
                            chapter.id,
                            chapter.work_id,
                            chapter.chapter_number,
                        ),
                    )

                if self.conn is None:
                    await conn.commit()
                return chapter

    # actualizar datos de capitulo
    async def update_chapter(self, chapter: Chapter) -> Chapter:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                query = """
                    UPDATE chapters
                    SET chapter_number = %s,
                        title = %s,
                        slug = %s,
                        scan_group_id = %s,
                        status = %s,
                        translator_user_id = %s,
                        reward_coins = %s,
                        published_at = %s
                    WHERE id = %s
                """
                values = (
                    chapter.chapter_number,
                    chapter.title,
                    chapter.slug,
                    chapter.scan_group_id,
                    chapter.status,
                    chapter.translator_user_id,
                    chapter.reward_coins,
                    chapter.published_at,
                    chapter.id,
                )
                await cur.execute(query, values)
                if self.conn is None:
                    await conn.commit()
        return chapter

    # eliminar capitulo por id
    async def delete_chapter(self, chapter_id: int) -> bool:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM chapters WHERE id = %s", (chapter_id,))
                if self.conn is None:
                    await conn.commit()
        return True

    # --------------------------------------------------------------------------
    # Gestión de Borradores de Traducción (Submissions)
    # --------------------------------------------------------------------------
    # registrar propuesta o borrador de traduccion
    async def create_submission(
        self,
        chapter_id: int,
        user_id: int,
        content_url: str,
        page_count: int,
        notes: Optional[str] = None,
    ) -> int:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                query = """
                    INSERT INTO chapter_submissions (
                        chapter_id, user_id, content_url, page_count, notes
                    )
                    VALUES (%s, %s, %s, %s, %s)
                """
                await cur.execute(query, (chapter_id, user_id, content_url, page_count, notes))
                sub_id = cur.lastrowid
                if self.conn is None:
                    await conn.commit()
                return sub_id

    # listar borradores de traduccion del capitulo
    async def list_submissions(
        self,
        chapter_id: int,
        status_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                where = "WHERE s.chapter_id = %s"
                params: list[Any] = [chapter_id]
                if status_filter:
                    where += " AND s.status = %s"
                    params.append(status_filter.upper())
                await cur.execute(
                    f"""
                    SELECT s.*, u.username, u.avatar_url
                    FROM chapter_submissions s
                    JOIN users u ON u.id = s.user_id
                    {where}
                    ORDER BY s.created_at DESC
                    """,
                    tuple(params),
                )
                return await cur.fetchall() or []

    # obtener propuesta de traduccion por id
    async def get_submission(self, submission_id: int) -> Optional[Dict[str, Any]]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    """
                    SELECT s.*, u.username, u.avatar_url
                    FROM chapter_submissions s
                    JOIN users u ON u.id = s.user_id
                    WHERE s.id = %s
                    """,
                    (submission_id,),
                )
                return await cur.fetchone()

    # aprobar borrador, asignar traductor y recompensar con monedas y xp
    async def approve_submission(
        self,
        submission_id: int,
        reviewer_id: int,
        reward_coins_override: Optional[int] = None,
    ) -> Dict[str, Any]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT * FROM chapter_submissions WHERE id = %s FOR UPDATE", (submission_id,))
                sub = await cur.fetchone()
                if not sub:
                    raise ValueError("Borrador no encontrado")
                if sub["status"] == "APPROVED":
                    raise ValueError("Este borrador ya fue aprobado")

                await cur.execute("SELECT * FROM chapters WHERE id = %s FOR UPDATE", (sub["chapter_id"],))
                chap = await cur.fetchone()
                if not chap:
                    raise ValueError("Capítulo no encontrado")

                await cur.execute("SELECT id, title, slug FROM works WHERE id = %s", (chap["work_id"],))
                work = await cur.fetchone() or {"title": "Obra", "slug": ""}

                reward = reward_coins_override if reward_coins_override is not None else chap.get("reward_coins", 50)

                # 1. Aprobar este borrador
                await cur.execute(
                    "UPDATE chapter_submissions SET status = 'APPROVED', reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (reviewer_id, submission_id),
                )

                # 2. Rechazar los demás borradores pendientes del mismo capítulo
                await cur.execute(
                    """
                    UPDATE chapter_submissions
                    SET status = 'REJECTED',
                        rejection_reason = 'Otro borrador fue aprobado para este capítulo',
                        reviewed_by = %s,
                        reviewed_at = CURRENT_TIMESTAMP
                    WHERE chapter_id = %s AND id != %s AND status = 'PENDING'
                    """,
                    (reviewer_id, sub["chapter_id"], submission_id),
                )

                # 3. Asignar traductor al capítulo
                await cur.execute(
                    "UPDATE chapters SET translator_user_id = %s WHERE id = %s",
                    (sub["user_id"], sub["chapter_id"]),
                )

                # 4. Abonar monedas y XP al usuario
                await cur.execute("SELECT coins, xp FROM users WHERE id = %s FOR UPDATE", (sub["user_id"],))
                user = await cur.fetchone()
                if user:
                    new_coins = user["coins"] + reward
                    new_xp = user["xp"] + 50
                    await cur.execute(
                        "UPDATE users SET coins = %s, xp = %s WHERE id = %s",
                        (new_coins, new_xp, sub["user_id"]),
                    )

                    # 5. Registrar en historial de transacciones
                    desc = f"Recompensa por traducción: {work['title']} Cap. {chap['chapter_number']}"
                    await cur.execute(
                        """
                        INSERT INTO user_coin_transactions (user_id, amount, balance_after, type, description, reference_id)
                        VALUES (%s, %s, %s, 'TRANSLATION_REWARD', %s, %s)
                        """,
                        (sub["user_id"], reward, new_coins, desc, chap["id"]),
                    )

                    # 6. Notificación al usuario
                    payload_json = to_json_safe({
                        "title": "¡Traducción Aprobada! 🎉",
                        "message": f"Tu traducción del Cap. {chap['chapter_number']} de '{work['title']}' fue aprobada. Recibiste +{reward} Ghost Monedas.",
                        "coins": reward,
                        "work_id": work.get("id"),
                        "chapter_id": chap["id"],
                        "url": f"/comic/{work.get('slug')}/{chap.get('slug')}",
                    })
                    await cur.execute(
                        "INSERT INTO notifications (user_id, type, payload) VALUES (%s, 'TRANSLATION_APPROVED', %s)",
                        (sub["user_id"], payload_json),
                    )

                if self.conn is None:
                    await conn.commit()

                return {
                    "id": submission_id,
                    "status": "APPROVED",
                    "reward_coins": reward,
                    "translator_user_id": sub["user_id"],
                    "message": f"Borrador aprobado con éxito. Se otorgaron +{reward} monedas al traductor.",
                }

    # rechazar borrador con motivo explicativo
    async def reject_submission(
        self,
        submission_id: int,
        reviewer_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT * FROM chapter_submissions WHERE id = %s FOR UPDATE", (submission_id,))
                sub = await cur.fetchone()
                if not sub:
                    raise ValueError("Borrador no encontrado")

                rejection_text = reason or "El borrador no cumplió con los estándares de traducción del grupo."
                await cur.execute(
                    "UPDATE chapter_submissions SET status = 'REJECTED', rejection_reason = %s, reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (rejection_text, reviewer_id, submission_id),
                )

                await cur.execute("SELECT chapter_number FROM chapters WHERE id = %s", (sub["chapter_id"],))
                chap = await cur.fetchone()
                payload_json = to_json_safe({
                    "title": "Borrador de traducción no aprobado",
                    "message": f"Tu propuesta para el capítulo {chap['chapter_number'] if chap else ''} no fue aceptada: {rejection_text}",
                    "chapter_id": sub["chapter_id"],
                })
                await cur.execute(
                    "INSERT INTO notifications (user_id, type, payload) VALUES (%s, 'TRANSLATION_REJECTED', %s)",
                    (sub["user_id"], payload_json),
                )

                if self.conn is None:
                    await conn.commit()

                return {"id": submission_id, "status": "REJECTED", "reason": rejection_text}


class ChapterImageRepository:
    def __init__(self, conn: Optional[aiomysql.Connection] = None):
        self.conn = conn

    # obtener imagenes ordenadas del capitulo
    async def get_chapter_images(self, chapter_id: int) -> List[ChapterImage]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    "SELECT * FROM chapter_images WHERE chapter_id = %s ORDER BY order_number ASC",
                    (chapter_id,),
                )
                rows = await cur.fetchall()
                return [ChapterImage(**row) for row in rows]

    # registrar lote de imagenes del capitulo
    async def create_chapter_images(self, images: List[ChapterImage]) -> List[ChapterImage]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                query = """
                    INSERT INTO chapter_images (chapter_id, image_url, order_number)
                    VALUES (%s, %s, %s)
                """
                values = [(img.chapter_id, img.image_url, img.order_number) for img in images]
                await cur.executemany(query, values)
                if self.conn is None:
                    await conn.commit()
        return images

    # reemplazar todas las imagenes del capitulo
    async def replace_chapter_images(self, chapter_id: int, images: List[ChapterImage]) -> List[ChapterImage]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM chapter_images WHERE chapter_id = %s", (chapter_id,))
                if images:
                    query = """
                        INSERT INTO chapter_images (chapter_id, image_url, order_number)
                        VALUES (%s, %s, %s)
                    """
                    values = [(img.chapter_id, img.image_url, img.order_number) for img in images]
                    await cur.executemany(query, values)
            if self.conn is None:
                await conn.commit()
            return images

    # eliminar imagenes del capitulo
    async def delete_chapter_images(self, chapter_id: int) -> bool:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM chapter_images WHERE chapter_id = %s", (chapter_id,))
                if self.conn is None:
                    await conn.commit()
        return True
