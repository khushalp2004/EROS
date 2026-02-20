from utils.validators import (
    validate_email_format,
    validate_password_strength,
    validate_required_fields,
)


def test_validate_email_format_accepts_valid_email():
    assert validate_email_format("student@example.com") is True


def test_validate_email_format_rejects_invalid_email():
    assert validate_email_format("student-at-example.com") is False


def test_validate_password_strength_accepts_strong_password():
    assert validate_password_strength("StrongPass123!") is True


def test_validate_password_strength_rejects_weak_password():
    assert validate_password_strength("weak") is False


def test_validate_required_fields_returns_missing_fields():
    is_valid, missing = validate_required_fields({"email": "a@b.com"}, ["email", "password"])
    assert is_valid is False
    assert missing == ["password"]
