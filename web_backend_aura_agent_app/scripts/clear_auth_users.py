"""
Clear Firebase Authentication users.
Usage:
  python scripts/clear_auth_users.py          # List all users
  python scripts/clear_auth_users.py --delete  # Delete all users (DESTRUCTIVE!)
"""
import sys
import firebase_admin
from firebase_admin import credentials, auth

# Initialize with ADC (uses your gcloud login)
cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {
    "projectId": "aura-agent-495809",
})

def list_users():
    """List all Firebase Auth users."""
    page = auth.list_users()
    users = []
    for user in page.iterate_all():
        users.append(user)
        print(f"  UID: {user.uid}  |  Email: {user.email}  |  Created: {user.user_metadata.creation_timestamp}")
    
    if not users:
        print("  No users found in Firebase Authentication.")
    else:
        print(f"\n  Total: {len(users)} user(s)")
    return users

def delete_all_users(users):
    """Delete all Firebase Auth users."""
    if not users:
        print("  No users to delete.")
        return
    
    uids = [u.uid for u in users]
    result = auth.delete_users(uids)
    print(f"\n  [OK] Deleted {result.success_count} user(s)")
    if result.failure_count:
        print(f"  [FAIL] Failed to delete {result.failure_count} user(s)")
        for err in result.errors:
            print(f"     - {err.reason}")

if __name__ == "__main__":
    print("\n  Firebase Auth Users")
    print("  -------------------\n")
    
    users = list_users()
    
    if "--delete" in sys.argv:
        print("\n  [!] Deleting ALL users...")
        delete_all_users(users)
    else:
        print("\n  Run with --delete to remove all users.")
        print("  Example: python scripts/clear_auth_users.py --delete")
