"""
Script to add highlighting-support columns to `document_chunks`.
This enables more reliable PDF highlighting by storing per-page offsets and short anchor phrases.
"""

from sqlalchemy import text
from app.database import engine


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    q = text(
        """
        SELECT COUNT(*) AS cnt
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = :table_name
          AND column_name = :column_name
        """
    )
    res = conn.execute(q, {"table_name": table_name, "column_name": column_name}).mappings().first()
    return (res or {}).get("cnt", 0) > 0


def update_document_chunks_schema():
    """Add new columns if missing."""
    try:
        with engine.connect() as conn:
            table = "document_chunks"

            # These are nullable for backward compatibility; new documents will populate them.
            to_add = [
                ("page_start_char", "INT NULL"),
                ("page_end_char", "INT NULL"),
                ("anchor_start", "TEXT NULL"),
                ("anchor_end", "TEXT NULL"),
                ("anchor_middle", "TEXT NULL"),
            ]

            for col, col_type in to_add:
                if _column_exists(conn, table, col):
                    continue
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))

            conn.commit()
            print("✅ Successfully updated `document_chunks` schema for highlighting")

    except Exception as e:
        print(f"❌ Error updating document_chunks schema: {str(e)}")
        raise


if __name__ == "__main__":
    print("Updating document_chunks schema for highlighting...")
    update_document_chunks_schema()
    print("Done!")





