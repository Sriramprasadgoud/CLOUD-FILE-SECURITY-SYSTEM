"""
Sorting algorithms implemented from scratch (no Python built-in sorted() / .sort()).

Time Complexities:
- Merge Sort: O(n log n) best, average, and worst case; O(n) auxiliary space.
- Quick Sort: O(n log n) average case, O(n^2) worst case; O(log n) stack space.
"""

from typing import Any, Dict, List, Tuple


def _compare(a: Dict[str, Any], b: Dict[str, Any], sort_by: str, ascending: bool) -> int:
    if sort_by == "file_size":
        val_a = int(a.get("file_size", 0))
        val_b = int(b.get("file_size", 0))
    elif sort_by == "upload_date":
        val_a = str(a.get("upload_date", ""))
        val_b = str(b.get("upload_date", ""))
    else:
        val_a = str(a.get("original_filename", "")).lower()
        val_b = str(b.get("original_filename", "")).lower()

    if val_a < val_b:
        cmp_val = -1
    elif val_a > val_b:
        cmp_val = 1
    else:
        cmp_val = 0

    return cmp_val if ascending else -cmp_val


def merge_sort_files(
    records: List[Dict[str, Any]],
    sort_by: str = "filename",
    ascending: bool = True,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Merge Sort supporting 'filename', 'upload_date', and 'file_size'
    in ascending or descending order.
    """
    counters = {"comparisons": 0, "moves": 0}

    def merge(left: List[Dict[str, Any]], right: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        merged: List[Dict[str, Any]] = []
        i = 0
        j = 0

        while i < len(left) and j < len(right):
            counters["comparisons"] += 1
            if _compare(left[i], right[j], sort_by, ascending) <= 0:
                merged.append(left[i])
                i += 1
            else:
                merged.append(right[j])
                j += 1
            counters["moves"] += 1

        while i < len(left):
            merged.append(left[i])
            i += 1
            counters["moves"] += 1

        while j < len(right):
            merged.append(right[j])
            j += 1
            counters["moves"] += 1

        return merged

    def sort_recursive(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if len(items) <= 1:
            return list(items)
        mid = len(items) // 2
        left = sort_recursive(items[:mid])
        right = sort_recursive(items[mid:])
        return merge(left, right)

    sorted_items = sort_recursive(records)
    metrics = {
        "algorithm": "Merge Sort",
        "sort_by": sort_by,
        "ascending": ascending,
        "comparisons": counters["comparisons"],
        "moves": counters["moves"],
        "time_complexity": "O(n log n)",
    }
    return sorted_items, metrics


def quick_sort_files(
    records: List[Dict[str, Any]],
    sort_by: str = "file_size",
    ascending: bool = True,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    In-place Quick Sort supporting 'file_size' and 'filename'
    in ascending or descending order.
    """
    arr = list(records)
    counters = {"comparisons": 0, "swaps": 0}

    def partition(low: int, high: int) -> int:
        mid = (low + high) // 2
        pivot = arr[mid]
        arr[mid], arr[high] = arr[high], arr[mid]
        counters["swaps"] += 1

        store_idx = low
        for idx in range(low, high):
            counters["comparisons"] += 1
            if _compare(arr[idx], pivot, sort_by, ascending) <= 0:
                if idx != store_idx:
                    arr[idx], arr[store_idx] = arr[store_idx], arr[idx]
                    counters["swaps"] += 1
                store_idx += 1

        if store_idx != high:
            arr[store_idx], arr[high] = arr[high], arr[store_idx]
            counters["swaps"] += 1
        return store_idx

    def quicksort_in_place(low: int, high: int) -> None:
        if low < high:
            pivot_idx = partition(low, high)
            quicksort_in_place(low, pivot_idx - 1)
            quicksort_in_place(pivot_idx + 1, high)

    if len(arr) > 1:
        quicksort_in_place(0, len(arr) - 1)

    metrics = {
        "algorithm": "Quick Sort",
        "sort_by": sort_by,
        "ascending": ascending,
        "comparisons": counters["comparisons"],
        "swaps": counters["swaps"],
        "time_complexity": "O(n log n) average, O(n^2) worst",
    }
    return arr, metrics
