import unittest

from algorithms.searching import binary_search_files, linear_search_files


SAMPLE_FILES = [
    {"id": 1, "original_filename": "zeta_notes.txt", "file_type": "text/plain", "file_size": 120},
    {"id": 2, "original_filename": "alpha_report.pdf", "file_type": "application/pdf", "file_size": 4500},
    {"id": 3, "original_filename": "audit_2026.csv", "file_type": "text/csv", "file_size": 880},
    {"id": 4, "original_filename": "architecture.png", "file_type": "image/png", "file_size": 92000},
]


class TestSearchingAlgorithms(unittest.TestCase):
    def test_linear_search_by_filename(self):
        matches, metrics = linear_search_files(SAMPLE_FILES, "audit", field="filename")
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["original_filename"], "audit_2026.csv")
        self.assertEqual(metrics["comparisons"], len(SAMPLE_FILES))

    def test_linear_search_by_extension(self):
        matches, _ = linear_search_files(SAMPLE_FILES, "pdf", field="extension")
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["id"], 2)

    def test_linear_search_by_file_type(self):
        matches, _ = linear_search_files(SAMPLE_FILES, "image/png", field="file_type")
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["original_filename"], "architecture.png")

    def test_binary_search_finds_exact_and_prefix(self):
        matches, metrics = binary_search_files(SAMPLE_FILES, "alpha")
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["original_filename"], "alpha_report.pdf")
        self.assertGreaterEqual(metrics["comparisons"], 1)

    def test_binary_search_missing_returns_empty(self):
        matches, _ = binary_search_files(SAMPLE_FILES, "nonexistent_doc")
        self.assertEqual(matches, [])


if __name__ == "__main__":
    unittest.main()
