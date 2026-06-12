🔒 Disable debug mode by default in settings

🎯 **What:** The `DEBUG` setting in `saleor/settings.py` was defaulting to `True`.
⚠️ **Risk:** Running a production app with `DEBUG = True` exposes sensitive information, paths, environment variables, and could potentially lead to Remote Code Execution via debug pages.
🛡️ **Solution:** Changed the default value of the `DEBUG` environment variable fallback from `True` to `False` by altering the default parameter in `get_bool_from_env("DEBUG", False)`.
