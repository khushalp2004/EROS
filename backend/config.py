import os
from dotenv import load_dotenv

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_BASE_DIR, ".env"))

# Security
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
if not SECRET_KEY or SECRET_KEY == "change-this-in-production":
    raise RuntimeError("JWT_SECRET_KEY must be set to a strong non-default value.")

# Database
SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
if not SQLALCHEMY_DATABASE_URI:
    raise RuntimeError("DATABASE_URL is required. SQLite fallback is disabled.")
SQLALCHEMY_TRACK_MODIFICATIONS = False

# Routing provider
OSRM_BASE_URL = os.getenv("OSRM_BASE_URL", "https://router.project-osrm.org")

# Email
MAIL_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
MAIL_PORT = int(os.getenv("SMTP_PORT", "587"))
MAIL_USE_TLS = True
MAIL_USERNAME = os.getenv("SMTP_USERNAME", "")
MAIL_PASSWORD = os.getenv("SMTP_PASSWORD", "")
MAIL_DEFAULT_SENDER = os.getenv("FROM_EMAIL", "")
