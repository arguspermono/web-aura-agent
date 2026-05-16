import sys
import os
from pathlib import Path

# Add project root to PYTHONPATH so we can import core.config
project_root = Path(__file__).resolve().parent.parent
sys.path.append(str(project_root))

from firebase_admin import auth, credentials
import firebase_admin
from core.config import settings

def main():
    if len(sys.argv) != 2:
        print("Usage: python set_admin.py <FIREBASE_UID>")
        sys.exit(1)

    uid = sys.argv[1]

    # Initialize Firebase Admin SDK
    try:
        # Check if already initialized to avoid ValueError
        firebase_admin.get_app()
    except ValueError:
        if settings.GOOGLE_APPLICATION_CREDENTIALS:
            cred = credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)
            firebase_admin.initialize_app(cred)
        else:
            # Assumes GOOGLE_APPLICATION_CREDENTIALS is set in env or running on GCP
            firebase_admin.initialize_app()

    print(f"Setting admin claim for user: {uid}")
    try:
        auth.set_custom_user_claims(uid, {'admin': True})
        
        # Verify it was set
        user = auth.get_user(uid)
        print(f"Success! User {uid} claims: {user.custom_claims}")
        print("\nNOTE: The user must log out and log back in to get a fresh token with the admin claim.")
    except Exception as e:
        print(f"Error setting custom claims: {e}")

if __name__ == "__main__":
    main()
