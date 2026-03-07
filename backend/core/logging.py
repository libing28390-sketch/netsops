import logging
import sys
import os
from logging.handlers import TimedRotatingFileHandler

LOG_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "logs")
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

# 三方库噪声压制：只保留 WARNING 及以上
_NOISY_LIBS = [
    "uvicorn.access",
    "uvicorn.error",
    "apscheduler",
    "netmiko",
    "scrapli",
    "paramiko",
    "asyncssh",
]

def setup_logging():
    os.makedirs(LOG_DIR, exist_ok=True)
    log_file = os.path.join(LOG_DIR, "netops.log")

    root = logging.getLogger()
    root.setLevel(logging.INFO)

    fmt = logging.Formatter(LOG_FORMAT)

    # stdout handler
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    root.addHandler(console)

    # 按天轮转：每天午夜切割，保留 30 天，旧日志自动 gzip 压缩
    file_handler = TimedRotatingFileHandler(
        log_file,
        when="midnight",
        interval=1,
        backupCount=30,
        encoding="utf-8",
    )
    file_handler.suffix = "%Y-%m-%d"      # netops.log.2026-03-07
    file_handler.setFormatter(fmt)
    root.addHandler(file_handler)

    # 压制三方库噪声
    for lib in _NOISY_LIBS:
        logging.getLogger(lib).setLevel(logging.WARNING)
