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
   Copy the `.env.production` to `.env` in the project root. Use the template below and adjust the values to match your environment (e.g., VM public IPs, SLURM API details, and Prometheus URL):

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
   SLURM_SERVER="r8-good-tutorial-c1.hn.asu.edu"
   SLURM_API_TOKEN="your_slurm_api_token" # add the API key
   SLURM_API_ACCOUNT="slurm"

   # ADVANCED FEATURES
   PROMETHEUS_URL="http://r8-good-tutorial-hn.rc.asu.edu:9090"
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

## Production Deployment (Optional)

For a production environment, it is recommended to use **PM2** to manage the application:

1. **Install PM2 Globally**:

   ```bash
   npm install -g pm2
   ```

2. **Start the Application with PM2**:
   ```bash
   pm2 start npm --name "hpc-dashboard" -- start
   pm2 save
   ```

---

## Advanced Integrations & Data Collection

The HPC Dashboard supports several advanced features:

- **Historical Node Data**:  
  Collect historical node data hourly. You will want to copy the following in to a script, and then call this from crontab. You can set this up to run hourly, or as often as you would like. By default it keeps the last 30 days worth of data.

  ```bash
  #!/bin/bash
  SAVE_DIR="/var/www/slurm-node-dashboard/data"
  mkdir -p "$SAVE_DIR"
  FILENAME=$(date +"%Y-%m-%dT%H-%M-%S.000Z.json.gz")
  curl -s "http://localhost:3020/api/slurm/nodes" | gzip > "$SAVE_DIR/$FILENAME"
  find "$SAVE_DIR" -name "*.json.gz" -type f -mtime +30 -delete
  ```

- **Open OnDemand Integration**:  
  You can embed the dashboard within Open OnDemand by updating the iframe URL in the provided Ruby app template from [this repository](https://github.com/thediymaker/ood-status-iframe).

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
