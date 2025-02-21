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
- Setting up basic and advanced integrations

## Prerequisites

Ensure you have the following:

- **VM Access**
  - VM with public IP (provided by tutorial host)
  - SSH key for secure access (provided by tutorial host)
  - SLURM API key (located at `/packages/slurm/config/key`)
  - SLURM and Prometheus IP addresses (pre-populated)

## Environment Setup

### SSH Connection

First, set appropriate permissions and connect to your VM:

```bash
chmod 600 /path/to/your/ssh_key
ssh -i /path/to/your/ssh_key rocky@your_vm_public_ip
```

## Repository Setup

After logging in, switch to root and navigate to the installation directory:

```bash
sudo su -
cd /var/www/
git clone -b tutorial2025 https://github.com/thediymaker/slurm-node-dashboard.git
cd slurm-node-dashboard
```

## Configuration

### Install Dependencies

```bash
npm install
```

### Environment Configuration

Move the production environment file to the active configuration:

```bash
mv .env.production .env
```

Update `.env` with your specific configuration:

```env
COMPANY_NAME="Tutorial"
NEXT_PUBLIC_BASE_URL="http://your_vm_public_ip:3000"
VERSION=1.1.2
CLUSTER_NAME="Tutorial"
CLUSTER_LOGO="/logo.png"

PROMETHEUS_URL="http://192.168.1.233:9090"
OPENAI_API_KEY=""

NODE_ENV="production"
REACT_EDITOR="code"

SLURM_API_VERSION="v0.0.40"
SLURM_SERVER="192.168.1.233"
SLURM_API_TOKEN="your_slurm_api_token"
SLURM_API_ACCOUNT="slurm"
```

## Dashboard Deployment

### Development Mode

Start the development server:

```bash
npm run dev
```

Access the dashboard at `http://your_vm_public_ip:3020`

## Production Setup

For production environments, use PM2 as the process manager:

```bash
# Install PM2
npm install -g pm2

# Build and start the application
npm run build
pm2 start npm --name "hpc-dashboard" -- start -- --port 3020
pm2 save
```

## Open OnDemand Integration

Open OnDemand has already been installed and configured on this VM. If you have an existing OOD instance running from your previous tutorial, you can use it, though the steps will be slightly different. The default username to log in to this dashboard is "tutorial" and the password is "good-tutorial-2025!"

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

1. Update the iframe URL in `templates/layout.html`. This URL will be your public `http://hostname:port`. For example, `http://r8-good-tutorial.rc.asu.edu:3020`. In a production environment, you'll likely have this running behind something like httpd or nginx, and you would point to your secured `https://externalURL`.

```html
<iframe src="https://your-external-dashboard-url.com" ...></iframe>
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

Access the Open OnDemand dashboard at `http://{your_vm_public_hostname.rc.asu.edu}/`

From here, you will be able to see the status page by browsing to the "System" dropdown in the menu, and then selecting System Status.

## Usage

From the dashboard, you can see the individual compute nodes. You can hover to get basic details and click to get more detailed information.

Let's submit a job so you can see it in action.

As root, switch to the "tutorial" user and browse to the /scratch directory. From here, copy the test batch script from /packages/slurm/submit.sbatch to this base directory. Make sure to use the following command to avoid overriding other users' scripts:

```bash
su - tutorial
cd /scratch
cp /packages/slurm/submit.sbatch ./$(hostname -s)-submit.sbatch
```

Edit the file and set the SBATCH option `-w` to submit to your specific node. For example:

```bash
#SBATCH -w r8-good-tutorial-c3
```

Once submitted, the job should show up on the dashboard. You can see the jobs which are in queue or running with the following command:

```bash
scontrol show jobs
```

## Best Practices

- Implement SSL certificates for secure communication
- Deploy behind NGINX or HTTPD with proper SSL configuration
- Enable authentication for Open OnDemand access
- Restrict direct dashboard access or implement additional authentication
- Regularly update dependencies and security patches

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
