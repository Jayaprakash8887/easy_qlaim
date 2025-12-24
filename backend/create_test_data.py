#!/usr/bin/env python3
"""
Create test data for Easy Qlaim
Seeds Tarento tenant with actual company data: employees, departments, IBUs, projects, regions, designations
"""
from uuid import uuid4
from datetime import datetime
from decimal import Decimal
import bcrypt

from database import SyncSessionLocal
from models import Tenant, User, Department, Designation, IBU, Project, Region
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """Hash password using bcrypt directly (compatible with local auth)"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_test_data():
    """Create test data for Tarento tenant with actual company structure"""
    db = SyncSessionLocal()
    
    try:
        # ==================== PLATFORM TENANT (for System Admin) ====================
        platform_tenant = db.query(Tenant).filter(Tenant.code == 'PLATFORM').first()
        
        if not platform_tenant:
            logger.info("Creating Platform tenant for system admin...")
            platform_tenant = Tenant(
                id=uuid4(),
                name='EasyQlaim Platform',
                code='PLATFORM',
                domain='easyqlaim.com',
                settings={
                    'timezone': 'UTC',
                    'default_currency': 'USD'
                },
                is_active=True
            )
            db.add(platform_tenant)
            db.commit()
            db.refresh(platform_tenant)
            logger.info(f"Created Platform tenant: {platform_tenant.id}")
        
        # ==================== SYSTEM ADMIN USER ====================
        system_admin = db.query(User).filter(User.email == 'system_admin@easyqlaim.com').first()
        
        if not system_admin:
            logger.info("Creating system admin user...")
            system_admin = User(
                id=uuid4(),
                tenant_id=platform_tenant.id,
                username='system_admin',
                email='system_admin@easyqlaim.com',
                hashed_password=hash_password('Admin@123'),
                first_name='System',
                last_name='Administrator',
                full_name='System Administrator',
                department='Administration',
                designation='System Administrator',
                employee_code='SYS001',
                employment_status='ACTIVE',
                region=['GLOBAL'],
                roles=['SYSTEM_ADMIN'],
                is_active=True
            )
            db.add(system_admin)
            db.commit()
            logger.info(f"Created system admin user: {system_admin.email}")
        else:
            logger.info("System admin user already exists")
        
        # Check if Tarento tenant already exists
        tarento = db.query(Tenant).filter(Tenant.code == 'TARENTO').first()
        
        if tarento:
            logger.info("Tarento tenant already exists, skipping creation")
            return
        
        logger.info("Creating Tarento tenant and test data...")
        
        # ==================== TENANT ====================
        tarento = Tenant(
            id=uuid4(),
            name='Tarento Technologies Pvt. Ltd.',
            code='TARENTO',
            domain='tarento.com',
            settings={
                'timezone': 'Asia/Kolkata',
                'default_currency': 'INR'
            },
            is_active=True
        )
        db.add(tarento)
        db.commit()
        db.refresh(tarento)
        logger.info(f"Created Tarento tenant: {tarento.id}")
        
        # ==================== DEPARTMENTS ====================
        departments_data = [
            {'code': 'ENGG', 'name': 'Engineering', 'order': 0},
            {'code': 'QA', 'name': 'Quality Assurance', 'order': 1},
            {'code': 'DEVOPS', 'name': 'DevOps & Infrastructure', 'order': 2},
            {'code': 'PRODUCT', 'name': 'Product Management', 'order': 3},
            {'code': 'PM', 'name': 'Project Management', 'order': 4},
            {'code': 'DATA', 'name': 'Data Science & Analytics', 'order': 5},
            {'code': 'DESIGN', 'name': 'UI/UX Design', 'order': 6},
            {'code': 'HR', 'name': 'Human Resources', 'order': 7},
            {'code': 'FINANCE', 'name': 'Finance & Accounts', 'order': 8},
            {'code': 'SALES', 'name': 'Sales & Business Development', 'order': 9},
            {'code': 'MARKETING', 'name': 'Marketing', 'order': 10},
            {'code': 'CS', 'name': 'Customer Success', 'order': 11},
            {'code': 'IT', 'name': 'IT Support', 'order': 12},
            {'code': 'LEGAL', 'name': 'Legal & Compliance', 'order': 13},
            {'code': 'OPS', 'name': 'Operations', 'order': 14},
            {'code': 'RND', 'name': 'Research & Development', 'order': 15},
        ]
        
        for dept_data in departments_data:
            dept = Department(
                id=uuid4(),
                tenant_id=tarento.id,
                code=dept_data['code'],
                name=dept_data['name'],
                display_order=dept_data['order'],
                is_active=True
            )
            db.add(dept)
        
        db.commit()
        logger.info(f"Created {len(departments_data)} departments")
        
        # ==================== DESIGNATIONS ====================
        designations_data = [
            {'code': 'AM_OPS', 'name': 'Associate Manager - Revenue Operations', 'level': 0, 'desc': 'Associate Manager - Revenue Operations'},
            {'code': 'F&A', 'name': 'Finance & Accounts', 'level': 0, 'desc': 'Finance & Accounts'},
            {'code': 'HR', 'name': 'HR', 'level': 0, 'desc': 'Job designation: HR'},
            {'code': 'HR_MGR', 'name': 'HR Manager', 'level': 0, 'desc': 'HR Manager'},
            {'code': 'SENIOR_PROJECT_MANAGER', 'name': 'Senior Project Manager', 'level': 0, 'desc': 'Job designation: Senior Project Manager'},
            {'code': 'TL', 'name': 'TL', 'level': 0, 'desc': 'Job designation: TL'},
            {'code': 'EMPLOYEE', 'name': 'Employee', 'level': 0, 'desc': 'Job designation: Employee'},
            {'code': 'MANAGER', 'name': 'Manager', 'level': 0, 'desc': 'Job designation: Manager'},
        ]
        
        for desig_data in designations_data:
            desig = Designation(
                id=uuid4(),
                tenant_id=tarento.id,
                code=desig_data['code'],
                name=desig_data['name'],
                level=desig_data['level'],
                description=desig_data['desc'],
                is_active=True
            )
            db.add(desig)
        
        db.commit()
        logger.info(f"Created {len(designations_data)} designations")
        
        # ==================== IBUS ====================
        ibus_data = [
            {'code': 'BUILD', 'name': 'Build', 'desc': 'Build'},
            {'code': 'BUY', 'name': 'Buy', 'desc': 'Buy'},
            {'code': 'MOB', 'name': 'Mobility', 'desc': 'Mobility'},
        ]
        
        ibus = {}
        for ibu_data in ibus_data:
            ibu = IBU(
                id=uuid4(),
                tenant_id=tarento.id,
                code=ibu_data['code'],
                name=ibu_data['name'],
                description=ibu_data['desc'],
                is_active=True
            )
            db.add(ibu)
            ibus[ibu_data['code']] = ibu
        
        db.commit()
        logger.info(f"Created {len(ibus_data)} IBUs")
        
        # ==================== REGIONS ====================
        regions_data = [
            {'code': 'IND', 'name': 'India', 'currency': 'INR', 'desc': 'Region India'},
            {'code': 'SWE', 'name': 'Sweden', 'currency': 'SEK', 'desc': 'Region Sweden'},
            {'code': 'FIN', 'name': 'Finland', 'currency': 'EUR', 'desc': 'Region Finland'},
            {'code': 'BLR-STP', 'name': 'Bangalore STP', 'currency': 'INR', 'desc': 'Region Bangalore STP'},
            {'code': 'IDR-STP', 'name': 'Indore STP', 'currency': 'INR', 'desc': 'Region Indore STP'},
            {'code': 'DEL-SEZ', 'name': 'Delhi SEZ', 'currency': 'INR', 'desc': 'Region Delhi SEZ'},
        ]
        
        for region_data in regions_data:
            region = Region(
                id=uuid4(),
                tenant_id=tarento.id,
                code=region_data['code'],
                name=region_data['name'],
                currency=region_data['currency'],
                description=region_data['desc'],
                is_active=True
            )
            db.add(region)
        
        db.commit()
        logger.info(f"Created {len(regions_data)} regions")
        
        # ==================== PROJECTS ====================
        # Need to refresh IBUs to get their IDs
        build_ibu = db.query(IBU).filter(IBU.tenant_id == tarento.id, IBU.code == 'BUILD').first()
        
        projects_data = [
            {'code': 'OP-001', 'name': 'Operations', 'desc': 'HR and Operations', 'ibu_id': None},
            {'code': 'KB-2023-01', 'name': 'IGOT Karmayogi Bharath', 'desc': 'IGOT Karmayogi Bharath', 'ibu_id': build_ibu.id if build_ibu else None},
            {'code': 'CM-2024-01', 'name': 'Cellmark', 'desc': 'Cellmark', 'ibu_id': build_ibu.id if build_ibu else None},
        ]
        
        for project_data in projects_data:
            project = Project(
                id=uuid4(),
                tenant_id=tarento.id,
                project_code=project_data['code'],
                project_name=project_data['name'],
                description=project_data['desc'],
                ibu_id=project_data['ibu_id'],
                status='ACTIVE'
            )
            db.add(project)
        
        db.commit()
        logger.info(f"Created {len(projects_data)} projects")
        
        # ==================== USERS ====================
        # First create users without manager relationships
        users_data = [
            {
                'email': 'jinson.kuruvilla@tarento.com',
                'password': 'Test@123',
                'first_name': 'Jinson',
                'last_name': 'Kuruvilla',
                'department': 'Human Resources',
                'designation': 'HR Manager',
                'employee_code': '1257',
                'roles': ['EMPLOYEE', 'HR', 'ADMIN'],
                'manager_email': None,
                'region': ['IND']
            },
            {
                'email': 'pampan.gowda@tarento.com',
                'password': 'Test@123',
                'first_name': 'Pampan',
                'last_name': 'Gowda',
                'department': 'Project Management',
                'designation': 'Senior Project Manager',
                'employee_code': '1522',
                'roles': ['EMPLOYEE', 'MANAGER'],
                'manager_email': None,
                'region': ['IND']
            },
            {
                'email': 'sureshkannan.sellamuthu@tarento.com',
                'password': 'Test@123',
                'first_name': 'Sureshkannan',
                'last_name': 'S',
                'department': 'Project Management',
                'designation': 'Manager',
                'employee_code': '1228',
                'roles': ['EMPLOYEE', 'MANAGER'],
                'manager_email': None,
                'region': ['IND']
            },
            {
                'email': 'shreevas.karanth@tarento.com',
                'password': 'Test@123',
                'first_name': 'Shreevas',
                'last_name': 'Karanth',
                'department': 'Engineering',
                'designation': 'Employee',
                'employee_code': '209',
                'roles': ['EMPLOYEE'],
                'manager_email': 'pampan.gowda@tarento.com',
                'region': ['IND']
            },
            {
                'email': 'roven.roy@tarento.com',
                'password': 'Test@123',
                'first_name': 'Roven',
                'last_name': 'Roy',
                'department': 'Human Resources',
                'designation': 'HR',
                'employee_code': '1650',
                'roles': ['EMPLOYEE', 'HR'],
                'manager_email': 'jinson.kuruvilla@tarento.com',
                'region': ['IND']
            },
            {
                'email': 'shreevatsa.sridhar@tarento.com',
                'password': 'Test@123',
                'first_name': 'Shreevatsa',
                'last_name': 'S',
                'department': 'Human Resources',
                'designation': 'HR',
                'employee_code': '231',
                'roles': ['EMPLOYEE', 'HR'],
                'manager_email': None,
                'region': ['IND']
            },
            {
                'email': 'ranjith.babu@tarento.com',
                'password': 'Test@123',
                'first_name': 'Ranjith',
                'last_name': 'Babu',
                'department': 'Finance & Accounts',
                'designation': 'Associate Manager - Revenue Operations',
                'employee_code': '914',
                'roles': ['EMPLOYEE', 'FINANCE'],
                'manager_email': None,
                'region': ['IND']
            },
            {
                'email': 'njayaprakash.8887@gmail.com',
                'password': 'Test@123',
                'first_name': 'Jayaprakash',
                'last_name': 'N',
                'department': 'Engineering',
                'designation': 'TL',
                'employee_code': '450',
                'roles': ['EMPLOYEE', 'MANAGER'],
                'manager_email': 'sureshkannan.sellamuthu@tarento.com',
                'region': ['IND']
            },
        ]
        
        # Create all users first (without manager relationships)
        users = {}
        for user_data in users_data:
            user = User(
                id=uuid4(),
                tenant_id=tarento.id,
                username=user_data['email'].split('@')[0],
                email=user_data['email'],
                hashed_password=hash_password(user_data['password']),
                first_name=user_data['first_name'],
                last_name=user_data['last_name'],
                full_name=f"{user_data['first_name']} {user_data['last_name']}",
                department=user_data['department'],
                designation=user_data['designation'],
                employee_code=user_data['employee_code'],
                employment_status='ACTIVE',
                region=user_data['region'],
                roles=user_data['roles'],
                is_active=True
            )
            db.add(user)
            users[user_data['email']] = {'user': user, 'manager_email': user_data['manager_email']}
        
        db.commit()
        logger.info(f"Created {len(users)} users")
        
        # Set manager relationships
        for email, data in users.items():
            if data['manager_email'] and data['manager_email'] in users:
                data['user'].manager_id = users[data['manager_email']]['user'].id
        
        db.commit()
        logger.info("Set manager relationships")
        
        # Print summary
        print("\n" + "="*70)
        print("  TARENTO TEST DATA CREATED SUCCESSFULLY")
        print("="*70)
        print(f"\n  Platform Tenant: EasyQlaim Platform (code: PLATFORM)")
        print(f"  Tarento Tenant: Tarento Technologies Pvt. Ltd. (code: TARENTO)")
        print(f"  Departments: {len(departments_data)}")
        print(f"  Designations: {len(designations_data)}")
        print(f"  IBUs: {len(ibus_data)}")
        print(f"  Regions: {len(regions_data)}")
        print(f"  Projects: {len(projects_data)}")
        print(f"  Users: {len(users_data)} + 1 System Admin")
        print("\n  System Admin Credentials:")
        print("  " + "-"*66)
        print(f"  {'system_admin@easyqlaim.com':<40} | {'Admin@123':<15} | SYSTEM_ADMIN")
        print("  " + "-"*66)
        print("\n  Tarento User Credentials:")
        print("  " + "-"*66)
        print(f"  {'Email':<40} | {'Password':<15} | Roles")
        print("  " + "-"*66)
        for user_data in users_data:
            roles = ', '.join(user_data['roles'])
            print(f"  {user_data['email']:<40} | {user_data['password']:<15} | {roles}")
        print("  " + "-"*66)
        print("\n")
        
    except Exception as e:
        logger.error(f"Error creating test data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_test_data()
