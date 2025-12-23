from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .unit import Unit
from .emergency import Emergency
