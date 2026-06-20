#!/usr/bin/env python3
"""Import cleaned hospital JSON data into SQLite for Prisma."""
import json
import sqlite3
import os

DB_PATH = "/home/z/my-project/db/custom.db"
JSON_PATH = "/home/z/my-project/download/hospitals_cleaned.json"

# Read cleaned data
with open(JSON_PATH, 'r', encoding='utf-8') as f:
    hospitals = json.load(f)

print(f"Loading {len(hospitals)} hospitals...")

# Connect to SQLite
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Clear existing data
cur.execute("DELETE FROM Hospital")

# Insert in batches
batch_size = 500
inserted = 0
errors = 0

for i, h in enumerate(hospitals):
    try:
        lat = h.get('lat')
        lng = h.get('lng')
        
        cur.execute("""
            INSERT INTO Hospital (id, name, address, city, state, district, pincode, 
                lat, lng, category, careType, discipline, ownership, beds, emergency, 
                phones, specialties, facilities)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            h['id'],
            h['name'][:500],
            h.get('address', '')[:500],
            h.get('city', '')[:100],
            h.get('state', '')[:100],
            h.get('district', '')[:100],
            h.get('pincode', '')[:20],
            lat,
            lng,
            json.dumps(h.get('category', ['general'])),
            h.get('careType', '')[:200],
            h.get('discipline', '')[:200],
            h.get('ownership', 'Unknown')[:50],
            h.get('beds', 0),
            h.get('emergency', False),
            json.dumps(h.get('phones', [])),
            h.get('specialties', '')[:2000],
            h.get('facilities', '')[:2000],
        ))
        inserted += 1
    except Exception as e:
        errors += 1
        if errors <= 5:
            print(f"Error at row {i}: {e}")
    
    if (i + 1) % batch_size == 0:
        conn.commit()
        print(f"  Imported {i + 1}/{len(hospitals)}...")

conn.commit()
cur.execute("SELECT COUNT(*) FROM Hospital")
count = cur.fetchone()[0]
conn.close()

print(f"\nDone! Inserted: {inserted}, Errors: {errors}, DB count: {count}")
