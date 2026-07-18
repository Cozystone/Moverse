#!/usr/bin/env python3
"""Generate Seoul-wide Move Stop seeds from official pedestrian entrances.

The generator intentionally uses only the Python standard library. Source ZIPs
are downloaded into a temporary directory unless ``--source-dir`` points to a
directory containing ``OA-21698.zip`` and ``OA-21699.zip``.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import struct
import tempfile
import urllib.parse
import urllib.request
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable, Iterator


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "data" / "seoul-stops.json"
DOWNLOAD_URL = (
    "https://datafile.seoul.go.kr/bigfile/iot/inf/"
    "nio_download.do?&useCache=false"
)

SOURCE_DATASETS = {
    "OA-21698": {
        "name": "서울시 시설물 정보",
        "url": "https://data.seoul.go.kr/dataList/OA-21698/S/1/datasetView.do",
    },
    "OA-21699": {
        "name": "서울시 보행자 출입구 정보",
        "url": "https://data.seoul.go.kr/dataList/OA-21699/S/1/datasetView.do",
    },
}

ALLOWED_FACILITY_TYPES = {"FU_BI", "FU_BJ"}
EXCLUDED_FACILITY_IDS = {"P0025", "P1391", "P1401", "P1430", "P1431", "P1434"}
DENIED_NOTE_TERMS = (
    "폐문",
    "폐쇄",
    "외부인금지",
    "외부인 금지",
    "입주민전용",
    "입주민 전용",
    "잠김",
    "통행불가",
    "통행 불가",
)
EXPECTED_STOP_COUNT = 3_357
NMS_RADIUS_METERS = 40.0
METERS_PER_DEGREE = 111_000.0


@dataclass(frozen=True)
class Entrance:
    entrance_id: str
    facility_id: str
    facility_name: str
    district: str
    longitude: float
    latitude: float
    category: str
    closes_at: str


def dbf_field_names(data: bytes) -> list[str]:
    """Read field names from a dBASE III/IV header."""

    if len(data) < 33:
        raise ValueError("DBF header is truncated")
    header_length = struct.unpack_from("<H", data, 8)[0]
    names: list[str] = []
    offset = 32
    while offset < header_length and data[offset] != 0x0D:
        descriptor = data[offset : offset + 32]
        raw_name = descriptor[:11].split(b"\0", 1)[0]
        names.append(raw_name.decode("ascii"))
        offset += 32
    return names


def read_dbf(data: bytes) -> Iterator[dict[str, str]]:
    """Yield DBF records as stripped CP949 strings.

    The Seoul source advertises EUC-KR in its CPG file. CP949 is a compatible
    superset and also decodes the few extended Korean characters in the DBF.
    """

    if len(data) < 33:
        raise ValueError("DBF header is truncated")

    record_count = struct.unpack_from("<I", data, 4)[0]
    header_length = struct.unpack_from("<H", data, 8)[0]
    record_length = struct.unpack_from("<H", data, 10)[0]
    fields: list[tuple[str, int]] = []
    offset = 32

    while offset < header_length and data[offset] != 0x0D:
        descriptor = data[offset : offset + 32]
        raw_name = descriptor[:11].split(b"\0", 1)[0]
        fields.append((raw_name.decode("ascii"), descriptor[16]))
        offset += 32

    for index in range(record_count):
        start = header_length + index * record_length
        record = data[start : start + record_length]
        if len(record) != record_length:
            raise ValueError(f"DBF record {index} is truncated")
        if record[:1] == b"*":
            continue

        cursor = 1
        parsed: dict[str, str] = {}
        for name, width in fields:
            raw_value = record[cursor : cursor + width]
            parsed[name] = raw_value.rstrip(b" \0").decode("cp949").strip()
            cursor += width
        yield parsed


def load_dbf_from_zip(zip_path: Path, required_fields: set[str]) -> list[dict[str, str]]:
    """Select the English-column DBF by schema rather than filename encoding."""

    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            if not member.filename.lower().endswith(".dbf"):
                continue
            data = archive.read(member)
            try:
                names = set(dbf_field_names(data))
            except (UnicodeDecodeError, ValueError):
                continue
            if required_fields.issubset(names):
                return list(read_dbf(data))
    raise RuntimeError(f"No matching DBF found in {zip_path}")


def download_dataset(dataset_id: str, destination: Path) -> None:
    payload = urllib.parse.urlencode(
        {
            "infId": dataset_id,
            "seqNo": "",
            "seq": "1",
            "infSeq": "3",
        }
    ).encode("ascii")
    request = urllib.request.Request(
        DOWNLOAD_URL,
        data=payload,
        headers={"User-Agent": "Moverse-Seoul-Stop-Generator/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        if response.status != 200:
            raise RuntimeError(f"{dataset_id} download failed: HTTP {response.status}")
        with destination.open("wb") as target:
            shutil.copyfileobj(response, target)


def parse_district(*addresses: str) -> str:
    for address in addresses:
        words = address.split()
        for word in words:
            if word.endswith("구") and len(word) >= 2:
                return word
    return "서울"


def derive_closing_time(value: str) -> str:
    """Respect an earlier source closing time and always cap use at 21:00."""

    if "-" not in value:
        return "21:00"
    start, end = value.split("-", 1)
    if not (start.isdigit() and end.isdigit() and len(start) == 4 and len(end) == 4):
        return "21:00"
    start_minutes = int(start[:2]) * 60 + int(start[2:])
    end_minutes = int(end[:2]) * 60 + int(end[2:])
    if start_minutes < end_minutes < 21 * 60:
        return f"{end_minutes // 60:02d}:{end_minutes % 60:02d}"
    return "21:00"


def distance_meters(a: Entrance, b: Entrance) -> float:
    """Fast deterministic local equirectangular distance for a 40 m cutoff."""

    mean_latitude = math.radians((a.latitude + b.latitude) / 2.0)
    dx = (a.longitude - b.longitude) * METERS_PER_DEGREE * math.cos(mean_latitude)
    dy = (a.latitude - b.latitude) * METERS_PER_DEGREE
    return math.hypot(dx, dy)


def select_stops(
    facilities: Iterable[dict[str, str]],
    entrances: Iterable[dict[str, str]],
) -> tuple[list[Entrance], dict[str, int]]:
    selected_facilities = {
        row["sisulId"]: row
        for row in facilities
        if row["sisulSpfc"] in ALLOWED_FACILITY_TYPES
        and row["sisulId"] not in EXCLUDED_FACILITY_IDS
    }

    candidates: list[Entrance] = []
    counters = {
        "selectedFacilities": len(selected_facilities),
        "filteredEntrances": 0,
        "deduplicatedEntrances": 0,
        "representedFacilities": 0,
    }

    for row in entrances:
        facility = selected_facilities.get(row["sisulId"])
        if facility is None:
            continue
        if row["cmgSe"] == "EIO_DA" or row["wkOpertime"] == "WD_N":
            continue
        if any(term in row["etc"] for term in DENIED_NOTE_TERMS):
            continue

        try:
            latitude = float(row["latitude"])
            longitude = float(row["longitude"])
        except ValueError:
            continue
        if not (37.0 <= latitude <= 38.0 and 126.0 <= longitude <= 128.0):
            continue

        candidates.append(
            Entrance(
                entrance_id=row["id"],
                facility_id=row["sisulId"],
                facility_name=facility["sisulNm"],
                district=parse_district(
                    facility.get("rdnmadr", ""),
                    facility.get("lnmadr", ""),
                ),
                longitude=longitude,
                latitude=latitude,
                category="trail" if facility["sisulSpfc"] == "FU_BJ" else "park",
                closes_at=derive_closing_time(row["wkOpertime"]),
            )
        )

    counters["filteredEntrances"] = len(candidates)

    # Exact coordinate de-duplication is global and deterministic: the lowest
    # facility/entrance ID wins when two records share the same point.
    deduplicated: list[Entrance] = []
    seen_coordinates: set[tuple[float, float]] = set()
    for entrance in sorted(candidates, key=lambda item: (item.facility_id, item.entrance_id)):
        coordinate = (entrance.longitude, entrance.latitude)
        if coordinate in seen_coordinates:
            continue
        seen_coordinates.add(coordinate)
        deduplicated.append(entrance)

    counters["deduplicatedEntrances"] = len(deduplicated)
    by_facility: dict[str, list[Entrance]] = defaultdict(list)
    for entrance in deduplicated:
        by_facility[entrance.facility_id].append(entrance)

    kept: list[Entrance] = []
    for facility_id in sorted(by_facility):
        chosen: list[Entrance] = []
        for entrance in sorted(by_facility[facility_id], key=lambda item: item.entrance_id):
            if all(distance_meters(entrance, other) >= NMS_RADIUS_METERS for other in chosen):
                chosen.append(entrance)
        kept.extend(chosen)

    counters["representedFacilities"] = len(by_facility)
    return kept, counters


def stop_rows(stops: list[Entrance]) -> list[list[str | float]]:
    totals: dict[str, int] = defaultdict(int)
    for stop in stops:
        totals[stop.facility_id] += 1

    ordinals: dict[str, int] = defaultdict(int)
    rows: list[list[str | float]] = []
    for stop in sorted(stops, key=lambda item: (item.facility_id, item.entrance_id)):
        ordinals[stop.facility_id] += 1
        display_name = stop.facility_name
        if totals[stop.facility_id] > 1:
            display_name = f"{stop.facility_name} {ordinals[stop.facility_id]}번 게이트"
        rows.append(
            [
                stop.entrance_id,
                display_name,
                stop.district,
                round(stop.longitude, 7),
                round(stop.latitude, 7),
                stop.category,
                stop.closes_at,
            ]
        )
    return rows


def generate(source_dir: Path | None, output: Path) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix="moverse-seoul-stops-") as temp_name:
        temp_dir = Path(temp_name)
        zip_paths: dict[str, Path] = {}
        for dataset_id in SOURCE_DATASETS:
            if source_dir is None:
                path = temp_dir / f"{dataset_id}.zip"
                download_dataset(dataset_id, path)
            else:
                path = source_dir / f"{dataset_id}.zip"
                if not path.is_file():
                    raise FileNotFoundError(path)
            zip_paths[dataset_id] = path

        facilities = load_dbf_from_zip(
            zip_paths["OA-21698"],
            {"sisulId", "sisulNm", "sisulSpfc", "rdnmadr", "lnmadr"},
        )
        entrances = load_dbf_from_zip(
            zip_paths["OA-21699"],
            {
                "id",
                "sisulId",
                "latitude",
                "longitude",
                "cmgSe",
                "wkOpertime",
                "etc",
            },
        )

        stops, counters = select_stops(facilities, entrances)
        rows = stop_rows(stops)
        if len(rows) != EXPECTED_STOP_COUNT:
            raise RuntimeError(
                f"Expected {EXPECTED_STOP_COUNT:,} stops, generated {len(rows):,}. "
                "The upstream source may have changed; review the filters before updating."
            )

        document: dict[str, object] = {
            "schemaVersion": 1,
            "generatedAt": date.today().isoformat(),
            "sourceUpdatedAt": "2023-04-21",
            "license": "공공누리 제1유형: 출처표시",
            "sources": [
                {"id": dataset_id, **metadata}
                for dataset_id, metadata in SOURCE_DATASETS.items()
            ],
            "method": {
                "facilityTypes": sorted(ALLOWED_FACILITY_TYPES),
                "excludedFacilityIds": sorted(EXCLUDED_FACILITY_IDS),
                "deniedNoteTerms": list(DENIED_NOTE_TERMS),
                "excludedComingType": "EIO_DA",
                "excludedWeekdayHours": "WD_N",
                "nmsRadiusMeters": int(NMS_RADIUS_METERS),
            },
            "counts": {**counters, "stops": len(rows)},
            "columns": [
                "entranceId",
                "name",
                "district",
                "longitude",
                "latitude",
                "category",
                "closesAt",
            ],
            "stops": rows,
        }

        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        return document


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-dir",
        type=Path,
        help="Directory containing OA-21698.zip and OA-21699.zip; otherwise download.",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    document = generate(args.source_dir, args.output)
    counts = document["counts"]
    assert isinstance(counts, dict)
    print(
        f"Generated {counts['stops']:,} Seoul Move Stops from "
        f"{counts['representedFacilities']:,} facilities -> {args.output}"
    )


if __name__ == "__main__":
    main()
