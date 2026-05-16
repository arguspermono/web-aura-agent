"""
Clear Firestore 'users' collection.
Usage:
  python scripts/clear_firestore_users.py          # List all user docs
  python scripts/clear_firestore_users.py --delete  # Delete all user docs
"""
import sys
import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {"projectId": "aura-agent-495809"})

db = firestore.client()

def list_users():
    docs = list(db.collection("users").stream())
    for doc in docs:
        data = doc.to_dict()
        print(f"  ID: {doc.id}  |  username: {data.get('username')}  |  role: {data.get('role')}  |  email: {data.get('email')}")
    if not docs:
        print("  No user documents found in Firestore.")
    else:
        print(f"\n  Total: {len(docs)} document(s)")
    return docs

def delete_all(docs):
    if not docs:
        print("  Nothing to delete.")
        return
    for doc in docs:
        doc.reference.delete()
    print(f"\n  [OK] Deleted {len(docs)} document(s) from 'users' collection")

if __name__ == "__main__":
    print("\n  Firestore 'users' Collection")
    print("  ----------------------------\n")
    docs = list_users()
    if "--delete" in sys.argv:
        print("\n  Deleting ALL user documents...")
        delete_all(docs)
    else:
        print("\n  Run with --delete to remove all.")
