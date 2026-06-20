#!/usr/bin/env python3
"""
Clean and process the Indian hospital directory CSV for use in a Next.js web app.
Input:  /home/z/my-project/upload/hospital_directory__.csv
Output: /home/z/my-project/download/hospitals_cleaned.json
        /home/z/my-project/download/hospitals_summary.json
"""

import csv
import json
import re
import sys

INPUT_CSV  = "/home/z/my-project/upload/hospital_directory__.csv"
OUTPUT_JSON = "/home/z/my-project/download/hospitals_cleaned.json"
SUMMARY_JSON = "/home/z/my-project/download/hospitals_summary.json"

# ---------------------------------------------------------------------------
# 1. State normalisation map
# ---------------------------------------------------------------------------
STATE_FIXES = {
    "North Twenty Four Parganas": "West Bengal",
}

# Canonical Indian states / UTs (for validation / fuzzy matching)
CANONICAL_STATES = {
    "Andaman and Nicobar Islands",
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chandigarh",
    "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu",  # merged UT since 2020
    "Dadra and Nagar Haveli",
    "Daman and Diu",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jammu and Kashmir",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Ladakh",
    "Lakshadweep",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Puducherry",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
}


def normalize_state(raw_state: str) -> str:
    """Return a clean, canonical Indian state/UT name."""
    s = raw_state.strip()
    # Direct fixes
    if s in STATE_FIXES:
        return STATE_FIXES[s]
    # Already canonical
    if s in CANONICAL_STATES:
        return s
    # Title-case normalisation (just in case)
    titled = s.title()
    if titled in CANONICAL_STATES:
        return titled
    # Return cleaned value as-is if nothing matches
    return s


# ---------------------------------------------------------------------------
# 2. Coordinate parsing
# ---------------------------------------------------------------------------
def parse_coordinates(coord_str: str):
    """Parse 'lat, lng' string. Returns (lat, lng) or (None, None)."""
    if not coord_str or coord_str.strip() == "0":
        return None, None
    parts = coord_str.split(",")
    if len(parts) != 2:
        return None, None
    try:
        lat = float(parts[0].strip())
        lng = float(parts[1].strip())
        # Basic sanity: India bounds  lat 6-38, lng 68-98
        if 6.0 <= lat <= 38.0 and 68.0 <= lng <= 98.0:
            return lat, lng
        return lat, lng  # still return even if slightly out of bounds
    except ValueError:
        return None, None


# ---------------------------------------------------------------------------
# 3. Category detection
# ---------------------------------------------------------------------------
CATEGORY_PATTERNS = {
    "cardiac": [
        r"\bcardiol", r"\bheart\b", r"\bcardio\s?thorac", r"\bcardio\s?vascular",
        r"\bcardiac\b", r"\binterventional\s+cardiol",
    ],
    "pediatric": [
        r"\bpediatr", r"\bpaediatr", r"\bchild", r"\bneonat", r"\bneonatol",
    ],
    "orthopedic": [
        r"\borthop", r"\bbone\b", r"\bjoint\b", r"\bspine\b", r"\bsports\s+injur",
        r"\bjoint\s+replacement",
    ],
    "neuro": [
        r"\bneuro\s?surg", r"\bneurol", r"\bbrain\b", r"\bneuroradiol",
    ],
    "oncology": [
        r"\boncol", r"\bcancer\b", r"\btumor\b", r"\btumour\b", r"\bradiat.*oncol",
        r"\bsurgical\s+oncol", r"\bmedical\s+oncol",
    ],
    "trauma": [
        r"\btrauma\b", r"\baccident\b", r"\bemergency\s+med", r"\bcritical\s+care\b",
    ],
    "maternity": [
        r"\bmaternit", r"\bobstetr", r"\bgyn(a)?ecol", r"\bfetal\b", r"\bfertility\b",
    ],
    "eye": [
        r"\bophthalmol", r"\beye\b",
    ],
    "dental": [
        r"\bdent", r"\borthodont", r"\bmaxillofacial",
    ],
    "ent": [
        r"\bent\b", r"\botorhinol", r"\bear\b.*\bnose\b", r"\bhead\s+and\s+neck\b",
    ],
    "ayurveda": [
        r"\bayurv", r"\bsiddha\b", r"\bhomeopath", r"\bnaturopath", r"\bunani\b",
    ],
    "mental": [
        r"\bpsychiatr", r"\bpsychol", r"\bmental\s+health\b", r"\bpsych",
    ],
    "transplant": [
        r"\btransplant", r"\borgan\s+donat", r"\bbone\s+marrow\b", r"\bkidney\s+transplant",
        r"\bliver\s+transplant",
    ],
    "rehab": [
        r"\brehab", r"\bphysiother", r"\bphysical\s+therap", r"\boccupational\s+therap",
    ],
    "diagnostic": [
        r"\bpathol", r"\blab(oratory)?\b", r"\bdiagnost", r"\bradiol", r"\bradio\s?diagnos",
        r"\bmicro\s?biol", r"\bbio\s?chem", r"\btransfusion\b",
    ],
    "phc": [
        r"\bprimary\s+health\b", r"\bcommunity\s+health\b", r"\bphc\b", r"\bchc\b",
    ],
    "clinic": [
        r"\bclinic\b", r"\bdispensar", r"\bpoly\s+clinic\b",
    ],
}


def categorize_hospital(specialties: str, care_type: str, discipline: str) -> list:
    """
    Determine hospital categories from specialties, care type, and discipline.
    Returns a list of category strings (can be multiple).
    """
    categories = set()
    # Combine all text for matching
    search_text = f"{specialties} {care_type} {discipline}".lower()

    for cat, patterns in CATEGORY_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, search_text):
                categories.add(cat)
                break  # one match is enough per category

    # If no categories found, assign based on care type fallback
    if not categories:
        ct = care_type.lower()
        if "primary health" in ct or "community health" in ct:
            categories.add("phc")
        elif "clinic" in ct or "dispensary" in ct or "poly clinic" in ct:
            categories.add("clinic")
        elif "medical college" in ct:
            categories.add("general")
        elif "nursing home" in ct:
            categories.add("general")
        elif "hospital" in ct:
            categories.add("general")
        else:
            categories.add("general")

    return sorted(categories)


# ---------------------------------------------------------------------------
# 4. Phone number cleaning
# ---------------------------------------------------------------------------
def clean_phones(telephone: str, mobile: str, emergency: str) -> list:
    """Combine phone fields into a deduplicated list, removing '0' and blanks."""
    raw = []
    for field in [telephone, mobile, emergency]:
        if not field or field.strip() in ("0", ""):
            continue
        # Some fields have comma-separated numbers
        for num in field.split(","):
            n = num.strip()
            if n and n != "0":
                raw.append(n)
    # Deduplicate while preserving order
    seen = set()
    result = []
    for n in raw:
        if n not in seen:
            seen.add(n)
            result.append(n)
    return result


# ---------------------------------------------------------------------------
# 5. Utility helpers
# ---------------------------------------------------------------------------
def clean_str(val: str) -> str:
    """Clean a string field: strip whitespace, replace '0' with empty."""
    v = val.strip()
    return "" if v == "0" else v


def parse_int(val: str) -> int:
    """Parse integer, return 0 on failure."""
    try:
        v = int(val.strip())
        return max(v, 0)
    except (ValueError, TypeError):
        return 0


# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------
def main():
    print(f"Reading CSV from {INPUT_CSV} ...")
    hospitals = []
    total_rows = 0
    filtered_rows = 0

    with open(INPUT_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_rows += 1

            # --- Filter out empty / zero names ---
            name = clean_str(row.get("Hospital_Name", ""))
            if not name:
                filtered_rows += 1
                continue

            # --- Coordinates ---
            lat, lng = parse_coordinates(row.get("Location_Coordinates", ""))

            # --- State ---
            raw_state = row.get("State", "").strip()
            state = normalize_state(raw_state)
            district = clean_str(row.get("District", ""))

            # --- Category ---
            specialties_raw = row.get("Specialties", "").strip()
            specialties_clean = "" if specialties_raw == "0" else specialties_raw
            care_type = row.get("Hospital_Care_Type", "").strip()
            discipline_raw = row.get("Discipline_Systems_of_Medicine", "").strip()
            discipline_clean = "" if discipline_raw == "0" else discipline_raw

            categories = categorize_hospital(specialties_clean, care_type, discipline_clean)

            # --- Ownership ---
            cat_raw = row.get("Hospital_Category", "").strip()
            if "government" in cat_raw.lower() or "public" in cat_raw.lower():
                ownership = "Government"
            elif "private" in cat_raw.lower():
                ownership = "Private"
            else:
                ownership = "Unknown"

            # --- Emergency ---
            emerg_raw = row.get("Emergency_Services", "").strip()
            emergency = emerg_raw not in ("0", "")

            # --- Phones ---
            phones = clean_phones(
                row.get("Telephone", ""),
                row.get("Mobile_Number", ""),
                row.get("Emergency_Num", ""),
            )

            # --- Address ---
            addr_parts = []
            addr1 = clean_str(row.get("Address_Original_First_Line", ""))
            if addr1:
                addr_parts.append(addr1)
            if district:
                addr_parts.append(district)
            if state:
                addr_parts.append(state)
            address = ", ".join(addr_parts)

            # --- City ---
            city = clean_str(row.get("Town", "")) or district

            # --- Beds ---
            beds = parse_int(row.get("Total_Num_Beds", "0"))

            # --- Facilities ---
            facilities_raw = row.get("Facilities", "").strip()
            facilities_clean = "" if facilities_raw == "0" else facilities_raw

            # --- Build record ---
            record = {
                "id": parse_int(row.get("Sr_No", "0")),
                "name": name,
                "address": address,
                "city": city,
                "state": state,
                "district": district,
                "pincode": clean_str(row.get("Pincode", "")),
                "lat": lat,
                "lng": lng,
                "category": categories,
                "careType": care_type if care_type != "0" else "",
                "discipline": discipline_clean,
                "ownership": ownership,
                "beds": beds,
                "emergency": emergency,
                "phones": phones,
                "specialties": specialties_clean,
                "facilities": facilities_clean,
            }

            hospitals.append(record)

    print(f"Total rows read:    {total_rows}")
    print(f"Rows filtered out:  {filtered_rows}")
    print(f"Hospitals kept:     {len(hospitals)}")

    # --- Write cleaned JSON ---
    print(f"Writing cleaned JSON to {OUTPUT_JSON} ...")
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(hospitals, f, indent=2, ensure_ascii=False)
    print(f"  Done. ({len(hospitals)} records)")

    # --- Build summary ---
    hospitals_with_coords = sum(1 for h in hospitals if h["lat"] is not None)
    by_state = {}
    by_category = {}
    by_ownership = {}

    for h in hospitals:
        # State
        s = h["state"]
        by_state[s] = by_state.get(s, 0) + 1
        # Category (each hospital can belong to multiple)
        for c in h["category"]:
            by_category[c] = by_category.get(c, 0) + 1
        # Ownership
        o = h["ownership"]
        by_ownership[o] = by_ownership.get(o, 0) + 1

    summary = {
        "totalHospitals": len(hospitals),
        "hospitalsWithCoords": hospitals_with_coords,
        "hospitalsByState": dict(sorted(by_state.items(), key=lambda x: -x[1])),
        "hospitalsByCategory": dict(sorted(by_category.items(), key=lambda x: -x[1])),
        "hospitalsByOwnership": dict(sorted(by_ownership.items(), key=lambda x: -x[1])),
    }

    print(f"Writing summary JSON to {SUMMARY_JSON} ...")
    with open(SUMMARY_JSON, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    print("  Done.")

    # Print quick stats
    print("\n=== SUMMARY ===")
    print(f"  Total hospitals:      {summary['totalHospitals']}")
    print(f"  With coordinates:     {summary['hospitalsWithCoords']}")
    print(f"  States / UTs:         {len(summary['hospitalsByState'])}")
    print(f"  Categories:           {len(summary['hospitalsByCategory'])}")
    print(f"  Ownership breakdown:  {summary['hospitalsByOwnership']}")
    print(f"  Top 5 states:")
    for s, c in list(summary["hospitalsByState"].items())[:5]:
        print(f"    {s}: {c}")
    print(f"  Top 5 categories:")
    for cat, c in list(summary["hospitalsByCategory"].items())[:5]:
        print(f"    {cat}: {c}")


if __name__ == "__main__":
    main()
