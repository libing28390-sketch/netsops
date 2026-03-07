# NetOps Pro - Enterprise Network Automation Platform

NetOps Pro is a modern, full-stack network automation and orchestration platform designed for enterprise infrastructure. It provides a unified interface for managing multi-vendor network devices, deploying configurations, and ensuring compliance.

## Key Features

- **Multi-Vendor Support**: Out-of-the-box support for Cisco IOS, Juniper Junos, H3C Comware, and Fortinet FortiOS.
- **Inventory Management**: Professional asset tracking with detailed hardware, software, and site information.
- **Automation Center**: Execute tasks like VLAN provisioning, compliance audits, and software upgrades across your fleet.
- **Configuration Management**: Jinja2-based templating system with global variable management.
- **Compliance & Standards**: Audit devices against "Golden Config" templates to ensure security and consistency.
- **Audit Logs**: Full traceability of all actions with detailed logs and rollback capabilities.

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+ (for backend workers)

### Installation

1. Install frontend dependencies:
   ```bash
   npm install
   ```

2. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application

1. Start the development server (Vite + Express):
   ```bash
   npm run dev
   ```

2. Access the platform at `http://localhost:3000`.

## Usage Guide

### 1. Inventory
- **Import/Export**: Use the "Import" button to bulk upload devices via JSON/CSV. Use "Export" to backup your current inventory.
- **Device Details**: Click "Details" on any device to see deep-dive hardware and status information.

### 2. Automation
- **Search & Filter**: Use the search bar in the Automation tab to find devices by Hostname, IP, or Platform.
- **Task Execution**: Select a device, then choose a task (e.g., Update VLAN). You can preview changes (Diff) before deploying.
- **Rollback**: If a task succeeds but needs to be reverted, use the "Rollback" button in the execution history.

### 3. Configuration
- **Templates**: Create Jinja2 templates for standardized configurations.
- **Variables**: Define global variables (like NTP or Syslog servers) that can be injected into any template.

### 4. Compliance
- Monitor the "Compliance Score" to see the overall health of your network.
- Remediate non-compliant devices directly from the compliance dashboard.

## Security

- **Role-Based Access**: Integrated authentication system.
- **Audit Trails**: Every action is logged with a timestamp and user ID.
- **Safe Deploys**: Configuration diffing ensures you see exactly what will change before it happens.
