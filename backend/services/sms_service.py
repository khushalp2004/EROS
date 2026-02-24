import os
import requests


class SMSService:
    _runtime_enabled = os.getenv("SMS_SERVICE_ENABLED", "true").strip().lower() not in {"0", "false", "off", "no"}

    def __init__(self):
        self.provider = os.getenv("SMS_PROVIDER", "twilio").lower()
        self.twilio_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        self.twilio_auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        self.twilio_from_number = os.getenv("TWILIO_FROM_NUMBER", "")

    @classmethod
    def is_enabled(cls):
        return cls._runtime_enabled

    @classmethod
    def set_enabled(cls, enabled):
        cls._runtime_enabled = bool(enabled)

    def _can_send_twilio(self):
        return bool(self.twilio_sid and self.twilio_auth_token and self.twilio_from_number)

    def send_tracking_link(self, to_phone, request_id, tracking_url, unit=None, driver=None):
        if not to_phone:
            return False, "Reporter phone is missing"
        normalized_phone = self._normalize_e164(to_phone)
        if not normalized_phone:
            return False, "Invalid reporter phone. Use E.164 format, e.g. +919876543210."

        lines = [
            f"EROS Alert: Emergency #{request_id} received.",
            f"Live tracking: {tracking_url}",
        ]

        if unit:
            lines.append(f"Unit: {unit.get('unit_vehicle_number', 'N/A')}")

        if driver:
            if driver.get("name"):
                lines.append(f"Driver: {driver['name']}")
            if driver.get("phone"):
                lines.append(f"Driver Phone: {driver['phone']}")

        if not unit:
            lines.append("Unit details will appear after dispatch.")

        body = "\n".join(lines)

        if self.provider == "twilio":
            return self._send_twilio_sms(normalized_phone, body)

        return False, f"Unsupported SMS provider: {self.provider}"

    def send_assignment_pending_message(self, to_phone, request_id):
        if not to_phone:
            return False, "Reporter phone is missing"
        normalized_phone = self._normalize_e164(to_phone)
        if not normalized_phone:
            return False, "Invalid reporter phone. Use E.164 format, e.g. +919876543210."

        body = (
            f"EROS Alert: Emergency #{request_id} received.\n"
            "Tracking link will be sent when your emergency is assigned to a unit."
        )
        if self.provider == "twilio":
            return self._send_twilio_sms(normalized_phone, body)
        return False, f"Unsupported SMS provider: {self.provider}"

    def send_assigned_tracking_message(self, to_phone, request_id, tracking_url, unit_plate, driver_name=None, driver_phone=None):
        if not to_phone:
            return False, "Reporter phone is missing"
        normalized_phone = self._normalize_e164(to_phone)
        if not normalized_phone:
            return False, "Invalid reporter phone. Use E.164 format, e.g. +919876543210."

        lines = [
            f"EROS Alert: Emergency #{request_id} has been assigned.",
            f"Track live: {tracking_url}",
            f"Unit Plate: {unit_plate or 'N/A'}",
        ]
        if driver_name:
            lines.append(f"Driver: {driver_name}")
        if driver_phone:
            lines.append(f"Driver Phone: {driver_phone}")

        body = "\n".join(lines)
        if self.provider == "twilio":
            return self._send_twilio_sms(normalized_phone, body)
        return False, f"Unsupported SMS provider: {self.provider}"

    def _send_twilio_sms(self, to_phone, body):
        if not self.is_enabled():
            return False, "SMS service is currently disabled by admin."
        if not self._can_send_twilio():
            return False, "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER."

        endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{self.twilio_sid}/Messages.json"
        return self._send_twilio_message(endpoint, to_phone, self.twilio_from_number, body, channel="SMS")

    def _send_twilio_message(self, endpoint, to_value, from_value, body, channel="Message"):
        try:
            response = requests.post(
                endpoint,
                data={
                    "To": to_value,
                    "From": from_value,
                    "Body": body,
                },
                auth=(self.twilio_sid, self.twilio_auth_token),
                timeout=10,
            )
            if 200 <= response.status_code < 300:
                return True, f"{channel} sent successfully"
            return False, f"Twilio error {response.status_code}: {response.text}"
        except Exception as exc:
            return False, f"{channel} send failed: {str(exc)}"

    def _normalize_e164(self, phone):
        phone = (phone or "").strip()
        if not phone:
            return None
        if phone.startswith("+"):
            digits = "+" + "".join(ch for ch in phone[1:] if ch.isdigit())
        else:
            digits = "+" + "".join(ch for ch in phone if ch.isdigit())
        if len(digits) < 8 or len(digits) > 16:
            return None
        return digits
