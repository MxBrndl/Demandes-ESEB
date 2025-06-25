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

    def test_register_user(self, email, password, first_name, last_name, role):
        """Test user registration"""
        success, response = self.run_test(
            f"Register {role}",
            "POST",
            "register",
            200,
            data={
                "email": email,
                "password": password,
                "first_name": first_name,
                "last_name": last_name,
                "role": role
            }
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
        """Test creating a device request"""
        if not token:
            print(f"❌ No {role} token available")
            return False
        
        data = {
            "user_id": user_id,
            "devices": ["ipad", "macbook", "apple_pencil"],
            "application_requirements": "Besoin d'applications pour prendre des notes et dessiner. Logiciels de programmation pour le MacBook.",
            "phone": "+33987654321",
            "address": "123 Rue de l'École, Luxembourg"
        }
        
        success, response = self.run_test(
            f"Create request as {role}",
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
            400,  # Expecting error
            data=data,
            token=self.admin_token
        )
        
        # This test passes if it fails with status 400
        if not success and response.get('detail', '').find('Asset tag') >= 0:
            self.tests_passed += 1
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
    
    print("\n===== TESTING AUTHENTICATION WITH PROVIDED ACCOUNTS =====")
    
    # Use the provided test accounts
    admin_email = "admin@eseb.com"
    user_email = "utilisateur@eseb.com"
    admin_password = "admin123"
    user_password = "user123"
    
    # Login with provided accounts
    admin_login = tester.test_login(admin_email, admin_password, "admin")
    user_login = tester.test_login(user_email, user_password, "user")
    
    # If login fails with provided accounts, try to register them
    if not admin_login:
        print("⚠️ Admin login failed, trying to register admin account")
        tester.test_register_user(admin_email, admin_password, "Admin", "ESEB", "admin")
    if not user_login:
        print("⚠️ User login failed, trying to register user account")
        tester.test_register_user(user_email, user_password, "Utilisateur", "ESEB", "user")
    
    # Test getting current user
    if tester.admin_token:
        tester.test_get_current_user(tester.admin_token, "admin")
    if tester.user_token:
        tester.test_get_current_user(tester.user_token, "user")
    
    print("\n===== TESTING DEVICE REQUESTS =====")
    
    # Create requests
    admin_request_id = tester.test_create_request(tester.admin_token, tester.admin_id, "admin")
    user_request_id = tester.test_create_request(tester.user_token, tester.user_id, "user")
    
    # Get requests
    if tester.admin_token:
        tester.test_get_requests(tester.admin_token, "admin")
    if tester.user_token:
        tester.test_get_requests(tester.user_token, "user")
    
    print("\n===== TESTING ASSET TAG VALIDATION =====")
    
    # Test asset tag validation
    if admin_request_id:
        tester.test_update_request_with_invalid_asset_tag(admin_request_id)
        tester.test_update_request_without_serial_for_ipad(admin_request_id)
        tester.test_update_request_with_valid_asset_tag(admin_request_id)
    
    # Get dashboard stats
    if tester.admin_token:
        tester.test_get_dashboard_stats()
    
    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    main()