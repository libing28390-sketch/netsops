"""Tests for the mock driver."""
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from drivers.mock_driver import MockDriver


class TestMockDriver:
    def _make_device(self):
        return {
            'ip_address': '127.0.0.1',
            'username': 'admin',
            'password': 'admin',
            'port': 22,
            'platform': 'cisco_ios',
            'hostname': 'test-device',
        }

    def test_connect_disconnect(self):
        driver = MockDriver(self._make_device())
        driver.connect()
        driver.disconnect()

    def test_send_command_returns_success(self):
        driver = MockDriver(self._make_device())
        driver.connect()
        result = driver.send_command('show version')
        assert result.success is True
        assert result.hostname == 'test-device'
        assert len(result.output) > 0
        driver.disconnect()

    def test_send_config_returns_success(self):
        driver = MockDriver(self._make_device())
        driver.connect()
        result = driver.send_config(['interface Gi0/0', 'no shutdown'])
        assert result.success is True
        driver.disconnect()

    def test_context_manager(self):
        device = self._make_device()
        with MockDriver(device) as driver:
            result = driver.send_command('show ip interface brief')
            assert result.success is True


class TestDriverFactory:
    def test_get_mock_driver(self):
        from drivers.factory import DriverFactory
        device = {
            'ip_address': '127.0.0.1',
            'username': 'admin',
            'password': 'admin',
            'port': 22,
            'platform': 'cisco_ios',
        }
        driver = DriverFactory.get_driver('mock', device)
        assert isinstance(driver, MockDriver)

    def test_invalid_driver_type_raises(self):
        from drivers.factory import DriverFactory
        with pytest.raises(ValueError):
            DriverFactory.get_driver('nonexistent', {})
