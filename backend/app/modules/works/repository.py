from typing_extensions import List
from typing import Optional, Tuple
import aiomysql
from app.modules.works.models import Work
from app.core.database import get_db_pool

class WorkRepository:
    # get all the works with pagination
    async def get_all_works(self, page: int = 1, per_page: int = 25) -> Tuple[List[Work], int]:
        offset = (page - 1) * per_page
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT COUNT(*) as total FROM works")
                total_row = await cur.fetchone()
                total = total_row['total'] if total_row else 0
                
                await cur.execute("SELECT * FROM works LIMIT %s OFFSET %s", (per_page, offset))
                rows = await cur.fetchall()
                works = [Work(**row) for row in rows] if rows else []
                
                return works, total

    # get all work by slug
    async def get_work_by_slug(self, slug: str) -> Optional[Work]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT * FROM works WHERE slug = %s", (slug,))
                row = await cur.fetchone()
                if row:
                    return Work(**row)
        return None

    # create a new work
    async def create_work(self, work: Work) -> Work:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                query = """
                    INSERT INTO works (title, slug, alternative_title, synopsis, author, cover_url, banner_url, status_id, format_id, demographic_id, scan_group_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                values = (
                    work.title, work.slug, work.alternative_title, work.synopsis, work.author,
                    work.cover_url, work.banner_url, work.status_id, work.format_id, 
                    work.demographic_id, work.scan_group_id
                )
                await cur.execute(query, values)
                await conn.commit()
                work.id = cur.lastrowid
                return work

    # get work by id
    async def get_work_by_id(self, work_id: int) -> Optional[Work]:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT * FROM works WHERE id = %s", (work_id,))
                row = await cur.fetchone()
                if row:
                    return Work(**row)
        return None

    # update work
    async def update_work(self, work: Work) -> Work:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                query = """
                    UPDATE works 
                    SET title = %s, slug = %s, alternative_title = %s, synopsis = %s, 
                        author = %s, cover_url = %s, banner_url = %s, status_id = %s, 
                        format_id = %s, demographic_id = %s, scan_group_id = %s
                    WHERE id = %s
                """
                values = (
                    work.title, work.slug, work.alternative_title, work.synopsis, work.author,
                    work.cover_url, work.banner_url, work.status_id, work.format_id, 
                    work.demographic_id, work.scan_group_id, work.id
                )
                await cur.execute(query, values)
                await conn.commit()
                return work

    # delete work
    async def delete_work(self, work_id: int) -> bool:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM works WHERE id = %s", (work_id,))
                await conn.commit()
        return True
