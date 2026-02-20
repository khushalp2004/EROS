import re
import email_validator
from email_validator import validate_email, EmailNotValidError

def validate_email_format(email):
    """
    Validate email format using email-validator library

    Args:
        email (str): Email to validate

    Returns:
        bool: True if valid, False otherwise
    """
    try:
        if not email or not isinstance(email, str):
            return False

        # Use email-validator library for robust validation
        valid = validate_email(email)
        return True

    except (EmailNotValidError, ValueError, TypeError):
        return False

def validate_password_strength(password):
    """
    Validate password strength requirements
    
    Requirements:
    - At least 8 characters long
    - Contains at least one uppercase letter
    - Contains at least one lowercase letter
    - Contains at least one digit
    - Contains at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
    
    Args:
        password (str): Password to validate
        
    Returns:
        bool: True if password meets all requirements, False otherwise
    """
    if not password or not isinstance(password, str):
        return False
    
    # Check minimum length
    if len(password) < 8:
        return False
    
    # Check for uppercase letter
    if not re.search(r'[A-Z]', password):
        return False
    
    # Check for lowercase letter
    if not re.search(r'[a-z]', password):
        return False
    
    # Check for digit
    if not re.search(r'\d', password):
        return False
    
    # Check for special character
    special_chars = r'[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]'
    if not re.search(special_chars, password):
        return False
    
    return True

def validate_phone_number(phone):
    """
    Validate phone number format
    
    Args:
        phone (str): Phone number to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    if not phone or not isinstance(phone, str):
        return False
    
    # Remove common separators
    clean_phone = re.sub(r'[^\d+]', '', phone)
    
    # Check if it's a valid phone number (7-15 digits)
    if len(clean_phone) < 7 or len(clean_phone) > 15:
        return False
    
    # Basic pattern check
    phone_pattern = r'^[\+]?[1-9][\d]{0,15}$'
    return bool(re.match(phone_pattern, clean_phone))

def validate_name(name, min_length=2, max_length=100):
    """
    Validate name field
    
    Args:
        name (str): Name to validate
        min_length (int): Minimum length
        max_length (int): Maximum length
        
    Returns:
        bool: True if valid, False otherwise
    """
    if not name or not isinstance(name, str):
        return False
    
    # Remove leading/trailing whitespace
    clean_name = name.strip()
    
    # Check length
    if len(clean_name) < min_length or len(clean_name) > max_length:
        return False
    
    # Check for valid characters (letters, spaces, hyphens, apostrophes)
    name_pattern = r'^[a-zA-Z\s\-\'\.]+$'
    return bool(re.match(name_pattern, clean_name))

def validate_role(role):
    """
    Validate user role
    
    Args:
        role (str): Role to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    valid_roles = ['admin', 'authority', 'reporter', 'unit']
    return role in valid_roles

def validate_token(token):
    """
    Validate token format
    
    Args:
        token (str): Token to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    if not token or not isinstance(token, str):
        return False
    
    # Basic token validation (alphanumeric and some special chars)
    token_pattern = r'^[a-zA-Z0-9_\-\.]+$'
    return bool(re.match(token_pattern, token))

def validate_url(url):
    """
    Validate URL format
    
    Args:
        url (str): URL to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    if not url or not isinstance(url, str):
        return False
    
    url_pattern = r'^https?://[^\s/$.?#].[^\s]*$'
    return bool(re.match(url_pattern, url))

def sanitize_input(input_str):
    """
    Sanitize user input by removing potentially dangerous characters
    
    Args:
        input_str (str): Input to sanitize
        
    Returns:
        str: Sanitized input
    """
    if not input_str or not isinstance(input_str, str):
        return ""
    
    # Remove null bytes and control characters
    sanitized = ''.join(char for char in input_str if ord(char) >= 32 or char in ['\n', '\r', '\t'])
    
    # Strip leading/trailing whitespace
    return sanitized.strip()

def validate_json_field(data, field_name, field_type=str, required=True, min_length=None, max_length=None):
    """
    Validate a field in JSON data
    
    Args:
        data (dict): JSON data
        field_name (str): Name of field to validate
        field_type (type): Expected type of field
        required (bool): Whether field is required
        min_length (int): Minimum length for string fields
        max_length (int): Maximum length for string fields
        
    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    if field_name not in data:
        if required:
            return False, f"Field '{field_name}' is required"
        return True, None
    
    value = data[field_name]
    
    # Type check
    if not isinstance(value, field_type):
        return False, f"Field '{field_name}' must be of type {field_type.__name__}"
    
    # String-specific validations
    if field_type == str:
        if min_length is not None and len(value) < min_length:
            return False, f"Field '{field_name}' must be at least {min_length} characters"
        
        if max_length is not None and len(value) > max_length:
            return False, f"Field '{field_name}' must be at most {max_length} characters"
    
    return True, None

def validate_required_fields(data, required_fields):
    """
    Validate that all required fields are present and not empty
    
    Args:
        data (dict): Data to validate
        required_fields (list): List of required field names
        
    Returns:
        tuple: (is_valid: bool, missing_fields: list)
    """
    missing_fields = []
    
    for field in required_fields:
        if field not in data or not data[field]:
            missing_fields.append(field)
    
    return len(missing_fields) == 0, missing_fields

def validate_email_domain(email):
    """
    Check if email domain is allowed (optional feature)
    
    Args:
        email (str): Email to check
        
    Returns:
        bool: True if domain is allowed, False otherwise
    """
    if not validate_email(email):
        return False
    
    # List of allowed domains (empty list = allow all)
    allowed_domains = []
    
    if not allowed_domains:
        return True
    
    domain = email.split('@')[1].lower()
    return domain in [d.lower() for d in allowed_domains]

def generate_secure_token(length=32):
    """
    Generate a secure random token
    
    Args:
        length (int): Length of token
        
    Returns:
        str: Secure random token
    """
    import secrets
    import string
    
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))
