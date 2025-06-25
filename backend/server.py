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
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
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
    
    # Informations demandeur (pour PDF)
    fonction: Optional[str] = None
    adresse_complete: Optional[str] = None
    telephone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class BeneficiaireInfo(BaseModel):
    nom: str
    prenom: str
    date_naissance: str
    ecole: str
    classe: str
    qualite_ebs: str  # Type de handicap/besoin spécifique
    personne_reference: Optional[str] = None

class DeviceRequest(BaseModel):
    devices: List[str]  # ["ipad", "macbook", "apple_pencil"]
    application_requirements: str
    
    # Informations bénéficiaire (Au profit de)
    beneficiaire: BeneficiaireInfo
    
    # Informations logistiques
    lieu_reception: Optional[str] = None
    duree_fin_disposition: Optional[str] = None
    
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
            "briefDescription": f"Demande d'appareil EBS - {', '.join(request_data.get('devices', []))}",
            "request": f"Demande d'appareil éducatif EBS:\n"
                      f"Appareils: {', '.join(request_data.get('devices', []))}\n"
                      f"Bénéficiaire: {request_data.get('beneficiaire', {}).get('prenom', '')} {request_data.get('beneficiaire', {}).get('nom', '')}\n"
                      f"École: {request_data.get('beneficiaire', {}).get('ecole', '')}\n"
                      f"Exigences: {request_data.get('application_requirements', '')}"
        }
        
        response = requests.post(TOPDESK_WEBHOOK_URL, json=incident_data, timeout=10)
        print(f"TopDesk webhook response: {response.status_code}")
    except Exception as e:
        print(f"Error sending to TopDesk: {e}")

def generate_official_ebs_pdf(request_data: dict, user_data: dict) -> bytes:
    """Generate official EBS PDF form matching Luxembourg format"""
    buffer = io.BytesIO()
    
    # A4 size
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm, leftMargin=20*mm, rightMargin=20*mm)
    styles = getSampleStyleSheet()
    story = []
    
    # Logo placeholder and header
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Normal'],
        fontSize=10,
        alignment=1,  # Center
        textColor=colors.black
    )
    
    # Logo de Luxembourg (placeholder)
    logo_text = Paragraph("🏛️<br/>VILLE DE<br/>LUXEMBOURG", header_style)
    story.append(logo_text)
    story.append(Spacer(1, 10*mm))
    
    # Title
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=14,
        alignment=1,
        textColor=colors.white,
        backColor=colors.blue,
        borderPadding=5
    )
    
    title = Paragraph("Mise à disposition de matériels informatiques dans le cadre de l'inclusion des élèves à besoins spécifiques (EBS)", title_style)
    story.append(title)
    story.append(Spacer(1, 10*mm))
    
    # Section Demandeur
    demandeur_data = [
        ["Demandeur - Direction de l'enseignement fondamental - Région 1", ""],
        ["Nom et Prénom", f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}"],
        ["Fonction", user_data.get('fonction', 'Gestionnaire administratif')],
        ["Adresse", user_data.get('adresse_complete', '5, rue Thomas Edison - L-1445 Strassen')],
        ["Téléphone", user_data.get('telephone', '(+352) 247-65868')],
        ["Email", user_data.get('email', '')],
        ["Date de la demande", datetime.now().strftime('%d.%m.%Y')]
    ]
    
    demandeur_table = Table(demandeur_data, colWidths=[8*cm, 10*cm])
    demandeur_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgreen),
        ('BACKGROUND', (0, 1), (0, -1), colors.lightgrey),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ]))
    story.append(demandeur_table)
    story.append(Spacer(1, 5*mm))
    
    # Section Au profit de
    beneficiaire = request_data.get('beneficiaire', {})
    profit_data = [
        ["Au profit de", ""],
        ["Nom et Prénom", f"{beneficiaire.get('prenom', '')} {beneficiaire.get('nom', '')}"],
        ["Qualité EBS (ESS, ESEB)", beneficiaire.get('qualite_ebs', 'EBS')],
        ["Date de naissance", beneficiaire.get('date_naissance', '')],
        ["École (si applicable)", beneficiaire.get('ecole', '')],
        ["Classe (si applicable)", beneficiaire.get('classe', '')],
        ["Personne de référence (si applicable)", beneficiaire.get('personne_reference', '')]
    ]
    
    profit_table = Table(profit_data, colWidths=[8*cm, 10*cm])
    profit_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgreen),
        ('BACKGROUND', (0, 1), (0, -1), colors.lightgrey),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ]))
    story.append(profit_table)
    story.append(Spacer(1, 5*mm))
    
    # Section Matériel informatique souhaité
    device_mapping = {
        'ipad': 'iPad avec clavier ergonomique',
        'macbook': 'MacBook',
        'apple_pencil': 'Apple Pencil'
    }
    
    devices_text = []
    quantities = []
    for device in request_data.get('devices', []):
        devices_text.append(device_mapping.get(device, device))
        quantities.append('1')
    
    materiel_data = [
        ["Matériel informatique souhaité", ""],
        ["Matériel (iPad, Laptop)", '\n'.join(devices_text)],
        ["Quantité", '\n'.join(quantities)],
        ["Lieu de réception du matériel", request_data.get('lieu_reception', 'Centre Technolink')],
        ["Remarque éventuelle sur le lieu d'utilisation du matériel", "À l'école et à domicile"],
        ["", ""],
        ["Applications ou logiciels installés", request_data.get('application_requirements', '')]
    ]
    
    materiel_table = Table(materiel_data, colWidths=[8*cm, 10*cm])
    materiel_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgreen),
        ('BACKGROUND', (0, 1), (0, -1), colors.lightgrey),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ]))
    story.append(materiel_table)
    story.append(Spacer(1, 5*mm))
    
    # Section Durée
    duree_data = [
        ["Durée de fin de mise à disposition", ""],
        ["", request_data.get('duree_fin_disposition', 'Fin d\'année scolaire')]
    ]
    
    duree_table = Table(duree_data, colWidths=[8*cm, 10*cm])
    duree_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgreen),
        ('BACKGROUND', (0, 1), (0, -1), colors.lightgrey),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ]))
    story.append(duree_table)
    story.append(Spacer(1, 5*mm))
    
    # Section Avis du Centre Technolink
    avis_data = [
        ["Avis du Centre Technolink", ""],
        ["Nom et Prénom", ""],
        ["Email ou Téléphone", ""],
        ["Numéro de série matériel", ""],
        ["Avis et date", ""],
        ["", ""],
        ["Signature du Responsable ou de son représentant", ""]
    ]
    
    avis_table = Table(avis_data, colWidths=[8*cm, 10*cm])
    avis_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightblue),
        ('BACKGROUND', (0, 1), (0, -1), colors.lightgrey),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ]))
    story.append(avis_table)
    story.append(Spacer(1, 5*mm))
    
    # Section Accusé de réception
    accuse_data = [
        ["Accusé de réception du matériel", ""],
        ["Nom et Prénom du parent ou représentant", f"{beneficiaire.get('prenom', '')} {beneficiaire.get('nom', '')} ou représentant"],
        ["Email ou Téléphone", ""],
        ["Remarques éventuelles sur le matériel", ""],
        ["", ""],
        ["Date de réception et signature", ""]
    ]
    
    accuse_table = Table(accuse_data, colWidths=[8*cm, 10*cm])
    accuse_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('BACKGROUND', (0, 1), (0, -1), colors.lightgrey),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ]))
    story.append(accuse_table)
    story.append(Spacer(1, 10*mm))
    
    # Footer note
    footer_note = Paragraph("Le preneur et le demandeur ont pris connaissance et accepté la notice d'information annexée à ce formulaire.", styles['Normal'])
    story.append(footer_note)
    story.append(Spacer(1, 10*mm))
    
    # Logo footer
    footer_logo = Paragraph("🏛️<br/>VILLE DE<br/>LUXEMBOURG", header_style)
    story.append(footer_logo)
    
    # Notice d'information (page 2)
    story.append(Spacer(1, 20*mm))  # Page break
    
    notice_title = Paragraph("Notice d'information en relation avec la mise à disposition de matérielle informatique dans le cadre de l'inclusion des élèves à besoins spécifiques (EBS)", title_style)
    story.append(notice_title)
    story.append(Spacer(1, 10*mm))
    
    notice_text = """
    Dans le cadre d'une collaboration avec le Ministère de l'Éducation nationale, de l'Enfance et de la Jeunesse (Direction régionale 01), la Ville équipe les écoles fondamentales de la Ville de Luxembourg avec du matériel et des équipements informatiques. Sur demande et en concertation avec la Direction régionale, la Direction régionale de la Ville met à disposition du matériel informatique pour ses élèves à besoins spécifiques à des fins pédagogiques. Dans le cadre de cette mise à disposition, la Ville reste propriétaire du matériel informatique qui sera restitué par le preneur par premiers soins de la Ville. Dans le cadre de cette mise à disposition, le matériel informatique sera restitué par le preneur lors de la rupture du lien de cause.
    
    Protection des données à caractère personnel
    
    Conformément à la législation en matière de protection des personnes physiques à l'égard du traitement de données à caractère personnel, la Ville de Luxembourg précise qu'elle collecte, traite et conserve les données à caractère personnel en vertu de l'autorisation de la présente mise à disposition sur le matériel informatique.
    
    Le traitement des données à caractère personnel sera effectué retenu par les agents du service Technolink de la Ville donc que par les différents services de l'administration communale de la Ville de Luxembourg qui interviendront dans l'exécution de la mise à disposition.
    
    La base juridique du traitement nécessaire à l'exécution des données à caractère personnel collectées l'exécution de la mise à disposition. Les données et informations collectées peuvent également servir à des fins statistiques ou archivistiques, dans un but d'intérêt public.
    
    Les données à caractère personnel, informations et documents sont conservés pour la durée nécessaire à la réalisation de ces finalités et ne font pas l'objet d'un quelconque transfert à des tierces personnes.
    
    Vous reconnaissez avoir été informé des différents droits contenus en vertu du Règlement Général sur la Protection des Données UE 2016/679 et notamment du droit d'accès, du droit de rectification ainsi que, le cas échéant, du droit d'opposition et de limitation du traitement de vos données à caractère personnel. L'administration communale de la Ville de Luxembourg ne met pas en œuvre de traitement automatisé de vos données à caractère personnel. 
    
    Pour de plus amples informations voir: www.vdl.lu/donnees-privees
    
    Vous disposez également du droit d'introduire une réclamation auprès de la Commission nationale pour la protection des données au Luxembourg (www.cnpd.lu).
    """
    
    notice_paragraph = Paragraph(notice_text, styles['Normal'])
    story.append(notice_paragraph)
    
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
        "fonction": user_data.fonction,
        "adresse_complete": user_data.adresse_complete,
        "telephone": user_data.telephone,
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
        "beneficiaire": request_data.beneficiaire.dict(),
        "lieu_reception": request_data.lieu_reception,
        "duree_fin_disposition": request_data.duree_fin_disposition,
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
    
    # Auto-generate PDF when status becomes "prepare"
    if update_data.status == "prepare":
        try:
            user = users_collection.find_one({"_id": request["user_id"]})
            if user:
                updated_request = requests_collection.find_one({"_id": request_id})
                pdf_content = generate_official_ebs_pdf(updated_request, user)
                
                # Save PDF to file system (you might want to save to cloud storage instead)
                pdf_filename = f"EBS_demande_{request_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
                pdf_path = f"/tmp/{pdf_filename}"
                
                with open(pdf_path, 'wb') as f:
                    f.write(pdf_content)
                
                # Store PDF path in request
                requests_collection.update_one(
                    {"_id": request_id},
                    {"$set": {"official_pdf_path": pdf_path, "official_pdf_generated": True}}
                )
                
                print(f"Official PDF generated for request {request_id}: {pdf_path}")
        except Exception as e:
            print(f"Error generating official PDF for request {request_id}: {e}")
    
    return {"message": "Request updated successfully"}

@app.delete("/api/requests/{request_id}")
async def delete_request(request_id: str, token_data: dict = Depends(require_admin)):
    """Delete a request - Admin only"""
    request = requests_collection.find_one({"_id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Delete the request
    result = requests_collection.delete_one({"_id": request_id})
    
    if result.deleted_count == 1:
        return {"message": "Request deleted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete request")

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
    
    # Generate official PDF
    pdf_content = generate_official_ebs_pdf(request, user)
    
    # Save to temp file and return
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
        tmp_file.write(pdf_content)
        tmp_file.flush()
        
        return FileResponse(
            tmp_file.name,
            media_type='application/pdf',
            filename=f'EBS_demande_{request_id}.pdf'
        )

# Dashboard stats for admin
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(token_data: dict = Depends(require_admin)):
    stats = {
        "total_requests": requests_collection.count_documents({}),
        "pending_requests": requests_collection.count_documents({"status": "en_attente"}),
        "approved_requests": requests_collection.count_documents({"status": "approuve"}),
        "prepared_requests": requests_collection.count_documents({"status": "prepare"}),
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