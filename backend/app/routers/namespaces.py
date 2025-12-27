from fastapi import APIRouter

router = APIRouter()

@router.get("/namespaces/{tenant}")
async def get_namespaces(tenant: str):
    return {
        "namespaces": [f"{tenant}/default", f"{tenant}/test"],
        "total": 2
    }
