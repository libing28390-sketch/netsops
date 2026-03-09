from typing import List, Dict, Any
from drivers.factory import DriverFactory
from drivers.base import CommandResult
from drivers.ssh_compat import build_legacy_ssh_guidance, is_legacy_ssh_negotiation_error

class AutomationService:
    """业务逻辑层"""
    
    def __init__(self, driver_type: str = 'netmiko'):
        self.driver_type = driver_type

    def execute_commands(self, device_info: Dict[str, Any], commands: List[str], is_config: bool = False) -> List[CommandResult]:
        import time
        import logging
        logger = logging.getLogger(__name__)
        
        results = []
        driver_start = time.time()
        with DriverFactory.get_driver(self.driver_type, device_info) as driver:
            driver_init_time = time.time() - driver_start
            logger.info(f"Driver init took {driver_init_time:.2f}s")
            
            if is_config:
                results.append(driver.send_config(commands))
            else:
                for cmd in commands:
                    result = driver.send_command(cmd)
                    results.append(result)
            
            disconnect_start = time.time()
        disconnect_time = time.time() - disconnect_start
        logger.debug(f"Driver disconnect took {disconnect_time:.3f}s")
        return results

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
            if is_legacy_ssh_negotiation_error(error_msg):
                logger.warning("Legacy SSH negotiation failure detected during connectivity check")
            return False, build_legacy_ssh_guidance(error_msg)
