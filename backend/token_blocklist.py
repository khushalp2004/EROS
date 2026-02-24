from models import db, RevokedToken


def revoke_token(jti):
    if not jti:
        return
    token_id = str(jti)
    exists = RevokedToken.query.filter_by(jti=token_id).first()
    if exists:
        return
    db.session.add(RevokedToken(jti=token_id))
    db.session.commit()


def is_token_revoked(jti):
    if not jti:
        return False
    token_id = str(jti)
    return RevokedToken.query.filter_by(jti=token_id).first() is not None
