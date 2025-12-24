from flask import Blueprint, jsonify, request
from models import Unit

unit_bp = Blueprint('unit_bp', __name__)

@unit_bp.route('/units', methods=['GET'])
def get_units():
    units = Unit.query.all()
    output = []
    for u in units:
        output.append({
            'unit_id': u.unit_id,
            'service_type': u.service_type,
            'latitude': u.latitude,
            'longitude': u.longitude,
            'status': u.status,
            'last_updated': u.last_updated
        })
    
    return jsonify(output)
