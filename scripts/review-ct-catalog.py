"""Convert the active MASTER_CT CSV export into a SQL statement for the Neon SQL Editor."""
import argparse
import csv
import datetime
import decimal
import json
import re
import sys


def positive(value):
    if not value.strip():
        return None
    n = decimal.Decimal(value.strip().replace(",", "."))
    if not n.is_finite() or n <= 0:
        raise ValueError("CT, panjang, dan kecepatan harus positif")
    return float(n)


def catalog(rows):
    rates, specs = {}, {}
    for row in rows:
        if row["ACTIVE"].strip().upper() != "TRUE":
            continue
        line = row["LINE_ID"].strip()
        if not re.fullmatch(r"LINE_[1-8]", line):
            continue
        machine, part = row["MACHINE_NAME"].strip(), row["PART_NAME_STANDARD"].strip()
        if not machine or not part:
            raise ValueError("Nama mesin atau part kosong")
        key = json.dumps([line, machine, part], ensure_ascii=False, separators=(",", ":"))
        if key in specs:
            raise ValueError("Mesin–part aktif ganda: " + key)
        spec = {}
        rate = None
        if row["PART_CATEGORY"].strip().upper() == "HELPER":
            spec["helper"] = True
        elif line == "LINE_8":
            length = positive(row["LONG_PIPE_LENGTH_MM"])
            speed = positive(row["LONG_PIPE_SPEED_MM_PER_SECOND"])
            if length and speed:
                spec["lengthMm"] = length
                rate = length / speed
        else:
            rate = positive(row["CYCLE_TIME_SECONDS"])
        specs[key] = spec
        if rate:
            rates[key] = rate
    if {json.loads(k)[0] for k in specs} != {f"LINE_{i}" for i in range(1, 9)}:
        raise ValueError("Gunakan ekspor MASTER_CT lengkap untuk Line 1–8")
    return rates, specs


def sql_json(data):
    return "'" + json.dumps(data, ensure_ascii=False, allow_nan=False).replace("'", "''") + "'::jsonb"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv")
    parser.add_argument("--date", required=True, type=datetime.date.fromisoformat)
    args = parser.parse_args()
    with open(args.csv, newline="", encoding="utf-8-sig") as file:
        dialect = csv.Sniffer().sniff(file.readline(), delimiters=",;\t")
        file.seek(0)
        rates, specs = catalog(csv.DictReader(file, dialect=dialect))
    print(f"{len(rates)} CT valid dari {len(specs)} pasangan aktif.", file=sys.stderr)
    # Preserve categories outside production Lines 1–8 (e.g. pilot). The full export
    # replaces those eight lines, including parts retired or left without a rate.
    print("WITH source AS (SELECT " + sql_json(rates) + " AS rates, " + sql_json(specs) + " AS specs)")
    print("UPDATE leader_cycle_catalog AS c SET rates=COALESCE((SELECT jsonb_object_agg(key,value)")
    print("  FROM jsonb_each(c.rates) WHERE (key::jsonb->>0) !~ '^LINE_[1-8]$'), '{}'::jsonb) || source.rates,")
    print(f"  part_specs=source.specs, source_date=DATE '{args.date}' FROM source")
    print(f"WHERE c.singleton AND c.source_date<=DATE '{args.date}' RETURNING source_date;")
