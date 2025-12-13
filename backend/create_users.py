"""
Create users for existing employees
"""
import uuid
import hashlib
from sqlalchemy.orm import Session
from database import sync_engine
from models import Base, User, Employee

def simple_hash(password: str) -> str:
    """Simple password hashing for demo purposes"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_test_users():
    """Create users for existing employees"""
    Base.metadata.create_all(bind=sync_engine)
    
    with Session(sync_engine) as db:
        # Get all employees
        employees = db.query(Employee).all()
        
        print(f"\nFound {len(employees)} employees")
        
        for emp in employees:
            # Check if user exists
            existing_user = db.query(User).filter(User.email == emp.email).first()
            if existing_user:
                print(f"  ✓ User already exists for {emp.email}")
                continue
            
            # Determine username and roles
            username = emp.email.split('@')[0]
            roles = ["EMPLOYEE"]
            
            # Give first employee admin rights
            if emp.employee_id == "EMP001":
                roles.extend(["ADMIN", "HR", "FINANCE", "MANAGER"])
                password = "admin123"
            else:
                password = "password123"
            
            # Create user
            hashed_password = simple_hash(password)
            user = User(
                tenant_id=emp.tenant_id,
                username=username,
                email=emp.email,
                hashed_password=hashed_password,
                full_name=f"{emp.first_name} {emp.last_name}",
                roles=roles,
                is_active=True,
                employee_id=emp.id
            )
            db.add(user)
            print(f"  ✓ Created user for {emp.first_name} {emp.last_name}")
            print(f"     Email: {emp.email}")
            print(f"     Username: {username}")
            print(f"     Password: {password}")
            print(f"     Roles: {', '.join(roles)}")
        
        db.commit()
        print("\n✅ All users created successfully!")

if __name__ == "__main__":
    create_test_users()
