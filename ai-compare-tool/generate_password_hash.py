"""
Run this once to turn your chosen password into a hash for APP_PASSWORD_HASH.
The plain password is never stored anywhere — only this hash is.

Usage:
    python generate_password_hash.py
"""

import getpass
from werkzeug.security import generate_password_hash

if __name__ == "__main__":
    password = getpass.getpass("Choose a password: ")
    confirm = getpass.getpass("Confirm password: ")

    if password != confirm:
        raise SystemExit("Passwords did not match.")
    if len(password) < 8:
        raise SystemExit("Use at least 8 characters.")

    print("\nAdd this line to your .env file (locally) and as a Fly secret:\n")
    print(f"APP_PASSWORD_HASH={generate_password_hash(password)}")
