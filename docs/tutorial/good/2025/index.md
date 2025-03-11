---
layout: mac
title: GOOD 2025 HPC Dashboard Tutorial
permalink: /tutorial/good/2025/
---

<style>
.code-container {
  position: relative;
  background-color: #f6f8fa;
  border-radius: 6px;
  margin-bottom: 16px;
}

.code-block {
  padding: 16px;
  overflow-x: auto;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 85%;
  line-height: 1.45;
  border-radius: 6px;
  margin-bottom: 0;
}

.copy-button {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  font-size: 12px;
  background-color: #e1e4e8;
  border: 1px solid #d1d5da;
  border-radius: 3px;
  cursor: pointer;
}

.copy-button:hover {
  background-color: #d1d5da;
}
</style>

<script>
function copyToClipboard(buttonElement) {
  const codeBlock = buttonElement.parentElement.querySelector('code');
  const text = codeBlock.textContent;
  
  navigator.clipboard.writeText(text).then(() => {
    const originalText = buttonElement.textContent;
    buttonElement.textContent = 'Copied!';
    setTimeout(() => {
      buttonElement.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy: ', err);
  });
}
</script>

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

To get started, you will need to copy the SSH key provided by the tutorial host through a web link. This key will allow you to securely connect to your virtual machine.

> **Important**: When downloading the SSH key from the provided URL, you'll need to use the password: `good-tutorial-2025!`. The SSH key itself is not passphrase-protected.

#### For Mac Users

1. **Copy the SSH key**:

   - Click on the web link provided by the tutorial host
   - The page will display the SSH private key text
   - Select all the text and copy it to your clipboard (Cmd+C)

2. **Create the SSH key file**:

   - Open Terminal
   - Create a directory for your SSH keys if it doesn't exist:

   <div class="code-container">
   <pre class="code-block"><code>mkdir -p ~/.ssh</code></pre>
   <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
   </div>

   - Create a new file for your SSH key:

   <div class="code-container">
   <pre class="code-block"><code>nano ~/.ssh/tutorial_key</code></pre>
   <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
   </div>

   - Paste the copied key text into the file (Cmd+V)
   - Save the file (Ctrl+O, then Enter) and exit the editor (Ctrl+X)

3. **Set proper permissions**:

   - Set the correct permissions on the key file:

   <div class="code-container">
   <pre class="code-block"><code>chmod 600 ~/.ssh/tutorial_key</code></pre>
   <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
   </div>

4. **Connect to your VM**:

   <div class="code-container">
   <pre class="code-block"><code>ssh -i ~/.ssh/tutorial_key rocky@your_vm_public_ip</code></pre>
   <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
   </div>

   - Replace `your_vm_public_ip` with the IP address provided by the tutorial host
   - No passphrase will be required for the SSH connection

#### For Windows Users

The easiest way to connect from Windows is using PuTTY:

1. **Download and install PuTTY**:

   - If you don't already have it, download PuTTY from [https://www.putty.org/](https://www.putty.org/)
   - Install it by following the installation wizard

2. **Set up your SSH key**:

   - Open PuTTYgen (it comes with PuTTY installation)
   - Click in the text area at the bottom of the window labeled "Key"
   - Paste the copied SSH key text (Ctrl+V)
   - No passphrase is needed as the key is not passphrase-protected
   - Click "Save private key" and save the file with a .ppk extension (e.g., `tutorial_key.ppk`)

3. **Connect to your VM**:
   - Open PuTTY
   - In the "Host Name" field, enter your VM's IP address
   - In the "Connection type" section, make sure "SSH" is selected
   - In the left sidebar, navigate to Connection → SSH → Auth → Credentials
   - Click the "Browse" button next to "Private key file for authentication"
   - Select the .ppk file you saved in the previous step
   - Go back to the "Session" category (top of the left sidebar)
   - Enter a name in the "Saved Sessions" field and click "Save" to save these settings for future use
   - Click "Open" to connect
   - When prompted, enter the username: `rocky`
   - You should connect without being prompted for a passphrase

#### Troubleshooting SSH Connection

- **Access issues**: The SSH key does not require a passphrase for use (only for download from the URL)
- **Permission denied errors**: Ensure your key file has the correct permissions
- **Connection refused**: Verify you're using the correct IP address and that the VM is running
- **Host key verification failed**: If you've previously connected to a different VM with the same IP address, you may need to remove the old entry from your `known_hosts` file:

  <div class="code-container">
  <pre class="code-block"><code>ssh-keygen -R your_vm_public_ip</code></pre>
  <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
  </div>

Once connected, you should see a command prompt indicating you're logged in to the VM. You can proceed with the repository setup as outlined in the next section.

## Repository Setup

After logging in, switch to root and set up the dashboard:

<div class="code-container">
<pre class="code-block"><code>sudo su -
cd /var/www/
npx create-slurm-dashboard slurm-node-dashboard</code></pre>
<button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
</div>

Follow the prompts to select "Good HPC Tutorial 2025"

> **Important**: If you accidentally select the wrong version, simply delete the slurm-node-dashboard directory and run the command again.

## Configuration

### Install Dependencies

Change in to the dashboard directory, and install required Node.js packages:

<div class="code-container">
<pre class="code-block"><code>cd slurm-node-dashboard
npm install</code></pre>
<button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
</div>

### Environment Configuration

Set up the production environment:

<div class="code-container">
<pre class="code-block"><code>mv .env.production .env</code></pre>
<button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
</div>

Update `.env` with your configuration:

<div class="code-container">
<pre class="code-block"><code>COMPANY_NAME="Tutorial"
VERSION=1.1.2
CLUSTER_NAME="Tutorial"
CLUSTER_LOGO="/logo.png"

PROMETHEUS_URL=""
OPENAI_API_KEY=""

NODE_ENV="production"
REACT_EDITOR="code"

SLURM_API_VERSION="v0.0.40"
SLURM_SERVER="192.168.1.233"
SLURM_API_TOKEN="your_slurm_api_token" # Located at /packages/slurm/config/key
SLURM_API_ACCOUNT="slurm"</code></pre>
<button class="copy-button" onclick="copyToClipboard(this)">Copy</button>

</div>

## Dashboard Deployment

### Development Mode

Start the development server:

<div class="code-container">
<pre class="code-block"><code>npm run dev</code></pre>
<button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
</div>

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

   <div class="code-container">
   <pre class="code-block"><code># Change this line
PROMETHEUS_URL="http://192.168.1.233:9090"</code></pre>
   <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
   </div>

3. Restart the development server:

   <div class="code-container">
   <pre class="code-block"><code>npm run dev</code></pre>
   <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
   </div>

After this, you will see power data on the dashboard after selecting the "Show Detail" checkbox. This power data is simulated since the nodes are VMs. In a production environment, you would also see real power data for each node when hovering.

## Production Setup

For production deployment, use PM2 to manage the dashboard:

<div class="code-container">
<pre class="code-block"><code># Install PM2
npm install -g pm2

# Build and start the application

npm run build
pm2 start npm --name "hpc-dashboard" -- start -- --port 3020
pm2 save</code></pre>
<button class="copy-button" onclick="copyToClipboard(this)">Copy</button>

</div>

## Open OnDemand Integration

Open OnDemand is pre-installed on the VM. Default credentials:

- Username: "tutorial"
- Password: "good-tutorial-2025!"

### Installation Steps

1. Clone the integration repository:

   <div class="code-container">
   <pre class="code-block"><code>cd /var/www/ood/apps/sys/
git clone https://github.com/thediymaker/ood-status-iframe.git && cd ood-status-iframe</code></pre>
   <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
   </div>

2. Set up the Python environment:

   <div class="code-container">
   <pre class="code-block"><code>python3 -m venv ood-status-iframe
source ood-status-iframe/bin/activate
python3 -m pip install -r requirements.txt
chmod +x bin/python</code></pre>
   <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
   </div>

### Configuration Steps

1. Update the iframe URL in `templates/layout.html`:

   <div class="code-container">
   <pre class="code-block"><code>&lt;iframe src="http://your_vm_hostname.rc.asu.edu:3020" ...&gt;&lt;/iframe&gt;</code></pre>
   <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
   </div>

2. Configure `manifest.yml`:

   <div class="code-container">
   <pre class="code-block"><code>name: System Status
description: HPC Status Page
category: System
subcategory: System Information
icon: fa://bar-chart
show_in_menu: true</code></pre>
   <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
   </div>

Access Open OnDemand at `http://{your_vm_public_hostname.rc.asu.edu}/`

The status page is available under System → System Status.

## Usage

To submit a test job:

1. Switch to the tutorial user and prepare the batch script:

   <div class="code-container">
   <pre class="code-block"><code>su - tutorial
cd /scratch
cp /packages/slurm/submit.sbatch ./$(hostname -s).sbatch</code></pre>
   <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
   </div>

2. Edit the script to specify your node:

   <div class="code-container">
   <pre class="code-block"><code>#SBATCH -w good-c3</code></pre>
   <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
   </div>

3. Monitor jobs using:

   <div class="code-container">
   <pre class="code-block"><code>scontrol show jobs</code></pre>
   <button class="copy-button" onclick="copyToClipboard(this)">Copy</button>
   </div>

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
