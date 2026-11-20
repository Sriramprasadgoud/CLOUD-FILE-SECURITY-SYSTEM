import unittest

from encryption.hashing import calculate_sha256, verify_sha256_integrity


class TestSHA256Hashing(unittest.TestCase):
    def test_sha256_deterministic_digest(self):
        data = b"Cloud File Security System"
        h1 = calculate_sha256(data)
        h2 = calculate_sha256(data)
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 64)

    def test_integrity_verification_authentic(self):
        original = b"Quarterly security audit report"
        original_hash = calculate_sha256(original)
        result = verify_sha256_integrity(original_hash, original)
        self.assertTrue(result["authentic"])
        self.assertEqual(result["status"], "Authentic")

    def test_integrity_verification_detects_modification(self):
        original = b"Quarterly security audit report"
        modified = b"Quarterly security audit report!"
        original_hash = calculate_sha256(original)
        result = verify_sha256_integrity(original_hash, modified)
        self.assertFalse(result["authentic"])
        self.assertEqual(result["status"], "Modified")


if __name__ == "__main__":
    unittest.main()
