import logging
import os


logger = logging.getLogger(__name__)


def configure_ntc_templates() -> str | None:
    """Resolve installed ntc-templates path and export NET_TEXTFSM for parsers."""
    existing = os.environ.get('NET_TEXTFSM', '').strip()
    if existing:
        if os.path.isdir(existing):
            return existing
        logger.warning('NET_TEXTFSM is set but path does not exist: %s', existing)

    try:
        import ntc_templates
    except ImportError:
        logger.warning('ntc-templates is not installed; TextFSM parsing will rely on raw templates only')
        return None

    package_dir = os.path.dirname(os.path.abspath(ntc_templates.__file__))
    templates_dir = os.path.join(package_dir, 'templates')
    if not os.path.isdir(templates_dir):
        logger.warning('ntc-templates package found but templates directory is missing: %s', templates_dir)
        return None

    os.environ['NET_TEXTFSM'] = templates_dir
    logger.info('Configured NET_TEXTFSM=%s', templates_dir)
    return templates_dir