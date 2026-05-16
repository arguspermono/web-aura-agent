import os
# pyright: ignore [missing-import]
from dotenv import load_dotenv
# pyright: ignore [missing-import]
import firebase_admin
from firebase_admin import credentials, db

# Load environment variables
load_dotenv()

def test_connection():
    print("Testing Firebase Connection...")
    
    # 1. Get credentials path and DB URL
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    db_url = os.getenv("FIREBASE_DATABASE_URL")
    
    print(f"Using Credentials: {cred_path}")
    print(f"Using Database URL: {db_url}")

    try:
        # 2. Initialize Firebase
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {
            'databaseURL': db_url
        })
        print("\nSUCCESS: Successfully initialized Firebase App.")

        # 3. Try to write and read from the Realtime Database
        print("Attempting to write to database...")
        ref = db.reference('connection_test')
        ref.set({
            'status': 'Connected!',
            'timestamp': 'test_time'
        })
        
        # Read it back
        data = ref.get()
        print(f"SUCCESS: Successfully read back data: {data}")
        print("\nSUCCESS: You are fully connected and communicating with Firebase!")
        
    except Exception as e:
        print("\nFAILED: Failed to connect or communicate with Firebase.")
        print(f"Error details: {str(e)}")

if __name__ == "__main__":
    test_connection()
