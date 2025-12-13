"""
Create sample claims and projects for testing
"""
import uuid
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from database import sync_engine
from models import Base, Claim, Project, Approval

def create_sample_data():
    """Create sample claims and projects"""
    Base.metadata.create_all(bind=sync_engine)
    
    with Session(sync_engine) as db:
        # Get existing employees
        from models import Employee
        employees = db.query(Employee).limit(3).all()
        
        if not employees:
            print("⚠️  No employees found. Please run create_users.py first")
            return
        
        tenant_id = employees[0].tenant_id
        
        # Create sample projects
        print("\n📁 Creating sample projects...")
        projects_data = [
            {
                "project_code": "PRJ001",
                "project_name": "Cloud Migration",
                "description": "Migrate legacy systems to cloud infrastructure",
                "budget_allocated": 500000.00,
                "budget_spent": 125000.00,
            },
            {
                "project_code": "PRJ002",
                "project_name": "Mobile App Development",
                "description": "Develop customer-facing mobile application",
                "budget_allocated": 300000.00,
                "budget_spent": 75000.00,
            },
        ]
        
        created_projects = []
        for proj_data in projects_data:
            existing = db.query(Project).filter(Project.project_code == proj_data["project_code"]).first()
            if existing:
                print(f"  ✓ Project {proj_data['project_code']} already exists")
                created_projects.append(existing)
                continue
            
            project = Project(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                **proj_data,
                budget_available=proj_data["budget_allocated"] - proj_data["budget_spent"],
                start_date=date.today() - timedelta(days=90),
                end_date=date.today() + timedelta(days=270),
                status="ACTIVE"
            )
            db.add(project)
            created_projects.append(project)
            print(f"  ✓ Created project: {proj_data['project_name']}")
        
        # Create sample claims
        print("\n💰 Creating sample claims...")
        claims_data = [
            {
                "category": "CERTIFICATION",
                "amount": 599.00,
                "description": "AWS Solutions Architect certification exam fee",
                "status": "SUBMITTED",
            },
            {
                "category": "TRAVEL",
                "amount": 1250.00,
                "description": "Client visit - round trip flight tickets",
                "status": "PENDING_MANAGER",
            },
            {
                "category": "TEAM_LUNCH",
                "amount": 450.00,
                "description": "Team lunch after project milestone completion",
                "status": "MANAGER_APPROVED",
            },
            {
                "category": "INTERNET",
                "amount": 100.00,
                "description": "Monthly internet reimbursement - Work from home",
                "status": "FINANCE_APPROVED",
            },
        ]
        
        for i, claim_data in enumerate(claims_data):
            employee = employees[i % len(employees)]
            
            claim_number = f"CLM-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
            
            existing = db.query(Claim).filter(Claim.claim_number == claim_number).first()
            if existing:
                continue
            
            claim = Claim(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                claim_number=claim_number,
                employee_id=employee.id,
                employee_name=f"{employee.first_name} {employee.last_name}",
                department=employee.department or "Engineering",
                claim_type="REIMBURSEMENT",
                **claim_data,
                currency="INR",
                claim_date=date.today() - timedelta(days=7),
                submission_date=datetime.now() - timedelta(days=5) if claim_data["status"] != "DRAFT" else None,
                claim_payload={},
            )
            db.add(claim)
            print(f"  ✓ Created claim: {claim_number} - {claim_data['description'][:50]}...")
        
        db.commit()
        print("\n✅ Sample data created successfully!")
        print(f"   Projects: {len(created_projects)}")
        print(f"   Claims: {len(claims_data)}")

if __name__ == "__main__":
    create_sample_data()
