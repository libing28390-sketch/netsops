from typing import List, Dict, Any
from drivers.factory import DriverFactory
from drivers.base import CommandResult
from drivers.ssh_compat import is_legacy_ssh_negotiation_error, is_ssh_authentication_error

class AutomationService:
    """业务逻辑层"""
    
    def __init__(self, driver_type: str = 'netmiko'):
        self.driver_type = driver_type

    def _try_with_driver(self, driver_type: str, device_info: Dict[str, Any], commands: List[str], is_config: bool) -> List[CommandResult]:
        import time
        import logging
        logger = logging.getLogger(__name__)

        results: List[CommandResult] = []
        driver_start = time.time()
        with DriverFactory.get_driver(driver_type, device_info) as driver:
            driver_init_time = time.time() - driver_start
            logger.info(f"Driver init took {driver_init_time:.2f}s (driver={driver_type})")

            if is_config:
                results.append(driver.send_config(commands))
            else:
                for cmd in commands:
                    result = driver.send_command(cmd)
                    results.append(result)

            disconnect_start = time.time()
        disconnect_time = time.time() - disconnect_start
        logger.debug(f"Driver disconnect took {disconnect_time:.3f}s (driver={driver_type})")
        return results

    def _should_fallback_to_scrapli(self, error_text: str) -> bool:
        # netmiko 默认优先，只有在 SSH 协商类问题时才切换到 scrapli 兜底。
        return self.driver_type.lower() == 'netmiko' and is_legacy_ssh_negotiation_error(error_text)

    def execute_commands(self, device_info: Dict[str, Any], commands: List[str], is_config: bool = False) -> List[CommandResult]:
        import logging
        logger = logging.getLogger(__name__)

        try:
            return self._try_with_driver(self.driver_type, device_info, commands, is_config)
        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}"
            if self._should_fallback_to_scrapli(error_msg):
                logger.warning(
                    "Netmiko SSH negotiation failed; retrying with scrapli for broader SSH algorithm compatibility"
                )
                return self._try_with_driver('scrapli', device_info, commands, is_config)
            raise

    def check_connectivity(self, device_info: Dict[str, Any]) -> tuple[bool, str]:
        import logging
        logger = logging.getLogger(__name__)
        try:
            logger.debug(f"Checking connectivity using {self.driver_type} driver")
            with DriverFactory.get_driver(self.driver_type, device_info) as driver:
                logger.debug("Connectivity check successful")
                return True, "Connection successful"
        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}"
            logger.debug(f"Connectivity check failed: {error_msg}")
            if self._should_fallback_to_scrapli(error_msg):
                logger.warning("Legacy SSH negotiation failure detected; retrying connectivity via scrapli")
                try:
                    with DriverFactory.get_driver('scrapli', device_info) as driver:
                        logger.debug("Connectivity check successful with scrapli fallback")
                        return True, "Connection successful (scrapli fallback)"
                except Exception as fallback_error:
                    fallback_msg = f"{type(fallback_error).__name__}: {str(fallback_error)}"
                    logger.debug(f"Connectivity fallback failed: {fallback_msg}")
                    if is_legacy_ssh_negotiation_error(fallback_msg):
                        logger.warning("Legacy SSH negotiation failure persists after scrapli fallback")
                    if is_ssh_authentication_error(fallback_msg):
                        logger.warning("SSH authentication failure detected during fallback check")
                    return False, fallback_msg

            if is_legacy_ssh_negotiation_error(error_msg):
                logger.warning("Legacy SSH negotiation failure detected during connectivity check")
            if is_ssh_authentication_error(error_msg):
                logger.warning("SSH authentication failure detected during connectivity check")
            return False, error_msg
