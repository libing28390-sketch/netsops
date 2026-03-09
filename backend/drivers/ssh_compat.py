from typing import Any, Dict, List


# 尽量覆盖实验环境与老设备常见的 SSH 算法组合。
# 注意：这里做的是“尽可能兼容”，不是突破底层库本身不支持的算法实现边界。
LEGACY_KEX_ALGORITHMS: List[str] = [
    "diffie-hellman-group14-sha1",
    "diffie-hellman-group-exchange-sha1",
    "diffie-hellman-group1-sha1",
]

LEGACY_HOST_KEY_ALGORITHMS: List[str] = [
    "ssh-rsa",
]

LEGACY_CIPHERS: List[str] = [
    "aes128-ctr",
    "aes192-ctr",
    "aes256-ctr",
    "aes128-cbc",
    "aes192-cbc",
    "aes256-cbc",
    "3des-cbc",
]

LEGACY_MAC_ALGORITHMS: List[str] = [
    "hmac-sha2-256",
    "hmac-sha2-512",
    "hmac-sha1",
    "hmac-sha1-96",
]


def build_netmiko_compatibility_kwargs() -> Dict[str, Any]:
    """
    Netmiko/Paramiko 兼容老设备的连接参数。

    - use_keys/allow_agent 关闭本地 SSH agent 干扰
    - disable_sha2_fix 打开旧 Cisco/旧 Paramiko 兼容路径
    """
    return {
        "use_keys": False,
        "allow_agent": False,
        "disable_sha2_fix": True,
    }


def build_system_ssh_open_cmd() -> List[str]:
    """为 OpenSSH/system transport 生成兼容老设备的额外参数。"""
    return [
        "-o", f"KexAlgorithms=+{','.join(LEGACY_KEX_ALGORITHMS)}",
        "-o", f"HostKeyAlgorithms=+{','.join(LEGACY_HOST_KEY_ALGORITHMS)}",
        "-o", f"PubkeyAcceptedAlgorithms=+{','.join(LEGACY_HOST_KEY_ALGORITHMS)}",
        "-o", f"Ciphers=+{','.join(LEGACY_CIPHERS)}",
        "-o", f"MACs=+{','.join(LEGACY_MAC_ALGORITHMS)}",
    ]


def is_legacy_ssh_negotiation_error(error_text: str) -> bool:
    """判断是否为旧设备 SSH 算法协商失败。"""
    normalized = (error_text or "").lower()
    indicators = [
        "no matching key exchange method",
        "no matching host key type",
        "no matching cipher found",
        "no matching mac found",
        "incompatible ssh peer",
        "kexalgorithm",
        "hostkeyalgorithms",
        "pubkeyacceptedalgorithms",
        "diffie-hellman-group14-sha1",
        "diffie-hellman-group-exchange-sha1",
        "diffie-hellman-group1-sha1",
        "ssh-rsa",
    ]
    return any(indicator in normalized for indicator in indicators)


def build_legacy_ssh_guidance(error_text: str) -> str:
    """为旧设备 SSH 协商失败生成可读提示。"""
    if not is_legacy_ssh_negotiation_error(error_text):
        return error_text

    return (
        "设备 SSH 算法较旧，平台已自动尝试兼容常见的 legacy KEX、ssh-rsa、旧 cipher 和 MAC。"
        " 如果仍然失败，通常说明该设备镜像过旧，或底层 SSH 库与设备支持集合仍无交集。"
        " 建议优先核对设备 SSH 配置、升级镜像，或临时放宽客户端算法策略后再重试。"
    )
