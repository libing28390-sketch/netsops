from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DeviceBase(BaseModel):
    hostname: str
    ip_address: str
    platform: str
    username: str

class DeviceCreate(DeviceBase):
    password: str

class Device(DeviceBase):
    id: int
    created_at: str

    class Config:
        from_attributes = True

class JobBase(BaseModel):
    device_id: int
    task_name: str

class Job(JobBase):
    id: int
    status: str
    created_at: str
    completed_at: Optional[str] = None
    logs: Optional[str] = None

    class Config:
        from_attributes = True
