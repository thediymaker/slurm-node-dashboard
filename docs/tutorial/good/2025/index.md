---
layout: mac
title: GOOD 2025 HPC Dashboard Tutorial
permalink: /tutorial/good/2025/
---

# HPC Dashboard Getting Started Guide

Welcome to the **HPC Dashboard Tutorial**! This guide will walk you through deploying and running the HPC Dashboard on your provided virtual machine (VM).

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Repository Setup](#repository-setup)
5. [Configuration](#configuration)
6. [Dashboard Deployment](#dashboard-deployment)
7. [Production Setup](#production-setup)
8. [Open OnDemand Integration](#open-ondemand-integration)
9. [Best Practices](#best-practices)
10. [Additional Resources](#additional-resources)

## Introduction

The **HPC Dashboard** is a Next.js application designed for real-time monitoring of SLURM nodes. It provides detailed insights into CPU/GPU utilization, node status, job histories, and more. This tutorial will guide you through:

- Deploying the dashboard on a VM with a public IP
- Connecting to a remote SLURM API and Prometheus instance
- Setting up the Open OnDemand integration

## Prerequisites

Ensure you have the following:

- **VM Access**
  - VM with public IP (provided by tutorial host)
  - SSH key for secure access (provided by tutorial host)
  - SLURM API key (located at `/packages/slurm/config/key`)
  - SLURM and Prometheus IP addresses (provided by tutorial host)

## Environment Setup

### SSH Connection

Connect to your VM using SSH:

```bash
chmod 600 /path/to/your/ssh_key
ssh -i /path/to/your/ssh_key rocky@your_vm_public_ip
```

## Repository Setup

After logging in, switch to root and clone the repository:

```bash
sudo su -
cd /var/www/
git clone -b tutorial2025 https://github.com/thediymaker/slurm-node-dashboard.git
cd slurm-node-dashboard
```

## Configuration

### Install Dependencies

Install required Node.js packages:

```bash
npm install
```

### Environment Configuration

Set up the production environment:

```bash
mv .env.production .env
```

Update `.env` with your configuration:

```env
COMPANY_NAME="Tutorial"
VERSION=1.1.2
CLUSTER_NAME="Tutorial"
CLUSTER_LOGO="/logo.png"

PROMETHEUS_URL=""
OPENAI_API_KEY=""

NODE_ENV="production"
REACT_EDITOR="code"

SLURM_API_VERSION="v0.0.40"
SLURM_SERVER="192.168.1.233"
SLURM_API_TOKEN="your_slurm_api_token"  # Located at /packages/slurm/config/key
SLURM_API_ACCOUNT="slurm"
```

## Dashboard Deployment

### Development Mode

Start the development server:

```bash
npm run dev
```

Access the dashboard at `http://your_vm_public_ip:3020`

The dashboard displays all tutorial systems, which are running as SLURM compute nodes. Hover over nodes to view system details including hostname, load, and core usage. Click on nodes to view running jobs.

The interface includes:

- Color scheme options (top right)
- Menu access to historical data and modules pages
- GitHub link for bug reports and forking

### Adding Prometheus Integration

By default, the nodes have `ipmi_exporter` and `node_exporter` running for power and node data collection.

To enable Prometheus:

1. Stop the development server (Ctrl+C)
2. Update the `.env` file:

```bash
# Change this line
PROMETHEUS_URL="http://192.168.1.233:9090"
```

3. Restart the development server:

```bash
npm run dev
```

After this, you will now see power data on the dashboard, after selecting the "Show Detail" checkbox. This power data is fake power data, pushed to prometheus from each node since they are VMs. In a production environment, you would also see power data for each node when hovering.

## Production Setup

For production deployment, use PM2 to manage the dashboard:

```bash
# Install PM2
npm install -g pm2

# Build and start the application
npm run build
pm2 start npm --name "hpc-dashboard" -- start -- --port 3020
pm2 save
```

## Open OnDemand Integration

Open OnDemand is pre-installed on the VM. Default credentials:

- Username: "tutorial"
- Password: "good-tutorial-2025!"

### Installation Steps

1. Clone the integration repository:

```bash
cd /var/www/ood/apps/sys/
git clone https://github.com/thediymaker/ood-status-iframe.git
cd ood-status-iframe
```

2. Set up the Python environment:

```bash
python3 -m venv ood-status-iframe
source ood-status-iframe/bin/activate
python3 -m pip install -r requirements.txt
chmod +x bin/python
```

### Configuration Steps

1. Update the iframe URL in `templates/layout.html`:

```html
<iframe src="http://your_vm_hostname.rc.asu.edu:3020" ...></iframe>
```

2. Configure `manifest.yml`:

```yaml
name: System Status
description: HPC Status Page
category: System
subcategory: System Information
icon: fa://bar-chart
show_in_menu: true
```

Access Open OnDemand at `http://{your_vm_public_hostname.rc.asu.edu}/`

The status page is available under System → System Status.

## Usage

To submit a test job:

1. Switch to the tutorial user and prepare the batch script:

```bash
su - tutorial
cd /scratch
cp /packages/slurm/submit.sbatch ./$(hostname -s).sbatch
```

2. Edit the script to specify your node:

```bash
#SBATCH -w good-c3
```

3. Monitor jobs using:

```bash
scontrol show jobs
```

## Best Practices

- Implement SSL certificates
- Deploy behind NGINX or HTTPD with SSL
- Enable authentication for Open OnDemand
- Restrict dashboard access
- Maintain regular security updates

## Additional Resources

- [HPC Dashboard Repository](https://github.com/thediymaker/slurm-node-dashboard)
- [Next.js Documentation](https://nextjs.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [SLURM Documentation](https://slurm.schedmd.com/documentation.html)
- [Prometheus Documentation](https://prometheus.io/docs/)

### Video Tutorials

- [Quick Start Guide](https://youtu.be/wVEhPN-IqEA)
- [Open OnDemand Integration](https://youtu.be/avLUYgMya98)

---

<p align="center">
Made with ❤️ for HPC
</p>
