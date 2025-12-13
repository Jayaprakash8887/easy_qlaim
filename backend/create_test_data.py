"""
Test data creation script for development and demo
"""
from database import get_sync_db
from models import Employee, Project, User, Policy, Claim
from uuid import uuid4, UUID
from datetime import date, datetime
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEFAULT_TENANT_ID = uuid4()


def create_test_employees():
    """Create test employees"""
    db = next(get_sync_db())
    
    employees = [
        {
            "employee_id": "EMP001",
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@company.com",
            "phone": "+1234567890",
            "department": "Engineering",
            "designation": "Senior Developer",
            "date_of_joining": date(2022, 1, 1)
        },
        {
            "employee_id": "EMP002",
            "first_name": "Jane",
            "last_name": "Smith",
            "email": "jane.smith@company.com",
            "phone": "+1234567891",
            "department": "Engineering",
            "designation": "Tech Lead",
            "date_of_joining": date(2020, 6, 15)
        },
        {
            "employee_id": "EMP003",
            "first_name": "Alice",
            "last_name": "Johnson",
            "email": "alice.johnson@company.com",
            "phone": "+1234567892",
            "department": "HR",
            "designation": "HR Manager",
            "date_of_joining": date(2019, 3, 1)
        }
    ]
    
    created_employees = []
    for emp_data in employees:
        employee = Employee(
            tenant_id=DEFAULT_TENANT_ID,
            employment_status="ACTIVE",
            **emp_data
        )
        db.add(employee)
        created_employees.append(employee)
    
    db.commit()
    
    for emp in created_employees:
        db.refresh(emp)
    
    print(f"Created {len(created_employees)} employees")
    return created_employees


def create_test_users(employees):
    """Create test users"""
    db = next(get_sync_db())
    
    users_data = [
        {"username": "john.doe", "email": "john.doe@company.com", "password": "password123", "roles": ["EMPLOYEE"]},
        {"username": "jane.smith", "email": "jane.smith@company.com", "password": "password123", "roles": ["EMPLOYEE", "MANAGER"]},
        {"username": "alice.johnson", "email": "alice.johnson@company.com", "password": "password123", "roles": ["HR"]},
    ]
    
    created_users = []
    for i, user_data in enumerate(users_data):
        user = User(
            tenant_id=DEFAULT_TENANT_ID,
            username=user_data["username"],
            email=user_data["email"],
            full_name=f"{employees[i].first_name} {employees[i].last_name}",
            hashed_password=pwd_context.hash(user_data["password"]),
            roles=user_data["roles"],
            employee_id=employees[i].id,
            is_active=True
        )
        db.add(user)
        created_users.append(user)
    
    db.commit()
    print(f"Created {len(created_users)} users")
    return created_users


def create_test_projects():
    """Create test projects"""
    db = next(get_sync_db())
    
    projects = [
        {
            "project_code": "PROJ001",
            "project_name": "AI Platform Development",
            "description": "Building AI-powered platform",
            "budget_allocated": 100000,
            "budget_spent": 25000,
            "budget_available": 75000,
            "status": "ACTIVE",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 12, 31)
        },
        {
            "project_code": "PROJ002",
            "project_name": "Mobile App Redesign",
            "description": "Redesigning mobile application",
            "budget_allocated": 50000,
            "budget_spent": 10000,
            "budget_available": 40000,
            "status": "ACTIVE",
            "start_date": date(2024, 6, 1),
            "end_date": date(2024, 11, 30)
        }
    ]
    
    created_projects = []
    for proj_data in projects:
        project = Project(
            tenant_id=DEFAULT_TENANT_ID,
            **proj_data
        )
        db.add(project)
        created_projects.append(project)
    
    db.commit()
    print(f"Created {len(created_projects)} projects")
    return created_projects


def create_test_policies():
    """Create test policies"""
    db = next(get_sync_db())
    
    policies = [
        {
            "policy_name": "Certification Reimbursement Policy",
            "policy_type": "REIMBURSEMENT",
            "category": "CERTIFICATION",
            "policy_text": """
Certification Reimbursement Policy:
1. Maximum reimbursement: INR 25,000 per year
2. Minimum tenure requirement: 6 months
3. Required documents: Certificate of completion + Invoice
4. Certification must be job-related
5. Reimbursement within 30 days of completion
            """,
            "policy_rules": {
                "max_amount": 25000,
                "min_tenure_months": 6,
                "required_documents": ["certificate", "invoice"]
            },
            "version": "1.0",
            "is_active": True,
            "effective_from": date(2024, 1, 1)
        },
        {
            "policy_name": "Travel Reimbursement Policy",
            "policy_type": "REIMBURSEMENT",
            "category": "TRAVEL",
            "policy_text": """
Travel Reimbursement Policy:
1. Maximum reimbursement: INR 50,000 per trip
2. Pre-approval required for amounts > INR 10,000
3. Required documents: Tickets + Boarding pass + Hotel invoices
4. Must be business-related travel
            """,
            "policy_rules": {
                "max_amount": 50000,
                "pre_approval_threshold": 10000,
                "required_documents": ["ticket", "boarding_pass"]
            },
            "version": "1.0",
            "is_active": True,
            "effective_from": date(2024, 1, 1)
        },
        {
            "policy_name": "On-Call Allowance Policy",
            "policy_type": "ALLOWANCE",
            "category": "ONCALL",
            "policy_text": """
On-Call Allowance Policy:
1. INR 2,000 per day for on-call duty
2. Minimum 8 hours of on-call time required
3. Timesheet approval needed
4. Paid monthly
            """,
            "policy_rules": {
                "amount_per_day": 2000,
                "min_hours": 8
            },
            "version": "1.0",
            "is_active": True,
            "effective_from": date(2024, 1, 1)
        }
    ]
    
    created_policies = []
    for policy_data in policies:
        policy = Policy(
            tenant_id=DEFAULT_TENANT_ID,
            **policy_data
        )
        db.add(policy)
        created_policies.append(policy)
    
    db.commit()
    print(f"Created {len(created_policies)} policies")
    return created_policies


def create_test_claims(employees):
    """Create sample claims"""
    db = next(get_sync_db())
    
    claims = [
        {
            "employee_id": employees[0].id,
            "employee_name": f"{employees[0].first_name} {employees[0].last_name}",
            "department": employees[0].department,
            "claim_type": "REIMBURSEMENT",
            "category": "CERTIFICATION",
            "amount": 15000,
            "claim_date": date(2024, 12, 1),
            "description": "AWS Solutions Architect Certification",
            "status": "DRAFT"
        },
        {
            "employee_id": employees[1].id,
            "employee_name": f"{employees[1].first_name} {employees[1].last_name}",
            "department": employees[1].department,
            "claim_type": "ALLOWANCE",
            "category": "ONCALL",
            "amount": 6000,
            "claim_date": date(2024, 12, 10),
            "description": "On-call duty for 3 days",
            "status": "DRAFT"
        }
    ]
    
    created_claims = []
    for i, claim_data in enumerate(claims):
        claim_number = f"CLM-{datetime.now().strftime('%Y%m%d')}-{str(uuid4())[:8].upper()}"
        claim = Claim(
            tenant_id=DEFAULT_TENANT_ID,
            claim_number=claim_number,
            **claim_data
        )
        db.add(claim)
        created_claims.append(claim)
    
    db.commit()
    print(f"Created {len(created_claims)} claims")
    return created_claims


def main():
    """Create all test data"""
    print("Creating test data...")
    print(f"Tenant ID: {DEFAULT_TENANT_ID}")
    
    # Create employees
    employees = create_test_employees()
    
    # Create users
    users = create_test_users(employees)
    
    # Create projects
    projects = create_test_projects()
    
    # Create policies
    policies = create_test_policies()
    
    # Create sample claims
    claims = create_test_claims(employees)
    
    print("\n✅ Test data created successfully!")
    print("\nTest Credentials:")
    print("  Username: john.doe | Password: password123 | Role: EMPLOYEE")
    print("  Username: jane.smith | Password: password123 | Role: EMPLOYEE, MANAGER")
    print("  Username: alice.johnson | Password: password123 | Role: HR")
    print(f"\nTenant ID: {DEFAULT_TENANT_ID}")


if __name__ == "__main__":
    main()
