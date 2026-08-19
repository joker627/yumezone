# imports externos
import aiomysql
# imports locales
from app.core.database import get_db_pool
from app.modules.chapters.models import Chapter, ChapterImage
from typing import Optional, List

class ChapterRepository:
    # Obtener capítulo por ID
    async def get_chapter(self, chapter_id: int) -> Optional[Chapter]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT * FROM chapters WHERE id = %s", (chapter_id,))
                row = await cur.fetchone()
                if row:
                    return Chapter(**row)
        return None

    # Obtener capítulo por número
    async def get_chapter_by_number(self, work_id: int, chapter_number: float) -> Optional[Chapter]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT * FROM chapters WHERE work_id = %s AND chapter_number = %s", (work_id, chapter_number))
                row = await cur.fetchone()
                if row:
                    return Chapter(**row)
        return None

    # Obtener capítulos de una obra
    async def get_chapters(self, work_id: int) -> List[Chapter]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT * FROM chapters WHERE work_id = %s ORDER BY chapter_number ASC", (work_id,))
                rows = await cur.fetchall()
                return [Chapter(**row) for row in rows]
        return []

    # Crear capítulo
    async def create_chapter(self, chapter: Chapter) -> Chapter:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                query = """
                    INSERT INTO chapters (work_id, chapter_number, title, slug, scan_group_id, status, published_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """
                values = (
                    chapter.work_id, chapter.chapter_number, chapter.title, chapter.slug,
                    chapter.scan_group_id, chapter.status, chapter.published_at
                )
                await cur.execute(query, values)
                await conn.commit()
                return chapter

    # Actualizar capítulo
    async def update_chapter(self, chapter: Chapter) -> Chapter:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                query = """
                    UPDATE chapters 
                    SET chapter_number = %s, title = %s, slug = %s, scan_group_id = %s, status = %s, published_at = %s
                    WHERE id = %s
                """
                values = (
                    chapter.chapter_number, chapter.title, chapter.slug, chapter.scan_group_id, 
                    chapter.status, chapter.published_at, chapter.id
                )
                await cur.execute(query, values)
                await conn.commit()
        return chapter

    async def delete_chapter(self, chapter_id: int) -> bool:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM chapters WHERE id = %s", (chapter_id,))
                await conn.commit()
        return True

class ChapterImageRepository:
    # Obtener imágenes de un capítulo
    async def get_chapter_images(self, chapter_id: int) -> List[ChapterImage]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT * FROM chapter_images WHERE chapter_id = %s ORDER BY order_number ASC", (chapter_id,))
                rows = await cur.fetchall()
                return [ChapterImage(**row) for row in rows]
        return []

    # Crear imágenes de un capítulo
    async def create_chapter_images(self, images: List[ChapterImage]) -> List[ChapterImage]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                query = """
                    INSERT INTO chapter_images (chapter_id, image_url, order_number)
                    VALUES (%s, %s, %s)
                """
                values = [(img.chapter_id, img.image_url, img.order_number) for img in images]
                await cur.executemany(query, values)
                await conn.commit()
        return images

    # Eliminar imágenes de un capítulo
    async def delete_chapter_images(self, chapter_id: int) -> bool:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM chapter_images WHERE chapter_id = %s", (chapter_id,))
                await conn.commit()
        return True
