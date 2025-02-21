# HPC Dashboard Getting Started Guide

Welcome to the **HPC Dashboard Tutorial**! This guide will walk you through the process of deploying and running the HPC Dashboard on your provided virtual machine (VM).

---

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Cloning the Repository](#cloning-the-repository)
5. [Configuring the Application](#configuring-the-application)
6. [Running the Dashboard](#running-the-dashboard)
7. [Production Deployment (Optional)](#production-deployment-optional)
8. [Advanced Integrations & Data Collection](#advanced-integrations--data-collection)
9. [Troubleshooting & Support](#troubleshooting--support)
10. [Additional Resources](#additional-resources)

---

## Introduction

The **HPC Dashboard** is a Next.js application designed for real-time monitoring of SLURM nodes. It provides detailed insights into CPU/GPU utilization, node status, job histories, and more. In this tutorial, you will:

- Deploy the dashboard on a VM (with a public IP and provided SSH key).
- Connect to a remote SLURM API and Prometheus instance running on another VM.
- Explore both basic and advanced integrations.

---

## Prerequisites

Before proceeding, ensure you have the following:

- **VM Access**:
  - A provided VM with a public IP (provided by the tutorial host).
  - An SSH key for secure access (provided by the tutorial host).
  - A SLURM API key (located at `/packages/slurm/config/key` on the VM).
  - SLURM and Prometheus IP addresses (pre-populated).

---

## Environment Setup

### 1. Connect to Your VM

Open your terminal and use the provided SSH key to connect:

```bash
ssh -i /path/to/your/ssh_key rocky@your_vm_public_ip
```

---

## Cloning the Repository

Once logged in, navigate to `/var/www/` and clone the HPC Dashboard repository from GitHub:

```bash
cd /var/www/
git clone -b tutorial2025 https://github.com/thediymaker/slurm-node-dashboard.git
cd slurm-node-dashboard
```

---

## Configuring the Application

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Your Environment File

Move `.env.production` to `.env` in the project root (avoid copying, as having both can cause build errors). Use the template below and adjust the values to match your environment (e.g., VM public IPs, SLURM API details, and Prometheus URL):

```env
# BASE
COMPANY_NAME="Tutorial"
NEXT_PUBLIC_BASE_URL="http://your_vm_public_ip:3000"
VERSION=1.1.2
CLUSTER_NAME="Tutorial"
CLUSTER_LOGO="/logo.png"

# DEV
NODE_ENV="dev"
REACT_EDITOR="code"

# SLURM
SLURM_API_VERSION="v0.0.40"
SLURM_SERVER="192.168.1.233"
SLURM_API_TOKEN="your_slurm_api_token" # Add the API key
SLURM_API_ACCOUNT="slurm"

# ADVANCED FEATURES
PROMETHEUS_URL="http://192.168.1.233:9090"
```

---

## Running the Dashboard

### 1. Development Mode

Start the dashboard in development mode:

```bash
npm run dev
```

Visit `http://your_vm_public_ip:3020` in your web browser to access the dashboard.

---

## Production Deployment (Optional)

For a production environment, it is recommended to use **PM2** to manage the application.

### 1. Install PM2 Globally

```bash
npm install -g pm2
```

### 2. Start the Application with PM2

This will start the application on port 3020 (same as in development mode).

```bash
npm run build
pm2 start npm --name "hpc-dashboard" -- start -- --port 3020
pm2 save
```

---

## Open OnDemand Integration

You can embed the dashboard within Open OnDemand by updating the iframe URL in the provided Python app template from [this repository](https://github.com/thediymaker/ood-status-iframe).

### Installation

1. Clone this repository into the Open OnDemand apps directory:

```bash
cd /var/www/ood/apps/sys/
git clone https://github.com/thediymaker/ood-status-iframe.git
cd ood-status-iframe
```

2. Create a virtual environment and install dependencies:

```bash
python3 -m venv ood-status-iframe
source ood-status-iframe/bin/activate
python3 -m pip install -r requirements.txt
```

3. If you updated the name of the environment, modify the path in `bin/python` to match. Ensure the file is executable:

```bash
chmod +x bin/python
```

### Configuration

1. Open `templates/layout.html` in your preferred text editor.
2. Update the iFrame URL to point to your external dashboard:

```erb
<iframe src="https://your-external-dashboard-url.com" ...>
```

3. Modify `manifest.yml` to reflect the application name and menu location:

```yml
name: System Status
description: |-
  HPC Status Page
category: System
subcategory: System Information
icon: fa://bar-chart
show_in_menu: true
```

4. Once completed, navigate to your Open OnDemand instance at `http://{your_vm_public_hostname.rc.asu.edu}/`. You should see the "System" dropdown in the menu, where you can select "System Status" to load the dashboard.

---

## Notes & Best Practices

- **Secure your systems with SSL certificates.** Ideally, the Status Dashboard should run behind **NGINX** or **HTTPD** with an SSL certificate, and that URL should be used in the Open OnDemand iframe plugin.
- **Ensure authentication is in place** before exposing Open OnDemand.
- **Restrict dashboard access** outside of Open OnDemand, or implement authentication.

---

## Additional Resources

- **HPC Dashboard Repository**: [GitHub Repository](https://github.com/thediymaker/slurm-node-dashboard)
- **Next.js Documentation**: [Next.js](https://nextjs.org/)
- **Tailwind CSS Documentation**: [Tailwind CSS](https://tailwindcss.com/)
- **SLURM Documentation**: [SLURM](https://slurm.schedmd.com/documentation.html)
- **Prometheus Documentation**: [Prometheus](https://prometheus.io/docs/)
- **Video Guides**:
  - [Quick Start Guide](https://youtu.be/wVEhPN-IqEA)
  - [Open OnDemand Integration](https://youtu.be/avLUYgMya98)

---

Happy monitoring, and enjoy the HPC Dashboard Tutorial!

<p align="center">
  Made with ❤️ for HPC
</p>
