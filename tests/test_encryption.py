import os
import unittest

try:
    from cryptography.exceptions import InvalidTag
    from encryption.encrypt import decrypt_file_bytes, encrypt_file_bytes
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False


@unittest.skipUnless(HAS_CRYPTO, "cryptography package not installed in this environment")
class TestAES256GCMEncryption(unittest.TestCase):
    def test_encrypt_decrypt_roundtrip(self):
        key = os.urandom(32)
        plaintext = b"Confidential academic cybersecurity record #101"
        ciphertext, nonce_hex = encrypt_file_bytes(plaintext, key)

        self.assertNotEqual(ciphertext, plaintext)
        self.assertEqual(len(bytes.fromhex(nonce_hex)), 12)

        recovered = decrypt_file_bytes(ciphertext, key, nonce_hex)
        self.assertEqual(recovered, plaintext)

    def test_unique_nonce_per_operation(self):
        key = os.urandom(32)
        plaintext = b"Same file content"
        c1, n1 = encrypt_file_bytes(plaintext, key)
        c2, n2 = encrypt_file_bytes(plaintext, key)
        self.assertNotEqual(n1, n2)
        self.assertNotEqual(c1, c2)

    def test_tampered_ciphertext_fails_authentication(self):
        key = os.urandom(32)
        plaintext = b"Immutable audit payload"
        ciphertext, nonce_hex = encrypt_file_bytes(plaintext, key)

        tampered = bytearray(ciphertext)
        tampered[0] ^= 0xFF
        with self.assertRaises(InvalidTag):
            decrypt_file_bytes(bytes(tampered), key, nonce_hex)


if __name__ == "__main__":
    unittest.main()
