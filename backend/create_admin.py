"""
Create admin user and sample data for the application
"""
import uuid
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import sync_engine
from models import Base, User, Employee, Project

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_admin_user():
    """Create an admin user with short password to avoid bcrypt length issues"""
    Base.metadata.create_all(bind=sync_engine)
    
    tenant_id = uuid.uuid4()
    
    with Session(sync_engine) as db:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.email == "admin@company.com").first()
        if existing_admin:
            print("✅ Admin user already exists!")
            return
        
        # Create employee first
        employee = Employee(
            tenant_id=tenant_id,
            employee_id="EMP001",
            first_name="Admin",
            last_name="User",
            email="admin@company.com",
            department="IT",
            designation="System Administrator"
        )
        db.add(employee)
        db.flush()
        
        # Create user with short password
        hashed_password = pwd_context.hash("admin123")  # Short password
        user = User(
            tenant_id=tenant_id,
            username="admin",
            email="admin@company.com",
            hashed_password=hashed_password,
            full_name="Admin User",
            roles=["ADMIN", "HR", "FINANCE", "MANAGER"],
            is_active=True,
            employee_id=employee.id
        )
        db.add(user)
        
        # Create sample project
        project = Project(
            tenant_id=tenant_id,
            project_code="PROJ001",
            name="Hackathon Project",
            description="AI-powered reimbursement system",
            is_active=True
        )
        db.add(project)
        
        db.commit()
        print("✅ Admin user created successfully!")
        print("   Email: admin@company.com")
        print("   Username: admin")
        print("   Password: admin123")
        print("✅ Sample project created: Hackathon Project")

if __name__ == "__main__":
    create_admin_user()
