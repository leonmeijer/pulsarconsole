from fastapi import APIRouter

router = APIRouter()

@router.get("/topics/{tenant}/{namespace}")
async def get_topics(tenant: str, namespace: str):
    return {
        "topics": [f"persistent://{tenant}/{namespace}/topic-1", f"persistent://{tenant}/{namespace}/topic-2"],
        "total": 2
    }
