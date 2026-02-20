try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address, default_limits=[])
except Exception:
    class _NoopLimiter:
        def init_app(self, app):
            return app

        def limit(self, _rule):
            def decorator(func):
                return func
            return decorator

    limiter = _NoopLimiter()
