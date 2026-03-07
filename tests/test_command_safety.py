"""Tests for command safety validation."""
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from api.automation import _check_command_safety


class TestCommandSafety:
    def test_safe_show_command(self):
        assert _check_command_safety(['show version']) is None

    def test_safe_display_command(self):
        assert _check_command_safety(['display ip routing-table']) is None

    def test_safe_config_command(self):
        assert _check_command_safety(['interface GigabitEthernet0/0', 'no shutdown']) is None

    def test_block_write_erase(self):
        result = _check_command_safety(['write erase'])
        assert result is not None
        assert 'Blocked' in result

    def test_block_reload(self):
        result = _check_command_safety(['reload'])
        assert result is not None

    def test_block_erase_startup(self):
        result = _check_command_safety(['erase startup-config'])
        assert result is not None

    def test_block_format(self):
        result = _check_command_safety(['format flash:'])
        assert result is not None

    def test_block_reset_saved(self):
        result = _check_command_safety(['reset saved-configuration'])
        assert result is not None

    def test_mixed_safe_and_dangerous(self):
        result = _check_command_safety(['show version', 'reload'])
        assert result is not None

    def test_case_insensitive(self):
        result = _check_command_safety(['WRITE ERASE'])
        assert result is not None

    def test_empty_list_is_safe(self):
        assert _check_command_safety([]) is None
