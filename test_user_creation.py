#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.models.user import User
from backend.models import db
from backend.config import Config
from flask import Flask

app = Flask(__name__)
app.config.from_object(Config)

with app.app_context():
    db.init_app(app)
    db.create_all()

    try:
        print("Creating user...")
        user = User(
            email="test@example.com",
            password="TestPass123!",
            first_name="Test",
            last_name="User",
            phone="+1234567890",
            organization="Test Org",
            role="reporter"
        )
        print("User created, saving...")
        user.save()
        print("User saved successfully!")
        print(f"User ID: {user.id}")
        print(f"User email: {user.email}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
