from typing import Any, Dict, List, Optional
import aiomysql

from app.core.database import resolve_connection


class CommentRepository:
    def __init__(self, conn: Optional[aiomysql.Connection] = None):
        self.conn = conn

    # listar comentarios visibles con conteo de likes y dislikes
    async def list_comments(
        self, work_id: int, chapter_id: Optional[int], limit: int, current_user_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        chapter_filter = "AND c.chapter_id = %s" if chapter_id else "AND c.chapter_id IS NULL"
        user_select = ", MAX(CASE WHEN cr.user_id = %s AND cr.reaction = 'LIKE' THEN 1 ELSE 0 END) AS user_liked" if current_user_id else ", 0 AS user_liked"

        if current_user_id:
            values = (current_user_id, work_id, chapter_id, limit) if chapter_id else (current_user_id, work_id, limit)
        else:
            values = (work_id, chapter_id, limit) if chapter_id else (work_id, limit)

        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    f"""
                    SELECT c.id, c.work_id, c.chapter_id, c.parent_id, c.reply_to_username, c.content, c.contains_spoiler,
                           c.created_at, c.updated_at, u.id AS user_id, u.username, u.avatar_url,
                           u.avatar_frame_url, u.avatar_frame_url AS anillo_url,
                           COALESCE(SUM(CASE WHEN cr.reaction = 'LIKE' THEN 1 ELSE 0 END), 0) AS likes,
                           COALESCE(SUM(CASE WHEN cr.reaction = 'DISLIKE' THEN 1 ELSE 0 END), 0) AS dislikes
                           {user_select}
                    FROM comments c
                    JOIN users u ON u.id = c.user_id
                    LEFT JOIN comment_reactions cr ON cr.comment_id = c.id
                    WHERE c.work_id = %s AND c.status = 'VISIBLE' {chapter_filter}
                    GROUP BY c.id, u.id
                    ORDER BY c.created_at DESC LIMIT %s
                    """,
                    values,
                )
                return await cur.fetchall()

    # obtener estado y dueno del comentario
    async def get_comment(self, comment_id: int) -> Optional[Dict[str, Any]]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    "SELECT id, user_id, status FROM comments WHERE id = %s",
                    (comment_id,),
                )
                return await cur.fetchone()

    # verificar si el capitulo publicado existe
    async def check_chapter_exists(self, chapter_id: int, work_id: int) -> bool:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT 1 FROM chapters WHERE id = %s AND work_id = %s AND status = 'PUBLISHED'",
                    (chapter_id, work_id),
                )
                return await cur.fetchone() is not None

    # verificar si el comentario padre existe
    async def check_parent_exists(
        self, parent_id: int, work_id: int, chapter_id: Optional[int]
    ) -> bool:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT 1 FROM comments WHERE id = %s AND work_id = %s AND chapter_id <=> %s",
                    (parent_id, work_id, chapter_id),
                )
                return await cur.fetchone() is not None

    # registrar nuevo comentario
    async def create_comment(
        self,
        work_id: int,
        chapter_id: Optional[int],
        user_id: int,
        parent_id: Optional[int],
        reply_to_username: Optional[str],
        content: str,
        contains_spoiler: bool,
    ) -> int:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO comments (work_id, chapter_id, user_id, parent_id, reply_to_username, content, contains_spoiler)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (work_id, chapter_id, user_id, parent_id, reply_to_username, content, contains_spoiler),
                )
                return cur.lastrowid

    # actualizar contenido de comentario
    async def update_comment(
        self, comment_id: int, content: str, contains_spoiler: bool
    ) -> None:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "UPDATE comments SET content = %s, contains_spoiler = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (content, contains_spoiler, comment_id),
                )

    # marcar comentario como eliminado
    async def delete_comment(self, comment_id: int) -> None:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "UPDATE comments SET status = 'DELETED', content = '' WHERE id = %s",
                    (comment_id,),
                )

    # guardar o alternar reaccion (toggle like/dislike)
    async def toggle_reaction(self, comment_id: int, user_id: int, reaction: str) -> Dict[str, Any]:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT reaction FROM comment_reactions WHERE comment_id = %s AND user_id = %s",
                    (comment_id, user_id),
                )
                existing = await cur.fetchone()
                if existing and existing[0] == reaction:
                    # Se quita la reaccion (toggle off)
                    await cur.execute(
                        "DELETE FROM comment_reactions WHERE comment_id = %s AND user_id = %s",
                        (comment_id, user_id),
                    )
                    action = "REMOVED"
                else:
                    # Se inserta o actualiza
                    await cur.execute(
                        """
                        INSERT INTO comment_reactions (comment_id, user_id, reaction)
                        VALUES (%s, %s, %s)
                        ON DUPLICATE KEY UPDATE reaction = VALUES(reaction)
                        """,
                        (comment_id, user_id, reaction),
                    )
                    action = "ADDED"

                # Obtener conteo actualizado de likes
                await cur.execute(
                    "SELECT COUNT(*) FROM comment_reactions WHERE comment_id = %s AND reaction = 'LIKE'",
                    (comment_id,),
                )
                likes_row = await cur.fetchone()
                likes = likes_row[0] if likes_row else 0

                return {
                    "comment_id": comment_id,
                    "action": action,
                    "likes": likes,
                    "user_liked": 1 if action == "ADDED" and reaction == "LIKE" else 0,
                }

    # verificar si ya existe reporte pendiente
    async def has_pending_report(self, reporter_user_id: int, comment_id: int) -> bool:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT id FROM content_reports
                    WHERE reporter_user_id = %s AND entity_type = 'COMMENT' AND entity_id = %s
                      AND status IN ('OPEN', 'REVIEWING')
                    LIMIT 1
                    """,
                    (reporter_user_id, comment_id),
                )
                return await cur.fetchone() is not None

    # enviar reporte sobre un comentario
    async def create_report(
        self, reporter_user_id: int, comment_id: int, reason: str, details: Optional[str]
    ) -> int:
        async with resolve_connection(self.conn) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO content_reports (reporter_user_id, entity_type, entity_id, reason, details)
                    VALUES (%s, 'COMMENT', %s, %s, %s)
                    """,
                    (reporter_user_id, comment_id, reason, details),
                )
                return cur.lastrowid
