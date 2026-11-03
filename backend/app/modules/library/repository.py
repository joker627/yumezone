from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional, List, Tuple
import aiomysql

from app.core.database import resolve_connection
from app.utils import format_chapter_number


class LibraryRepository:
    def __init__(self, conn: Optional[aiomysql.Connection] = None):
        self.conn = conn

    @asynccontextmanager
    async def _cursor(self, cursor_cls=None) -> AsyncGenerator[Tuple[aiomysql.Connection, aiomysql.Cursor], None]:
        async with resolve_connection(self.conn) as conn:
            if cursor_cls:
                async with conn.cursor(cursor_cls) as cur:
                    yield conn, cur
            else:
                async with conn.cursor() as cur:
                    yield conn, cur

    async def _commit_if_needed(self, conn: aiomysql.Connection) -> None:
        if self.conn is None:
            await conn.commit()

    # obtener preferencia de notificaciones
    async def get_notification_preference(
        self, user_id: int, work_id: int
    ) -> Optional[bool]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute(
                """
                SELECT notify_new_chapters
                FROM user_library
                WHERE user_id = %s AND work_id = %s
                """,
                (user_id, work_id),
            )
            row = await cur.fetchone()
            return bool(row["notify_new_chapters"]) if row else None

    async def list_for_user(
        self, user_id: int, work_id: Optional[int] = None
    ) -> list[dict]:
        status_filter = " AND ul.status IS NOT NULL" if work_id is None else ""
        work_filter = " AND w.id = %s" if work_id is not None else ""
        values = (user_id, work_id) if work_id is not None else (user_id,)
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute(
                f"""
                SELECT w.id, w.title, w.slug, w.alternative_title, w.synopsis,
                       w.author, w.cover_url, w.banner_url, w.status_id,
                       w.format_id, w.demographic_id, w.scan_group_id,
                       COALESCE(ws.total_views, 0) AS total_views,
                       COALESCE(ws.rating_average, 0) AS rating_average,
                       COALESCE(ws.rating_count, 0) AS rating_count,
                       COALESCE(ws.favorites_count, 0) AS favorites_count,
                       COALESCE(ws.trending_score, 0) AS trending_score,
                       ws.first_chapter_id,
                       ul.status AS library_status,
                       ul.rating,
                       COALESCE(ul.notify_new_chapters, FALSE) AS notify_new_chapters,
                       COALESCE(ul.added_at, rh.read_at) AS added_at,
                       rh.chapter_id AS last_chapter_id,
                       rh_c.chapter_number AS last_chapter_number,
                       rh.last_page_read,
                       rh.read_at AS last_read_at,
                       COALESCE(ws.chapters_count, 0) AS total_published_chapters,
                       COALESCE((
                           SELECT COUNT(DISTINCT urc.chapter_id)
                           FROM user_read_chapters AS urc
                           WHERE urc.user_id = ul.user_id AND urc.work_id = w.id
                       ), 0) AS read_chapters_count
                FROM user_library AS ul
                JOIN works AS w ON w.id = ul.work_id
                LEFT JOIN reading_history AS rh ON rh.user_id = ul.user_id AND rh.work_id = w.id
                LEFT JOIN chapters AS rh_c ON rh_c.id = rh.chapter_id
                LEFT JOIN work_statistics AS ws ON ws.work_id = w.id
                WHERE ul.user_id = %s{status_filter}{work_filter}
                ORDER BY COALESCE(rh.read_at, ul.added_at) DESC
                """,
                values,
            )
            rows = await cur.fetchall() or []
            items = []
            for r in rows:
                total_chaps = int(r.get("total_published_chapters") or 0)
                read_chaps = int(r.get("read_chapters_count") or 0)
                remaining = max(0, total_chaps - read_chaps)
                progress_pct = round((read_chaps / total_chaps) * 100) if total_chaps > 0 else 0

                reading_progress = None
                if r.get("last_chapter_id") or read_chaps > 0:
                    chap_num = float(r["last_chapter_number"]) if r.get("last_chapter_number") is not None else 1.0
                    chap_str = format_chapter_number(chap_num)
                    last_page = int(r.get("last_page_read") or 1)
                    reading_progress = {
                        "chapter_id": r.get("last_chapter_id") or r.get("first_chapter_id") or 0,
                        "chapter_number": chap_num,
                        "chapter_text": f"Cap. {chap_str}",
                        "last_page_read": last_page,
                        "total_pages": 1,
                        "read_chapters": read_chaps,
                        "total_chapters": total_chaps,
                        "remaining_chapters": remaining,
                        "page_text": f"{read_chaps}/{total_chaps} leídos" if total_chaps > 0 else "",
                        "progress_pct": progress_pct,
                        "read_at": r.get("last_read_at"),
                        "reader_url": (
                            f"/pages/leer.html?obra={r['slug']}&capitulo={chap_str}&chapter_id={r['last_chapter_id']}"
                            if r.get("last_chapter_id")
                            else f"/pages/leer.html?obra={r['slug']}&chapter_id={r.get('first_chapter_id')}"
                        ),
                    }
                raw_status = r.get("library_status")
                if raw_status in ("FAVORITE", "FOLLOWING", "LIKED"):
                    raw_status = "READING"
                elif raw_status == "READ_LATER":
                    raw_status = "PLAN_TO_READ"
                elif raw_status == "PAUSED":
                    raw_status = "ON_HOLD"
                r["library_status"] = raw_status
                r["reading_progress"] = reading_progress
                items.append(r)
            return items

    async def get_for_user(self, user_id: int, work_id: int) -> Optional[dict]:
        items = await self.list_for_user(user_id, work_id)
        return items[0] if items else None

    async def work_exists(self, work_id: int) -> bool:
        async with self._cursor() as (conn, cur):
            await cur.execute("SELECT 1 FROM works WHERE id = %s", (work_id,))
            return await cur.fetchone() is not None

    async def add_work(self, user_id: int, work_id: int, status: str = "READING") -> None:
        notify = status != "DROPPED"
        async with self._cursor() as (conn, cur):
            await cur.execute(
                """
                INSERT INTO user_library (user_id, work_id, status, notify_new_chapters)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE status = VALUES(status), notify_new_chapters = VALUES(notify_new_chapters)
                """,
                (user_id, work_id, status, notify),
            )
            await cur.execute(
                """
                UPDATE work_statistics
                SET favorites_count = (SELECT COUNT(*) FROM user_library WHERE work_id = %s AND status IS NOT NULL AND status != 'DROPPED')
                WHERE work_id = %s
                """,
                (work_id, work_id),
            )
            await self._commit_if_needed(conn)

    async def update_status(self, user_id: int, work_id: int, status: str) -> bool:
        notify = status != "DROPPED"
        async with self._cursor() as (conn, cur):
            await cur.execute("SELECT 1 FROM works WHERE id = %s", (work_id,))
            if not await cur.fetchone():
                return False
            await cur.execute(
                """
                INSERT INTO user_library (user_id, work_id, status, notify_new_chapters)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE status = VALUES(status), notify_new_chapters = VALUES(notify_new_chapters)
                """,
                (user_id, work_id, status, notify),
            )
            await cur.execute(
                """
                UPDATE work_statistics
                SET favorites_count = (SELECT COUNT(*) FROM user_library WHERE work_id = %s AND status IS NOT NULL AND status != 'DROPPED')
                WHERE work_id = %s
                """,
                (work_id, work_id),
            )
            await self._commit_if_needed(conn)
            return True

    async def remove_work(self, user_id: int, work_id: int) -> bool:
        async with self._cursor() as (conn, cur):
            # Si tiene calificación (rating), conservamos la fila limpiando el estado de biblioteca
            await cur.execute(
                """
                UPDATE user_library
                SET status = NULL, notify_new_chapters = FALSE
                WHERE user_id = %s AND work_id = %s AND rating IS NOT NULL
                """,
                (user_id, work_id),
            )
            updated_rating = cur.rowcount

            # Si no tenía calificación, eliminamos la fila por completo
            await cur.execute(
                """
                DELETE FROM user_library
                WHERE user_id = %s AND work_id = %s AND rating IS NULL
                """,
                (user_id, work_id),
            )
            deleted_lib = cur.rowcount + updated_rating

            await cur.execute(
                """
                UPDATE work_statistics
                SET favorites_count = (SELECT COUNT(*) FROM user_library WHERE work_id = %s AND status IS NOT NULL AND status != 'DROPPED')
                WHERE work_id = %s
                """,
                (work_id, work_id),
            )
            await self._commit_if_needed(conn)
            return deleted_lib > 0

    async def update_notification_preference(
        self, user_id: int, work_id: int, notify_new_chapters: bool
    ) -> bool:
        async with self._cursor() as (conn, cur):
            await cur.execute(
                """
                UPDATE user_library
                SET notify_new_chapters = %s
                WHERE user_id = %s AND work_id = %s
                """,
                (notify_new_chapters, user_id, work_id),
            )
            await self._commit_if_needed(conn)
            if cur.rowcount > 0:
                return True
            await cur.execute(
                """
                SELECT 1
                FROM user_library
                WHERE user_id = %s AND work_id = %s
                """,
                (user_id, work_id),
            )
            return await cur.fetchone() is not None

    async def save_reading_history(
        self, user_id: int, work_id: int, chapter_id: int, page: int = 1, completed: bool = False
    ) -> None:
        async with self._cursor() as (conn, cur):
            if completed:
                await cur.execute(
                    """
                    INSERT INTO user_read_chapters (user_id, work_id, chapter_id)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP
                    """,
                    (user_id, work_id, chapter_id),
                )
                await cur.execute(
                    """
                    INSERT INTO user_library (user_id, work_id, status, notify_new_chapters)
                    VALUES (%s, %s, 'READING', TRUE)
                    ON DUPLICATE KEY UPDATE
                        status = IF(status IS NULL OR status IN ('PLAN_TO_READ', 'ON_HOLD'), 'READING', status),
                        notify_new_chapters = TRUE
                    """,
                    (user_id, work_id),
                )

            await cur.execute(
                """
                INSERT INTO reading_history (user_id, work_id, chapter_id, last_page_read)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    chapter_id = VALUES(chapter_id),
                    last_page_read = VALUES(last_page_read),
                    read_at = CURRENT_TIMESTAMP
                """,
                (user_id, work_id, chapter_id, page or 1),
            )
            await self._commit_if_needed(conn)

    async def get_user_read_chapters(self, user_id: int, work_id: int) -> List[int]:
        async with self._cursor() as (conn, cur):
            await cur.execute(
                """
                SELECT chapter_id
                FROM user_read_chapters
                WHERE user_id = %s AND work_id = %s
                """,
                (user_id, work_id),
            )
            rows = await cur.fetchall()
            return [int(r[0]) for r in rows]

    async def toggle_chapter_read(self, user_id: int, chapter_id: int) -> dict:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute("SELECT work_id, chapter_number FROM chapters WHERE id = %s", (chapter_id,))
            ch = await cur.fetchone()
            if not ch:
                raise ValueError("Capítulo no encontrado")
            work_id = int(ch["work_id"])

            await cur.execute(
                "SELECT 1 FROM user_read_chapters WHERE user_id = %s AND chapter_id = %s",
                (user_id, chapter_id),
            )
            already_read = await cur.fetchone() is not None

            if already_read:
                await cur.execute(
                    "DELETE FROM user_read_chapters WHERE user_id = %s AND chapter_id = %s",
                    (user_id, chapter_id),
                )
                is_read = False
            else:
                await cur.execute(
                    """
                    INSERT INTO user_read_chapters (user_id, work_id, chapter_id)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP
                    """,
                    (user_id, work_id, chapter_id),
                )
                is_read = True

            # Recalcular el capítulo leído más avanzado para actualizar reading_history al último leído
            await cur.execute(
                """
                SELECT c.id
                FROM user_read_chapters urc
                JOIN chapters c ON c.id = urc.chapter_id
                WHERE urc.user_id = %s AND urc.work_id = %s
                ORDER BY c.chapter_number DESC, c.id DESC
                LIMIT 1
                """,
                (user_id, work_id),
            )
            latest_read = await cur.fetchone()
            if latest_read:
                latest_id = int(latest_read["id"])
                await cur.execute(
                    """
                    INSERT INTO reading_history (user_id, work_id, chapter_id, last_page_read)
                    VALUES (%s, %s, %s, 1)
                    ON DUPLICATE KEY UPDATE
                        chapter_id = %s,
                        read_at = CURRENT_TIMESTAMP
                    """,
                    (user_id, work_id, latest_id, latest_id),
                )

            await self._commit_if_needed(conn)

            await cur.execute(
                "SELECT COUNT(*) as cnt FROM user_read_chapters WHERE user_id = %s AND work_id = %s",
                (user_id, work_id),
            )
            cnt_row = await cur.fetchone()
            read_count = int(cnt_row["cnt"]) if cnt_row else 0

            return {
                "chapter_id": chapter_id,
                "work_id": work_id,
                "is_read": is_read,
                "read_count": read_count,
            }

    async def get_chapter_page_count(self, work_id: int, chapter_id: int) -> Optional[int]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute(
                """
                SELECT COUNT(ci.id) AS total_pages
                FROM chapters AS c
                LEFT JOIN chapter_images AS ci ON ci.chapter_id = c.id
                WHERE c.id = %s AND c.work_id = %s
                GROUP BY c.id
                """,
                (chapter_id, work_id),
            )
            row = await cur.fetchone()
            return int(row["total_pages"]) if row is not None else None

    async def set_work_rating(self, user_id: int, work_id: int, rating: float) -> dict:
        async with self._cursor() as (conn, cur):
            await cur.execute(
                """
                INSERT INTO user_library (user_id, work_id, status, rating)
                VALUES (%s, %s, NULL, %s)
                ON DUPLICATE KEY UPDATE rating = VALUES(rating)
                """,
                (user_id, work_id, rating),
            )
            await cur.execute(
                """
                INSERT INTO work_statistics (work_id, rating_average, rating_count)
                VALUES (%s, %s, 1)
                ON DUPLICATE KEY UPDATE
                    rating_average = (SELECT ROUND(AVG(ul.rating), 2) FROM user_library AS ul WHERE ul.work_id = %s AND ul.rating IS NOT NULL),
                    rating_count = (SELECT COUNT(ul.rating) FROM user_library AS ul WHERE ul.work_id = %s AND ul.rating IS NOT NULL)
                """,
                (work_id, rating, work_id, work_id),
            )
            await self._commit_if_needed(conn)

        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute(
                """
                SELECT COALESCE(rating_average, 0.0) AS rating_average,
                       COALESCE(rating_count, 0) AS rating_count
                FROM work_statistics
                WHERE work_id = %s
                """,
                (work_id,),
            )
            row = await cur.fetchone() or {"rating_average": rating, "rating_count": 1}
            return {
                "work_id": work_id,
                "user_rating": float(rating),
                "rating_average": float(row["rating_average"]),
                "rating_count": int(row["rating_count"]),
            }

    async def get_user_work_rating(self, user_id: int, work_id: int) -> Optional[float]:
        async with self._cursor(aiomysql.DictCursor) as (conn, cur):
            await cur.execute(
                "SELECT rating FROM user_library WHERE user_id = %s AND work_id = %s",
                (user_id, work_id),
            )
            row = await cur.fetchone()
            if not row or row.get("rating") is None:
                return None
            return float(row["rating"])

    async def mark_all_chapters_read(self, user_id: int, work_id: int, read: bool = True) -> int:
        async with self._cursor() as (conn, cur):
            if not read:
                await cur.execute(
                    "DELETE FROM user_read_chapters WHERE user_id = %s AND work_id = %s",
                    (user_id, work_id),
                )
                affected = cur.rowcount
            else:
                await cur.execute(
                    """
                    INSERT INTO user_read_chapters (user_id, work_id, chapter_id)
                    SELECT %s, c.work_id, c.id
                    FROM chapters c
                    WHERE c.work_id = %s AND c.status = 'PUBLISHED'
                    ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP
                    """,
                    (user_id, work_id),
                )
                affected = cur.rowcount
            await self._commit_if_needed(conn)
            return affected
