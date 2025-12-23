from flask import Flask
from flask_cors import CORS
from config import SQLALCHEMY_DATABASE_URI, SQLALCHEMY_TRACK_MODIFICATIONS
from models import db
from routes.unit_routes import unit_bp
from routes.authority_routes import authority_bp
from routes.emergency_routes import emergency_bp


app = Flask(__name__)
CORS(app, supports_credentials=True)  # ✅ This allows requests from React frontend
app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = SQLALCHEMY_TRACK_MODIFICATIONS


db.init_app(app)

# Register blueprints
app.register_blueprint(unit_bp)
app.register_blueprint(emergency_bp)
app.register_blueprint(authority_bp)

@app.route('/')
def home():
    return "Server is running with Supabase!"

if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # Create tables if they don't exist
    app.run(debug=True, port=5000)
