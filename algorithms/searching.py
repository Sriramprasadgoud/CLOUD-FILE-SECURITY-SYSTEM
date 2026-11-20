"""
Searching algorithms implemented from scratch for file metadata retrieval.

Time Complexities:
- Linear Search: O(n) worst/average case, O(1) best case, O(1) space.
- Binary Search: O(log n) search phase after O(n log n) Merge Sort pre-sort.
"""

from typing import Any, Dict, List, Tuple
from .sorting import merge_sort_files


def _extract_extension(filename: str) -> str:
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()


def linear_search_files(
    records: List[Dict[str, Any]],
    query: str,
    field: str = "filename",
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Sequential linear scan over file metadata records.

    Supports searching by:
    - 'filename' (case-insensitive substring)
    - 'extension' (file extension without leading dot)
    - 'file_type' (MIME type substring)
    """
    normalized_query = query.strip().lower().lstrip(".")
    matches: List[Dict[str, Any]] = []
    comparisons = 0

    for record in records:
        comparisons += 1
        if field == "extension":
            candidate = _extract_extension(str(record.get("original_filename", "")))
        elif field == "file_type":
            candidate = str(record.get("file_type", "")).lower()
        else:
            candidate = str(record.get("original_filename", "")).lower()

        if not normalized_query or normalized_query in candidate:
            matches.append(record)

    metrics = {
        "algorithm": "Linear Search",
        "field": field,
        "query": query,
        "comparisons": comparisons,
        "total_scanned": len(records),
        "time_complexity": "O(n)",
    }
    return matches, metrics


def binary_search_files(
    records: List[Dict[str, Any]],
    query: str,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Sorts file metadata alphabetically by filename using Merge Sort (O(n log n)),
    then performs Binary Search (O(log n)) for exact or prefix filename matches.
    """
    normalized_query = query.strip().lower()
    if not normalized_query or not records:
        return [], {
            "algorithm": "Binary Search",
            "field": "filename",
            "query": query,
            "comparisons": 0,
            "total_scanned": len(records),
            "time_complexity": "O(log n) search after O(n log n) Merge Sort",
        }

    sorted_records, _ = merge_sort_files(records, sort_by="filename", ascending=True)

    low = 0
    high = len(sorted_records) - 1
    comparisons = 0
    found_idx = -1

    while low <= high:
        mid = (low + high) // 2
        mid_name = str(sorted_records[mid].get("original_filename", "")).lower()
        comparisons += 1

        if mid_name == normalized_query or mid_name.startswith(normalized_query):
            found_idx = mid
            break
        elif mid_name < normalized_query:
            low = mid + 1
        else:
            high = mid - 1

    matches: List[Dict[str, Any]] = []
    if found_idx != -1:
        left = found_idx
        while left - 1 >= 0:
            comparisons += 1
            left_name = str(sorted_records[left - 1].get("original_filename", "")).lower()
            if left_name == normalized_query or left_name.startswith(normalized_query):
                left -= 1
            else:
                break

        right = found_idx
        while right + 1 < len(sorted_records):
            comparisons += 1
            right_name = str(sorted_records[right + 1].get("original_filename", "")).lower()
            if right_name == normalized_query or right_name.startswith(normalized_query):
                right += 1
            else:
                break

        matches = sorted_records[left : right + 1]

    metrics = {
        "algorithm": "Binary Search",
        "field": "filename",
        "query": query,
        "comparisons": comparisons,
        "total_scanned": len(sorted_records),
        "time_complexity": "O(log n) search after O(n log n) Merge Sort",
    }
    return matches, metrics
