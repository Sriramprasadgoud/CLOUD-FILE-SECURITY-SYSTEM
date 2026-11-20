import unittest

from algorithms.sorting import merge_sort_files, quick_sort_files


SAMPLE_FILES = [
    {"id": 1, "original_filename": "delta.txt", "file_size": 300, "upload_date": "2026-11-10T10:00:00Z"},
    {"id": 2, "original_filename": "alpha.pdf", "file_size": 1200, "upload_date": "2026-11-12T10:00:00Z"},
    {"id": 3, "original_filename": "charlie.csv", "file_size": 150, "upload_date": "2026-11-08T10:00:00Z"},
    {"id": 4, "original_filename": "bravo.png", "file_size": 900, "upload_date": "2026-11-11T10:00:00Z"},
]


class TestSortingAlgorithms(unittest.TestCase):
    def test_merge_sort_filename_asc_desc(self):
        asc, _ = merge_sort_files(SAMPLE_FILES, sort_by="filename", ascending=True)
        self.assertEqual([f["original_filename"] for f in asc], ["alpha.pdf", "bravo.png", "charlie.csv", "delta.txt"])

        desc, _ = merge_sort_files(SAMPLE_FILES, sort_by="filename", ascending=False)
        self.assertEqual([f["original_filename"] for f in desc], ["delta.txt", "charlie.csv", "bravo.png", "alpha.pdf"])

    def test_merge_sort_upload_date_and_size(self):
        by_date, _ = merge_sort_files(SAMPLE_FILES, sort_by="upload_date", ascending=True)
        self.assertEqual([f["id"] for f in by_date], [3, 1, 4, 2])

        by_size, _ = merge_sort_files(SAMPLE_FILES, sort_by="file_size", ascending=False)
        self.assertEqual([f["file_size"] for f in by_size], [1200, 900, 300, 150])

    def test_quick_sort_size_and_filename(self):
        by_size, _ = quick_sort_files(SAMPLE_FILES, sort_by="file_size", ascending=True)
        self.assertEqual([f["file_size"] for f in by_size], [150, 300, 900, 1200])

        by_name_desc, _ = quick_sort_files(SAMPLE_FILES, sort_by="filename", ascending=False)
        self.assertEqual([f["original_filename"] for f in by_name_desc], ["delta.txt", "charlie.csv", "bravo.png", "alpha.pdf"])


if __name__ == "__main__":
    unittest.main()
