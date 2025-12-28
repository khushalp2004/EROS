import os
import secrets

# JWT Secret Key (use environment variable or fixed key for development)
SECRET_KEY = os.getenv('JWT_SECRET_KEY') or 'dev-secret-key-change-in-production-2024'

# Database Configuration
SQLALCHEMY_DATABASE_URI = f'postgresql://postgres:khushalpatil29@db.pmiuqgtnztqnscvlldoj.supabase.co:5432/postgres'
SQLALCHEMY_TRACK_MODIFICATIONS = False

# Base URL for OSRM routing (change to your own OSRM host if self-hosted)
OSRM_BASE_URL = "http://router.project-osrm.org"

# Email Configuration (for development - using console backend)
MAIL_SERVER = 'smtp.gmail.com'
MAIL_PORT = 587
MAIL_USE_TLS = True
MAIL_USERNAME = os.getenv('MAIL_USERNAME', 'patilkhushal54321@gmail.com')
MAIL_PASSWORD = os.getenv('MAIL_PASSWORD', 'jwrb tzfk gklm nzor')
MAIL_DEFAULT_SENDER = os.getenv('MAIL_USERNAME', 'patilkhushal54321@gmail.com')
