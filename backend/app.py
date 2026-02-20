# from flask import Flask
# from flask_cors import CORS
# from config import SQLALCHEMY_DATABASE_URI, SQLALCHEMY_TRACK_MODIFICATIONS
# from models import db
# from routes.unit_routes import unit_bp
# from routes.authority_routes import authority_bp
# from routes.emergency_routes import emergency_bp
# from routes.notification_routes import notification_bp
# from events import socketio, start_unit_simulation

# app = Flask(__name__)

# # SIMPLE CORS (development safe)
# CORS(
#     app,
#     resources={r"/*": {"origins": ["http://localhost:3000"]}},
#     supports_credentials=True
# )


# app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
# app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = SQLALCHEMY_TRACK_MODIFICATIONS

# db.init_app(app)

# socketio.init_app(
#     app,
#     cors_allowed_origins=["http://localhost:3000"],
#     cors_credentials=True
# )


# # Blueprints
# app.register_blueprint(unit_bp)
# app.register_blueprint(emergency_bp)
# app.register_blueprint(authority_bp)
# app.register_blueprint(notification_bp)

# @app.route("/")
# def home():
#     return "Backend running"

# if __name__ == "__main__":
#     with app.app_context():
#         db.create_all()
    

#     start_unit_simulation(app)
#     socketio.run(app, debug=True, port=5001)


import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import SQLALCHEMY_DATABASE_URI, SQLALCHEMY_TRACK_MODIFICATIONS, SECRET_KEY
from models import db
from extensions import limiter
from routes.unit_routes import unit_bp
from routes.authority_routes import authority_bp
from routes.emergency_routes import emergency_bp
from routes.notification_routes import notification_bp
from routes.location_routes import location_bp
from routes.auth_routes import auth_bp
from routes.admin_routes import admin_bp
from events import socketio, init_websocket

app = Flask(__name__)

# Enhanced CORS configuration for development
CORS(
    app,
    origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://localhost:3001"],
    supports_credentials=False,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-CSRFToken"]
)

# App configuration
app.config["SQLALCHEMY_DATABASE_URI"] = SQLALCHEMY_DATABASE_URI
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = SQLALCHEMY_TRACK_MODIFICATIONS

# JWT Configuration
app.config["JWT_SECRET_KEY"] = SECRET_KEY
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 86400  # 24 hours
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = 2592000  # 30 days
app.config["JWT_ALGORITHM"] = "HS256"
app.config["JWT_IDENTITY_CLAIM"] = "sub"
app.config["RATELIMIT_STORAGE_URI"] = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
app.config["RATELIMIT_HEADERS_ENABLED"] = True

# Initialize extensions
db.init_app(app)
jwt = JWTManager(app)
limiter.init_app(app)

# Initialize WebSocket
socketio = init_websocket(app)

# Blueprints
app.register_blueprint(unit_bp, url_prefix='/api')
app.register_blueprint(emergency_bp, url_prefix='/api')
app.register_blueprint(authority_bp, url_prefix='/api')
app.register_blueprint(notification_bp, url_prefix='/api')
app.register_blueprint(location_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(admin_bp)

@app.route("/")
def home():
    return {"status": "Backend running successfully", "websocket": "enabled"}

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    
    # Get port from environment variable, default to 5001
    port = int(os.environ.get('PORT', 5001))
    
    # Run with SocketIO
    socketio.run(app, debug=True, port=port, host='0.0.0.0', allow_unsafe_werkzeug=True)
