from fastapi import FastAPI, HTTPException, Depends, status, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, validator
from pymongo import MongoClient
from typing import Optional, List
import os
import hashlib
import jwt
import uuid
import json
import re
from datetime import datetime, timedelta
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import io
import requests
import tempfile

# Environment variables
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'eseb_demandes')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
TOPDESK_WEBHOOK_URL = os.environ.get('TOPDESK_WEBHOOK_URL', '')

app = FastAPI(title="Demandes ESEB API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
client = MongoClient(MONGO_URL)
db = client[DB_NAME]
users_collection = db.users
requests_collection = db.device_requests

security = HTTPBearer()

# Pydantic models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str = "user"  # user, admin

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class DeviceRequest(BaseModel):
    user_id: str
    devices: List[str]  # ["ipad", "macbook", "apple_pencil"]
    application_requirements: str
    
    # Contact info
    phone: Optional[str] = None
    address: Optional[str] = None

class RequestUpdate(BaseModel):
    status: str
    device_serial_numbers: Optional[dict] = None
    device_asset_tags: Optional[dict] = None
    admin_notes: Optional[str] = None
    
    @validator('device_asset_tags')
    def validate_asset_tags(cls, v):
        if v is None:
            return v
        
        pattern = re.compile(r'^H\d{5}$')
        for device, tag in v.items():
            if tag and not pattern.match(tag):
                raise ValueError(f'Asset tag pour {device} doit être au format H12345 (H suivi de 5 chiffres)')
        return v

# Helper functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_admin(token_data: dict = Depends(verify_token)):
    if token_data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return token_data

def send_to_topdesk(request_data: dict):
    """Send incident to TopDesk via webhook"""
    if not TOPDESK_WEBHOOK_URL:
        return
    
    try:
        # Format the incident data
        incident_data = {
            "caller": {
                "email": request_data.get("user_email"),
                "firstName": request_data.get("first_name"),
                "lastName": request_data.get("last_name")
            },
            "briefDescription": f"Demande d'appareil - {', '.join(request_data.get('devices', []))}",
            "request": f"Demande d'appareil éducatif:\n"
                      f"Appareils: {', '.join(request_data.get('devices', []))}\n"
                      f"Exigences: {request_data.get('application_requirements', '')}"
        }
        
        response = requests.post(TOPDESK_WEBHOOK_URL, json=incident_data, timeout=10)
        print(f"TopDesk webhook response: {response.status_code}")
    except Exception as e:
        print(f"Error sending to TopDesk: {e}")

def generate_pdf_report(request_data: dict, user_data: dict) -> bytes:
    """Generate PDF report for device request"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.darkblue,
        alignment=1  # Center
    )
    story.append(Paragraph("DEMANDE D'APPAREIL ÉDUCATIF", title_style))
    story.append(Spacer(1, 20))
    
    # Request info table
    request_info = [
        ["ID de demande:", request_data.get("_id", "")],
        ["Date de demande:", request_data.get("created_at", "")],
        ["Statut:", request_data.get("status", "")],
        ["Type d'utilisateur:", "Administrateur" if user_data.get("role") == "admin" else "Utilisateur"],
    ]
    
    story.append(Paragraph("INFORMATIONS DE LA DEMANDE", styles['Heading2']))
    table1 = Table(request_info)
    table1.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('BACKGROUND', (1, 0), (1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    story.append(table1)
    story.append(Spacer(1, 20))
    
    # User info
    user_info = [
        ["Nom:", f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}"],
        ["Email:", user_data.get("email", "")],
        ["Téléphone:", request_data.get("phone", "N/A")],
        ["Adresse:", request_data.get("address", "N/A")],
    ]
    
    story.append(Paragraph("INFORMATIONS PERSONNELLES", styles['Heading2']))
    table2 = Table(user_info)
    table2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('BACKGROUND', (1, 0), (1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    story.append(table2)
    story.append(Spacer(1, 20))
    
    # Devices requested
    story.append(Paragraph("APPAREILS DEMANDÉS", styles['Heading2']))
    devices_text = ", ".join([device.replace("_", " ").title() for device in request_data.get("devices", [])])
    story.append(Paragraph(devices_text, styles['Normal']))
    story.append(Spacer(1, 10))
    
    # Application requirements
    story.append(Paragraph("EXIGENCES D'APPLICATION", styles['Heading2']))
    story.append(Paragraph(request_data.get("application_requirements", "Aucune"), styles['Normal']))
    
    # Device details if available
    if request_data.get("device_serial_numbers") or request_data.get("device_asset_tags"):
        story.append(Spacer(1, 20))
        story.append(Paragraph("DÉTAILS DES APPAREILS", styles['Heading2']))
        
        device_details = []
        for device in request_data.get("devices", []):
            serial = request_data.get("device_serial_numbers", {}).get(device, "N/A")
            asset_tag = request_data.get("device_asset_tags", {}).get(device, "N/A")
            device_details.append([device.replace("_", " ").title(), serial, asset_tag])
        
        if device_details:
            device_table = Table([["Appareil", "Numéro de série", "Asset Tag"]] + device_details)
            device_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(device_table)
    
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

# Authentication endpoints
@app.post("/api/register")
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = users_collection.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "_id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "role": user_data.role,
        "created_at": datetime.utcnow().isoformat()
    }
    
    users_collection.insert_one(user_doc)
    
    # Create token
    token = create_token(user_id, user_data.role)
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user_data.email,
            "first_name": user_data.first_name,
            "last_name": user_data.last_name,
            "role": user_data.role
        }
    }

@app.post("/api/login")
async def login(login_data: UserLogin):
    # Find user
    user = users_collection.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create token
    token = create_token(user["_id"], user["role"])
    
    return {
        "token": token,
        "user": {
            "id": user["_id"],
            "email": user["email"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "role": user["role"]
        }
    }

@app.get("/api/me")
async def get_current_user(token_data: dict = Depends(verify_token)):
    user = users_collection.find_one({"_id": token_data["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": user["_id"],
        "email": user["email"],
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "role": user["role"]
    }

# Device request endpoints
@app.post("/api/requests")
async def create_request(request_data: DeviceRequest, token_data: dict = Depends(verify_token)):
    # Get user info
    user = users_collection.find_one({"_id": token_data["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create request
    request_id = str(uuid.uuid4())
    request_doc = {
        "_id": request_id,
        "user_id": token_data["user_id"],
        "devices": request_data.devices,
        "application_requirements": request_data.application_requirements,
        "phone": request_data.phone,
        "address": request_data.address,
        "status": "en_attente",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    requests_collection.insert_one(request_doc)
    
    # Send to TopDesk
    topdesk_data = {
        **request_doc,
        "user_email": user["email"],
        "first_name": user["first_name"],
        "last_name": user["last_name"]
    }
    send_to_topdesk(topdesk_data)
    
    return {"message": "Request created successfully", "request_id": request_id}

@app.get("/api/requests")
async def get_requests(token_data: dict = Depends(verify_token)):
    if token_data["role"] == "admin":
        # Admin can see all requests
        requests = list(requests_collection.find({}))
        
        # Add user info to each request
        for request in requests:
            user = users_collection.find_one({"_id": request["user_id"]})
            if user:
                request["user_info"] = {
                    "email": user["email"],
                    "first_name": user["first_name"],
                    "last_name": user["last_name"],
                    "role": user["role"]
                }
    else:
        # Users can only see their own requests
        requests = list(requests_collection.find({"user_id": token_data["user_id"]}))
    
    return {"requests": requests}

@app.get("/api/requests/{request_id}")
async def get_request(request_id: str, token_data: dict = Depends(verify_token)):
    request = requests_collection.find_one({"_id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check permissions
    if token_data["role"] != "admin" and request["user_id"] != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Add user info
    user = users_collection.find_one({"_id": request["user_id"]})
    if user:
        request["user_info"] = {
            "email": user["email"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "role": user["role"]
        }
    
    return request

@app.put("/api/requests/{request_id}")
async def update_request(request_id: str, update_data: RequestUpdate, token_data: dict = Depends(require_admin)):
    request = requests_collection.find_one({"_id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Validate serial numbers for iPad and MacBook when approving/preparing
    if update_data.status in ['approuve', 'prepare'] and update_data.device_serial_numbers:
        for device in request.get('devices', []):
            if device in ['ipad', 'macbook']:
                serial = update_data.device_serial_numbers.get(device)
                if not serial or not serial.strip():
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Numéro de série obligatoire pour {device.title()} lors de l'approbation/préparation"
                    )
    
    # Update request
    update_fields = {
        "status": update_data.status,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if update_data.device_serial_numbers:
        update_fields["device_serial_numbers"] = update_data.device_serial_numbers
    
    if update_data.device_asset_tags:
        update_fields["device_asset_tags"] = update_data.device_asset_tags
    
    if update_data.admin_notes:
        update_fields["admin_notes"] = update_data.admin_notes
    
    requests_collection.update_one(
        {"_id": request_id},
        {"$set": update_fields}
    )
    
    return {"message": "Request updated successfully"}

@app.get("/api/requests/{request_id}/pdf")
async def download_pdf(request_id: str, token_data: dict = Depends(verify_token)):
    request = requests_collection.find_one({"_id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check permissions
    if token_data["role"] != "admin" and request["user_id"] != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get user info
    user = users_collection.find_one({"_id": request["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate PDF
    pdf_content = generate_pdf_report(request, user)
    
    # Save to temp file and return
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
        tmp_file.write(pdf_content)
        tmp_file.flush()
        
        return FileResponse(
            tmp_file.name,
            media_type='application/pdf',
            filename=f'demande_{request_id}.pdf'
        )

# Dashboard stats for admin
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(token_data: dict = Depends(require_admin)):
    stats = {
        "total_requests": requests_collection.count_documents({}),
        "pending_requests": requests_collection.count_documents({"status": "en_attente"}),
        "approved_requests": requests_collection.count_documents({"status": "approuve"}),
        "completed_requests": requests_collection.count_documents({"status": "termine"}),
        "status_breakdown": {}
    }
    
    # Get status breakdown
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    
    status_counts = list(requests_collection.aggregate(pipeline))
    for item in status_counts:
        stats["status_breakdown"][item["_id"]] = item["count"]
    
    return stats

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)