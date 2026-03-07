"""Tests for credential encryption/decryption."""
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Set required env var before importing crypto
os.environ['CREDENTIAL_ENCRYPTION_KEY'] = 'test-secret-key-for-unit-tests-only'


class TestCrypto:
    def test_encrypt_returns_prefixed_string(self):
        from core.crypto import encrypt_credential
        result = encrypt_credential('mypassword')
        assert result is not None
        assert result.startswith('enc:v1:')

    def test_decrypt_recovers_original(self):
        from core.crypto import encrypt_credential, decrypt_credential
        original = 'S3cur3P@ssw0rd!'
        encrypted = encrypt_credential(original)
        decrypted = decrypt_credential(encrypted)
        assert decrypted == original

    def test_encrypt_none_returns_none(self):
        from core.crypto import encrypt_credential
        assert encrypt_credential(None) is None

    def test_decrypt_none_returns_none(self):
        from core.crypto import decrypt_credential
        assert decrypt_credential(None) is None

    def test_decrypt_legacy_plaintext_returned_as_is(self):
        from core.crypto import decrypt_credential
        assert decrypt_credential('plaintext_password') == 'plaintext_password'

    def test_already_encrypted_not_double_encrypted(self):
        from core.crypto import encrypt_credential
        first = encrypt_credential('test')
        second = encrypt_credential(first)
        assert first == second

    def test_empty_string_returns_empty(self):
        from core.crypto import encrypt_credential, decrypt_credential
        assert encrypt_credential('') == ''
        assert decrypt_credential('') == ''
