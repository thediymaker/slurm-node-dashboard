# HPC Dashboard Getting Started Guide

Welcome to the HPC Dashboard Tutorial! This guide will help you deploy and run the HPC Dashboard on your provided VM.

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

The **HPC Dashboard** is a Next.js application designed for real-time monitoring of SLURM nodes. It provides detailed insights into CPU/GPU utilization, node status, job histories, and much more. During this tutorial, you will:

- Deploy the dashboard on a VM (with a public IP and provided SSH key).
- Connect to a remote SLURM API and Prometheus instance running on another VM.
- Explore both basic and advanced integrations.

---

## Prerequisites

Before you begin, ensure you have the following:

- **VM Access**:
  - A provided VM with a public IP.
  - An SSH key for secure access.
  - Slurm API key.
  - Slurm and Prometheus IP addresses

---

## Environment Setup

1. **Connect to Your VM**:  
   Open your terminal and use the provided SSH key to connect:

   ```bash
   ssh -i /path/to/your/ssh_key rocky@your_vm_public_ip
   ```

---

## Cloning the Repository

Once you get logged in, you will want to change directory to the /var/www/ and clone the HPC Dashboard repository from GitHub:

```bash
cd /var/www/
git clone -b tutorial2025 https://github.com/thediymaker/slurm-node-dashboard.git
cd slurm-node-dashboard
```

---

## Configuring the Application

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Set Up Your Environment File**:  
   Move the `.env.production` to `.env` in the project root (note, having both could cause build errors, so move not copy). Use the template below and adjust the values to match your environment (e.g., VM public IPs, SLURM API details, and Prometheus URL):

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
   SLURM_API_TOKEN="your_slurm_api_token" # add the API key
   SLURM_API_ACCOUNT="slurm"

   # ADVANCED FEATURES
   PROMETHEUS_URL="http://192.168.1.233:9090"
   ```

---

## Running the Dashboard

1. **Development Mode**:  
   Start the dashboard in development mode:

   ```bash
   npm run dev
   ```

   Visit `http://your_vm_public_ip:3020` in your web browser to see the dashboard.

---

## Production Deployment

For a production environment, it is recommended to use **PM2** to manage the application:

1. **Install PM2 Globally**:

   ```bash
   npm install -g pm2
   ```

2. **Start the Application with PM2**:

This will start the application on port 3020, which is what we were using for dev.

```bash
pm2 start npm --name "hpc-dashboard" -- start -- --port 3020
pm2 save
```

---

## Open onDemand Integration

You can embed the dashboard within Open OnDemand by updating the iframe URL in the provided Python App template from [this repository](https://github.com/thediymaker/ood-status-iframe).

### Installation

1. Clone this repository into the Open OnDemand apps directory:

```bash
cd /var/www/ood/apps/sys/
git clone https://github.com/thediymaker/ood-status-iframe.git
cd ood-status-iframe
```

2. Create a virtual environment and install requirements

```bash
python3 -m venv ood-status-iframe
source ood-status-iframe/bin/activate
python3 -m pip install -r requirements.txt
```

3. If you updated the name of the envionment, you will need to modify the path in the bin/python file to match. Also you need ot make sure the bin/python file is executable.

```bash
chmod +x bin/python
```

### Configuration

1. Open the `templates/layout.html` file in your preferred text editor.

2. Update the URL in the iFrame to point to your external dashboard:

```erb
<iframe src="https://your-external-dashboard-url.com" ...>
```

3. Update the mainifest.yml to reflect the application name and location in the menu that you would like this app to appear.

```yml
name: System Status
description: |-
  HPC Status Page
category: System
subcategory: System Information
icon: fa://bar-chart
show_in_menu: true
```

4. Once this is complete, you will now be able to browse to your open on demand instance at http://{your_vm_public_hostname.rc.asu.edu}/. From here, you will see the "System" drop down on the menu, and will be able to select "System Status". This will load the dashboard in your OOD instance.

---

## Notes and best practices

All systems should be secured with SSL certificates. We did not to these in this tutorial, but ideally you would want your Status Dashboard running behind NGNIX or HTTPD with an SSL Certificate, and then giving that URL to the OOD iframe plugin.

You should have real authentication in from of Open OnDemand.

You should have authentication in front of the dashboard, or make sure the dashboard is not accessible outside of Open OnDemand.

---

## Additional Resources

- **HPC Dashboard Repository**: [GitHub Repository](https://github.com/thediymaker/slurm-node-dashboard)
- **Next.js Documentation**: [https://nextjs.org/](https://nextjs.org/)
- **Tailwind CSS Documentation**: [https://tailwindcss.com/](https://tailwindcss.com/)
- **SLURM Documentation**: [https://slurm.schedmd.com/documentation.html](https://slurm.schedmd.com/documentation.html)
- **Prometheus Documentation**: [https://prometheus.io/docs/](https://prometheus.io/docs/)
- **Video Guides**:
  - [Quick Start Guide](https://youtu.be/wVEhPN-IqEA)
  - [Open OnDemand Integration](https://youtu.be/avLUYgMya98)

---

Happy monitoring and enjoy the HPC Dashboard Tutorial!

<p align="center">
  Made with ❤️ for HPC
</p>
