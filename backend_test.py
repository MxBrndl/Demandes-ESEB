import requests
import json
import time
from datetime import datetime

class ESEBAPITester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_token = None
        self.student_token = None
        self.teacher_token = None
        self.admin_id = None
        self.student_id = None
        self.teacher_id = None
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
            elif role == 'student':
                self.student_token = response['token']
                self.student_id = response['user']['id']
            elif role == 'teacher':
                self.teacher_token = response['token']
                self.teacher_id = response['user']['id']
            
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
            elif role == 'student':
                self.student_token = response['token']
                self.student_id = response['user']['id']
            elif role == 'teacher':
                self.teacher_token = response['token']
                self.teacher_id = response['user']['id']
            
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

    def test_create_student_request(self):
        """Test creating a student request"""
        if not self.student_token:
            print("❌ No student token available")
            return False
        
        data = {
            "user_id": self.student_id,
            "request_type": "student",
            "devices": ["ipad", "apple_pencil"],
            "application_requirements": "Besoin d'applications pour prendre des notes et dessiner",
            "parent_first_name": "Jean",
            "parent_last_name": "Dupont",
            "parent_phone": "+33123456789",
            "parent_email": "parent@test.com",
            "phone": "+33987654321",
            "address": "123 Rue de l'École, Paris"
        }
        
        success, response = self.run_test(
            "Create student request",
            "POST",
            "requests",
            200,
            data=data,
            token=self.student_token
        )
        
        if success and 'request_id' in response:
            self.request_id = response['request_id']
            print(f"✅ Student request created with ID: {self.request_id}")
            return True
        
        return False

    def test_create_teacher_request(self):
        """Test creating a teacher request"""
        if not self.teacher_token:
            print("❌ No teacher token available")
            return False
        
        data = {
            "user_id": self.teacher_id,
            "request_type": "teacher",
            "devices": ["macbook", "ipad"],
            "application_requirements": "Besoin d'applications pour préparer des cours et faire des présentations",
            "phone": "+33123456789",
            "address": "456 Avenue des Professeurs, Lyon"
        }
        
        success, response = self.run_test(
            "Create teacher request",
            "POST",
            "requests",
            200,
            data=data,
            token=self.teacher_token
        )
        
        if success and 'request_id' in response:
            print(f"✅ Teacher request created with ID: {response['request_id']}")
            return True
        
        return False

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

    def test_update_request(self):
        """Test updating a request as admin"""
        if not self.admin_token or not self.request_id:
            print("❌ No admin token or request ID available")
            return False
        
        data = {
            "status": "approuve",
            "admin_notes": "Demande approuvée. Les appareils seront disponibles la semaine prochaine."
        }
        
        success, response = self.run_test(
            "Update request as admin",
            "PUT",
            f"requests/{self.request_id}",
            200,
            data=data,
            token=self.admin_token
        )
        
        if success:
            print(f"✅ Request {self.request_id} updated successfully")
            return True
        
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
    
    # Test data
    timestamp = datetime.now().strftime('%H%M%S')
    admin_email = f"admin{timestamp}@test.com"
    student_email = f"etudiant{timestamp}@test.com"
    teacher_email = f"enseignant{timestamp}@test.com"
    password = "password123"
    
    # Run tests
    print("\n===== TESTING AUTHENTICATION =====")
    
    # Try to login with predefined users first
    admin_login = tester.test_login("admin@test.com", password, "admin")
    student_login = tester.test_login("etudiant@test.com", password, "student")
    teacher_login = tester.test_login("enseignant@test.com", password, "teacher")
    
    # If login fails, register new users
    if not admin_login:
        tester.test_register_user(admin_email, password, "Admin", "User", "admin")
    if not student_login:
        tester.test_register_user(student_email, password, "Étudiant", "Test", "student")
    if not teacher_login:
        tester.test_register_user(teacher_email, password, "Enseignant", "Test", "teacher")
    
    # Test getting current user
    if tester.admin_token:
        tester.test_get_current_user(tester.admin_token, "admin")
    if tester.student_token:
        tester.test_get_current_user(tester.student_token, "student")
    if tester.teacher_token:
        tester.test_get_current_user(tester.teacher_token, "teacher")
    
    print("\n===== TESTING REQUESTS =====")
    
    # Create requests
    tester.test_create_student_request()
    tester.test_create_teacher_request()
    
    # Get requests
    if tester.admin_token:
        tester.test_get_requests(tester.admin_token, "admin")
    if tester.student_token:
        tester.test_get_requests(tester.student_token, "student")
    if tester.teacher_token:
        tester.test_get_requests(tester.teacher_token, "teacher")
    
    # Update request
    if tester.request_id:
        tester.test_update_request()
    
    # Get dashboard stats
    if tester.admin_token:
        tester.test_get_dashboard_stats()
    
    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    main()