from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()

api_router = APIRouter(prefix="/api")

class Resource(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    url: str
    login: str
    password: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ResourceCreate(BaseModel):
    url: str
    login: str
    password: str

class ResourceUpdate(BaseModel):
    is_active: bool

@api_router.get("/")
async def root():
    return {"message": "Resource Manager API"}

@api_router.post("/resources", response_model=Resource)
async def create_resource(input: ResourceCreate):
    resource_dict = input.model_dump()
    resource_obj = Resource(**resource_dict)

    doc = resource_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.resources.insert_one(doc)
    return resource_obj

@api_router.get("/resources", response_model=List[Resource])
async def get_resources():
    resources = await db.resources.find({}, {"_id": 0}).to_list(1000)

    for resource in resources:
        if isinstance(resource['created_at'], str):
            resource['created_at'] = datetime.fromisoformat(resource['created_at'])

    return resources

@api_router.put("/resources/{resource_id}", response_model=Resource)
async def update_resource(resource_id: str, update: ResourceUpdate):
    result = await db.resources.find_one_and_update(
        {"id": resource_id},
        {"$set": {"is_active": update.is_active}},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Ресурс не найден")

    result.pop('_id', None)
    if isinstance(result['created_at'], str):
        result['created_at'] = datetime.fromisoformat(result['created_at'])

    return Resource(**result)

@api_router.delete("/resources/{resource_id}")
async def delete_resource(resource_id: str):
    result = await db.resources.delete_one({"id": resource_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ресурс не найден")

    return {"message": "Ресурс удалён"}

@api_router.post("/resources/import")
async def import_resources(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        text = contents.decode('utf-8')

        lines = text.strip().split('\n')
        imported = 0
        errors = []

        for i, line in enumerate(lines, 1):
            line = line.strip()
            if not line:
                continue

            parts = line.rsplit(':', 2)
            if len(parts) != 3:
                errors.append(f"Строка {i}: неверный формат (ожидается url:login:pass)")
                continue

            url, login, password = [p.strip() for p in parts]

            if not url or not login or not password:
                errors.append(f"Строка {i}: пустые поля")
                continue

            resource_obj = Resource(url=url, login=login, password=password)
            doc = resource_obj.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()

            await db.resources.insert_one(doc)
            imported += 1

        return {
            "message": f"Импортировано ресурсов: {imported}",
            "imported": imported,
            "errors": errors
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка импорта: {str(e)}")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
