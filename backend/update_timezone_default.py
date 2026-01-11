"""
Script to update timezone default value to Asia/Ho_Chi_Minh
Run this script to update existing NULL timezone values and change default
"""
from sqlalchemy import text
from app.database import engine

def update_timezone_default():
    """Update timezone default and set NULL values to Asia/Ho_Chi_Minh"""
    try:
        with engine.connect() as conn:
            # Update existing NULL timezone values
            conn.execute(text("""
                UPDATE users 
                SET timezone = 'Asia/Ho_Chi_Minh'
                WHERE timezone IS NULL OR timezone = 'UTC'
            """))
            
            # Change default value for the column
            conn.execute(text("""
                ALTER TABLE users 
                MODIFY COLUMN timezone VARCHAR(100) DEFAULT 'Asia/Ho_Chi_Minh'
            """))
            
            conn.commit()
            print("✅ Successfully updated timezone default to 'Asia/Ho_Chi_Minh'")
            print("✅ Updated existing NULL/UTC timezone values to 'Asia/Ho_Chi_Minh'")
                
    except Exception as e:
        print(f"❌ Error updating timezone default: {str(e)}")
        raise

if __name__ == "__main__":
    print("Updating timezone default to Asia/Ho_Chi_Minh...")
    update_timezone_default()
    print("Done!")


