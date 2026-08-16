from typing import Generic, TypeVar, List
from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Amplop paginasi standar: {items, total}."""
    items: List[T]
    total: int
