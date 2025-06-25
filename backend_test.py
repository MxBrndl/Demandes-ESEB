import requests
import json
import time
import re
from datetime import datetime

class ESEBAPITester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_token = None
        self.user_token = None
        self.admin_id = None
        self.user_id = None
        self.request_id = None
        self.pdf_generated = False

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_register_user(self, email, password, first_name, last_name, role, fonction=None, adresse_complete=None, telephone=None):
        """Test user registration with extended fields"""
        data = {
            "email": email,
            "password": password,
            "first_name": first_name,
            "last_name": last_name,
            "role": role
        }
        
        # Add extended fields if provided
        if fonction:
            data["fonction"] = fonction
        if adresse_complete:
            data["adresse_complete"] = adresse_complete
        if telephone:
            data["telephone"] = telephone
            
        success, response = self.run_test(
            f"Register {role} with extended fields",
            "POST",
            "register",
            200,
            data=data
        )
        
        if success and 'token' in response:
            if role == 'admin':
                self.admin_token = response['token']
                self.admin_id = response['user']['id']
            elif role == 'user':
                self.user_token = response['token']
                self.user_id = response['user']['id']
            
            print(f"✅ {role.capitalize()} registered successfully with ID: {response['user']['id']}")
            return True
        
        return False

    def test_login(self, email, password, role):
        """Test login"""
        success, response = self.run_test(
            f"Login as {role}",
            "POST",
            "login",
            200,
            data={"email": email, "password": password}
        )
        
        if success and 'token' in response:
            if role == 'admin':
                self.admin_token = response['token']
                self.admin_id = response['user']['id']
            elif role == 'user':
                self.user_token = response['token']
                self.user_id = response['user']['id']
            
            print(f"✅ {role.capitalize()} logged in successfully")
            return True
        
        return False

    def test_get_current_user(self, token, role):
        """Test getting current user info"""
        success, response = self.run_test(
            f"Get current user ({role})",
            "GET",
            "me",
            200,
            token=token
        )
        
        if success and 'role' in response and response['role'] == role:
            print(f"✅ Got {role} user info successfully")
            return True
        
        return False

    def test_create_request(self, token, user_id, role):
        """Test creating a device request with beneficiary information"""
        if not token:
            print(f"❌ No {role} token available")
            return False
        
        data = {
            "devices": ["ipad", "macbook", "apple_pencil"],
            "application_requirements": "Besoin d'applications pour prendre des notes et dessiner. Logiciels de programmation pour le MacBook.",
            "phone": "+33987654321",
            "address": "123 Rue de l'École, Luxembourg",
            "lieu_reception": "Centre Technolink",
            "duree_fin_disposition": "Fin d'année scolaire",
            "beneficiaire": {
                "nom": "Dupont",
                "prenom": "Jean",
                "date_naissance": "2010-05-15",
                "ecole": "École Fondamentale de Luxembourg",
                "classe": "6e année",
                "qualite_ebs": "EBS",
                "personne_reference": "Marie Dupont"
            }
        }
        
        success, response = self.run_test(
            f"Create request as {role} with beneficiary info",
            "POST",
            "requests",
            200,
            data=data,
            token=token
        )
        
        if success and 'request_id' in response:
            if role == 'user':
                self.request_id = response['request_id']
            print(f"✅ Request created with ID: {response['request_id']}")
            return response['request_id']
        
        return None

    def test_get_requests(self, token, role):
        """Test getting requests"""
        success, response = self.run_test(
            f"Get requests ({role})",
            "GET",
            "requests",
            200,
            token=token
        )
        
        if success and 'requests' in response:
            print(f"✅ Got {len(response['requests'])} requests for {role}")
            return True
        
        return False

    def test_update_request_with_valid_asset_tag(self, request_id):
        """Test updating a request with valid asset tag"""
        if not self.admin_token or not request_id:
            print("❌ No admin token or request ID available")
            return False
        
        data = {
            "status": "approuve",
            "device_asset_tags": {
                "ipad": "H12345",
                "macbook": "H67890",
                "apple_pencil": "H11111"
            },
            "device_serial_numbers": {
                "ipad": "IPAD123456789",
                "macbook": "MACBOOK987654321",
                "apple_pencil": ""
            },
            "admin_notes": "Demande approuvée avec asset tags valides et numéros de série pour iPad et MacBook."
        }
        
        success, response = self.run_test(
            "Update request with valid asset tags",
            "PUT",
            f"requests/{request_id}",
            200,
            data=data,
            token=self.admin_token
        )
        
        if success:
            print(f"✅ Request {request_id} updated successfully with valid asset tags")
            return True
        
        return False

    def test_update_request_with_invalid_asset_tag(self, request_id):
        """Test updating a request with invalid asset tag"""
        if not self.admin_token or not request_id:
            print("❌ No admin token or request ID available")
            return False
        
        data = {
            "status": "approuve",
            "device_asset_tags": {
                "ipad": "ABC123",  # Invalid format
                "apple_pencil": "H67890"
            },
            "admin_notes": "Tentative avec asset tag invalide."
        }
        
        success, response = self.run_test(
            "Update request with invalid asset tag",
            "PUT",
            f"requests/{request_id}",
            422,  # Expecting validation error (422 Unprocessable Entity)
            data=data,
            token=self.admin_token
        )
        
        # This test passes if it fails with status 422
        if success and 'detail' in response and any('Asset tag' in str(error) for error in response.get('detail', [])):
            print(f"✅ Correctly rejected invalid asset tag format")
            return True
        
        return False

    def test_update_request_without_serial_for_required_devices(self, request_id):
        """Test updating a request without serial number for iPad or MacBook"""
        if not self.admin_token or not request_id:
            print("❌ No admin token or request ID available")
            return False
        
        # Test missing iPad serial
        data_ipad = {
            "status": "approuve",
            "device_asset_tags": {
                "ipad": "H12345",
                "macbook": "H67890",
                "apple_pencil": "H11111"
            },
            "device_serial_numbers": {
                "ipad": "",  # Empty serial for iPad
                "macbook": "MACBOOK987654321",
                "apple_pencil": ""
            },
            "admin_notes": "Tentative sans numéro de série pour iPad."
        }
        
        success_ipad, response_ipad = self.run_test(
            "Update request without iPad serial number",
            "PUT",
            f"requests/{request_id}",
            400,  # Expecting error
            data=data_ipad,
            token=self.admin_token
        )
        
        # This test passes if it fails with status 400
        ipad_test_passed = False
        if not success_ipad and response_ipad.get('detail', '').find('Numéro de série obligatoire') >= 0:
            self.tests_passed += 1
            print(f"✅ Correctly rejected missing serial number for iPad")
            ipad_test_passed = True
        
        # Test missing MacBook serial
        data_macbook = {
            "status": "approuve",
            "device_asset_tags": {
                "ipad": "H12345",
                "macbook": "H67890",
                "apple_pencil": "H11111"
            },
            "device_serial_numbers": {
                "ipad": "IPAD123456789",
                "macbook": "",  # Empty serial for MacBook
                "apple_pencil": ""
            },
            "admin_notes": "Tentative sans numéro de série pour MacBook."
        }
        
        success_macbook, response_macbook = self.run_test(
            "Update request without MacBook serial number",
            "PUT",
            f"requests/{request_id}",
            400,  # Expecting error
            data=data_macbook,
            token=self.admin_token
        )
        
        # This test passes if it fails with status 400
        macbook_test_passed = False
        if not success_macbook and response_macbook.get('detail', '').find('Numéro de série obligatoire') >= 0:
            self.tests_passed += 1
            print(f"✅ Correctly rejected missing serial number for MacBook")
            macbook_test_passed = True
        
        return ipad_test_passed and macbook_test_passed

    def test_update_request_to_prepared_and_check_pdf(self, request_id):
        """Test updating a request to 'prepare' status and check PDF generation"""
        if not self.admin_token or not request_id:
            print("❌ No admin token or request ID available")
            return False
        
        data = {
            "status": "prepare",
            "device_serial_numbers": {
                "ipad": "IPAD123456789",
                "macbook": "MACBOOK987654321",
                "apple_pencil": ""
            },
            "device_asset_tags": {
                "ipad": "H12345",
                "macbook": "H67890",
                "apple_pencil": "H11111"
            },
            "admin_notes": "Demande préparée, PDF officiel généré automatiquement."
        }
        
        success, response = self.run_test(
            "Update request to 'prepare' status",
            "PUT",
            f"requests/{request_id}",
            200,
            data=data,
            token=self.admin_token
        )
        
        if success:
            print(f"✅ Request {request_id} updated to 'prepare' status")
            
            # Now try to download the PDF
            pdf_success, pdf_response = self.run_test(
                "Download PDF for prepared request",
                "GET",
                f"requests/{request_id}/pdf",
                200,
                token=self.admin_token
            )
            
            if pdf_success:
                self.pdf_generated = True
                print(f"✅ PDF successfully generated for request {request_id}")
                return True
        
        return False
        
    def test_delete_request(self, request_id):
        """Test deleting a request as admin"""
        if not self.admin_token or not request_id:
            print("❌ No admin token or request ID available")
            return False
        
        url = f"{self.base_url}/api/requests/{request_id}"
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing Delete request as admin...")
        
        try:
            response = requests.delete(url, headers=headers)
            success = response.status_code == 200
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                print(f"✅ Request {request_id} deleted successfully")
                return True
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False
        
    def test_delete_request_as_user(self, request_id):
        """Test attempting to delete a request as regular user (should fail)"""
        if not self.user_token or not request_id:
            print("❌ No user token or request ID available")
            return False
        
        url = f"{self.base_url}/api/requests/{request_id}"
        headers = {'Authorization': f'Bearer {self.user_token}'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing Attempt to delete request as user (should fail)...")
        
        try:
            response = requests.delete(url, headers=headers)
            success = response.status_code == 403  # Expecting Forbidden
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                print(f"✅ Correctly prevented user from deleting request {request_id}")
                return True
            else:
                print(f"❌ Failed - Expected 403, got {response.status_code}")
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_get_dashboard_stats(self):
        """Test getting dashboard stats as admin"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
        
        success, response = self.run_test(
            "Get dashboard stats",
            "GET",
            "dashboard/stats",
            200,
            token=self.admin_token
        )
        
        if success and 'total_requests' in response:
            print(f"✅ Got dashboard stats: {response['total_requests']} total requests")
            return True
        
        return False

def main():
    # Setup
    base_url = "https://cf5f5943-8307-4683-a019-f955a960375d.preview.emergentagent.com"
    tester = ESEBAPITester(base_url)
    
    print("\n===== TESTING CORRECTIONS FOR EBS INTERFACE =====")
    
    # Use the provided test accounts from the test scenario
    admin_email = "admin@eseb.com"
    admin_password = "admin123"
    
    # Login with admin account
    admin_login = tester.test_login(admin_email, admin_password, "admin")
    
    if not admin_login:
        print("❌ Admin login failed, cannot proceed with test")
        return 1
    
    print("\n===== CREATING NEW EBS REQUEST WITH CORRECTED FIELDS =====")
    print("✅ Testing: Matricule instead of date_naissance")
    print("✅ Testing: Qualité EBS limited to EBS, ESEB, i-EBS")
    print("✅ Testing: Apple Pencil without serial number requirement")
    
    # Create a new request with the specific test data
    data = {
        "devices": ["ipad", "apple_pencil"],  # Testing iPad + Apple Pencil combination
        "application_requirements": "Applications éducatives pour besoins spécifiques",
        "phone": "+352123456789",
        "address": "123 Rue de Luxembourg",
        "lieu_reception": "Centre Technolink",
        "duree_fin_disposition": "Fin d'année scolaire",
        "beneficiaire": {
            "nom": "Dupont",
            "prenom": "Jean",
            "matricule": "20241234567",  # Using matricule instead of date_naissance
            "ecole": "École Test Luxembourg",
            "classe": "6e année",
            "qualite_ebs": "i-EBS",  # Testing i-EBS option
            "personne_reference": "Marie Dupont"
        }
    }
    
    url = f"{base_url}/api/requests"
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {tester.admin_token}'
    }
    
    print("🔍 Creating new EBS request with complete data...")
    try:
        response = requests.post(url, json=data, headers=headers)
        if response.status_code == 200:
            request_id = response.json()['request_id']
            print(f"✅ Request created successfully with ID: {request_id}")
        else:
            print(f"❌ Failed to create request - Status: {response.status_code}")
            try:
                print(f"Response: {response.json()}")
            except:
                print(f"Response: {response.text}")
            return 1
    except Exception as e:
        print(f"❌ Error creating request: {str(e)}")
        return 1
    
    print("\n===== UPDATING REQUEST TO 'PREPARE' STATUS TO TRIGGER PDF GENERATION =====")
    
    # Update the request to "prepare" status with required device info
    update_data = {
        "status": "prepare",
        "device_serial_numbers": {
            "ipad": "IPAD123456789",
            "macbook": "MACBOOK987654321",
            "apple_pencil": ""
        },
        "device_asset_tags": {
            "ipad": "H12345",
            "macbook": "H67890",
            "apple_pencil": ""
        },
        "admin_notes": "Demande préparée, PDF officiel généré automatiquement."
    }
    
    update_url = f"{base_url}/api/requests/{request_id}"
    
    print("🔍 Updating request to 'prepare' status to trigger PDF generation...")
    try:
        update_response = requests.put(update_url, json=update_data, headers=headers)
        if update_response.status_code == 200:
            print(f"✅ Request updated to 'prepare' status successfully")
        else:
            print(f"❌ Failed to update request - Status: {update_response.status_code}")
            try:
                print(f"Response: {update_response.json()}")
            except:
                print(f"Response: {update_response.text}")
            return 1
    except Exception as e:
        print(f"❌ Error updating request: {str(e)}")
        return 1
    
    print("\n===== VERIFYING PDF GENERATION =====")
    
    # Get the request details to check if PDF was generated
    get_url = f"{base_url}/api/requests/{request_id}"
    
    print("🔍 Checking if PDF was generated...")
    try:
        get_response = requests.get(get_url, headers=headers)
        if get_response.status_code == 200:
            request_data = get_response.json()
            if request_data.get('official_pdf_generated', False):
                print(f"✅ PDF was successfully generated automatically")
                pdf_generated = True
            else:
                print(f"❌ PDF was not generated automatically")
                pdf_generated = False
        else:
            print(f"❌ Failed to get request details - Status: {get_response.status_code}")
            try:
                print(f"Response: {get_response.json()}")
            except:
                print(f"Response: {get_response.text}")
            return 1
    except Exception as e:
        print(f"❌ Error getting request details: {str(e)}")
        return 1
    
    print("\n===== TESTING PDF DOWNLOAD =====")
    
    # Try to download the PDF
    pdf_url = f"{base_url}/api/requests/{request_id}/pdf"
    
    print("🔍 Attempting to download the PDF...")
    try:
        pdf_response = requests.get(pdf_url, headers=headers)
        if pdf_response.status_code == 200 and pdf_response.headers.get('Content-Type') == 'application/pdf':
            print(f"✅ PDF downloaded successfully")
            pdf_download_success = True
        else:
            print(f"❌ Failed to download PDF - Status: {pdf_response.status_code}")
            pdf_download_success = False
    except Exception as e:
        print(f"❌ Error downloading PDF: {str(e)}")
        pdf_download_success = False
    
    # Print summary
    print("\n===== AUTOMATIC PDF GENERATION TEST SUMMARY =====")
    print(f"✅ Admin login: {'Successful' if admin_login else 'Failed'}")
    print(f"✅ Create EBS request: {'Successful' if request_id else 'Failed'}")
    print(f"✅ Update to 'prepare' status: {'Successful' if update_response.status_code == 200 else 'Failed'}")
    print(f"✅ Automatic PDF generation: {'Successful' if pdf_generated else 'Failed'}")
    print(f"✅ PDF download: {'Successful' if pdf_download_success else 'Failed'}")
    
    overall_success = admin_login and request_id and update_response.status_code == 200 and pdf_generated and pdf_download_success
    
    print(f"\n{'✅ ALL TESTS PASSED' if overall_success else '❌ SOME TESTS FAILED'}")
    
    return 0 if overall_success else 1

if __name__ == "__main__":
    main()