from pydantic import BaseModel


class TaxonomyItem(BaseModel):
    id: int
    name: str


class Status(TaxonomyItem):
    pass


class Format(TaxonomyItem):
    pass


class Demographic(TaxonomyItem):
    pass


class Genre(TaxonomyItem):
    pass


class Tag(TaxonomyItem):
    pass
