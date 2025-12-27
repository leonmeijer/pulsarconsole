from fastapi import APIRouter

router = APIRouter()

@router.get("/clusters")
async def get_clusters():
    return {
        "clusters": [
            {"cluster": "standalone", "serviceUrl": "http://localhost:8080", "brokerServiceUrl": "pulsar://localhost:6650", "brokers": 1}
        ],
        "total": 1
    }
