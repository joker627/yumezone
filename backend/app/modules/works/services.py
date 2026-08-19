# imports standard
from typing import List, Optional
from fastapi import HTTPException

# imports internal
from app.utils.generate_slug import generate_slug
from app.modules.works.models import Work
from app.modules.works.schemas import WorkCreate
from app.modules.works.repository import WorkRepository

class WorkService:
    def __init__(self):
        self.repository = WorkRepository()

    # get all works with pagination
    async def get_all_works(self, page: int = 1, per_page: int = 25) -> dict:
        works, total = await self.repository.get_all_works(page, per_page)
        
        last_visible_page = (total + per_page - 1) // per_page
        if last_visible_page == 0:
            last_visible_page = 1
            
        has_next_page = page < last_visible_page
        
        return {
            "pagination": {
                "last_visible_page": last_visible_page,
                "has_next_page": has_next_page,
                "current_page": page,
                "items": {
                    "count": len(works),
                    "total": total,
                    "per_page": per_page
                }
            },
            "data": works
        }

    # get work by slug
    async def get_work_by_slug(self, slug: str) -> Work:
        work = await self.repository.get_work_by_slug(slug)
        if not work:
            raise HTTPException(status_code=404, detail="Obra no encontrada")
        return work

    # create a new work
    async def create_work(self, work_data: WorkCreate) -> Work:
        slug = generate_slug(work_data.title)
        existing_work = await self.repository.get_work_by_slug(slug)
        if existing_work:
            raise HTTPException(status_code=400, detail="Ya existe una obra con este título")
        new_work = Work(
            title=work_data.title,
            slug=slug,
            alternative_title=work_data.alternative_title,
            synopsis=work_data.synopsis,
            author=work_data.author,
            cover_url=work_data.cover_url,
            banner_url=work_data.banner_url,
            status_id=work_data.status_id,
            format_id=work_data.format_id,
            demographic_id=work_data.demographic_id,
            scan_group_id=work_data.scan_group_id
        )
        return await self.repository.create_work(new_work)

    # get work by id
    async def get_work_by_id(self, work_id: int) -> Work:
        work = await self.repository.get_work_by_id(work_id)
        if not work:
            raise HTTPException(status_code=404, detail="Obra no encontrada")
        return work

    # update work
    async def update_work(self, work_id: int, work_data: dict) -> Work:
        work = await self.get_work_by_id(work_id)
        
        # update fields
        for key, value in work_data.items():
            if hasattr(work, key) and value is not None:
                setattr(work, key, value)
                
        # Handle title -> slug logic if title changed
        if 'title' in work_data and work_data['title']:
            new_slug = generate_slug(work_data['title'])
            if new_slug != work.slug:
                existing_work = await self.repository.get_work_by_slug(new_slug)
                if existing_work and existing_work.id != work_id:
                    raise HTTPException(status_code=400, detail="Ya existe una obra con este título")
                work.slug = new_slug

        return await self.repository.update_work(work)

    # delete work
    async def delete_work(self, work_id: int) -> bool:
        work = await self.get_work_by_id(work_id)
        return await self.repository.delete_work(work_id)

