# HPC Dashboard

[![License: GNU](https://img.shields.io/badge/License-GNU-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-latest-lightgrey)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-latest-38B2AC)](https://tailwindcss.com/)
[![Shadcn](https://img.shields.io/badge/Shadcn-components-8B5CF6)](https://ui.shadcn.com/)

> Powerful monitoring for your SLURM-based HPC cluster

The HPC Dashboard is a Next.js application designed to provide comprehensive monitoring of SLURM nodes. With a focus on performance and usability, this dashboard offers real-time insights into your HPC resources.

![Dashboard Screenshot](/images/new_dashboard_screenshot_1.png "HPC Dashboard Overview")

## Key Features

<details>
<summary><strong>Core Functionality</strong></summary>

- Real-time monitoring of CPU and GPU node utilization
- Detailed individual node status
- Comprehensive Slurm job details and history
- Dynamic data updates with refresh countdown

</details>

<details>
<summary><strong>Advanced Integrations</strong></summary>

Enable these features by configuring your environment file:

- LMOD module display and details
- Prometheus metrics integration
- OpenAI-powered chat and embeddings

</details>

## Quick Start

```bash
git clone https://github.com/thediymaker/slurm-node-dashboard.git
cd slurm-node-dashboard
npm install
# Set up your .env file (see Configuration section)
npm run dev
```

Visit `http://localhost:3000` to see your dashboard in action.

## Detailed Setup - Base

<details>
<summary><strong>Prerequisites</strong></summary>

- Node.js (v18 or later)
- npm or Yarn
- PM2 (for production deployment)
- Slurm API (enabled and configured)
- Slrum API user
- Slurm API token

</details>

<details>
<summary><strong>Enabling the Slurm API</strong></summary>

To use this dashboard, you need to have the Slurm API enabled on your HPC cluster. Follow these steps to set it up:

1. Start by reviewing the [Schedmd quickstart guide](https://slurm.schedmd.com/rest_quickstart.html).

2. Ensure that `slurmrestd` is running on your cluster.

3. Once the Slurm API is running, you need to generate an API key for authentication.

### Generating an API Key

The API key needs permissions to read all data. Here's an example of generating a key for the slurm user with a lifespan of 1 year:

```bash
scontrol token username=slurm lifespan=31536000
```

Note: This generates a JWT token. You can view the expiration date on the token and set up a reminder to renew it, or automate the renewal process (even with a shorter timeframe). The expiration of this token will be added to the future admin section on the dashboard.

</details>

<details>
<summary><strong>Configuration</strong></summary>

Create a `.env` file in the root directory:

```env
# BASE
COMPANY_NAME="Acme Corp"
NEXT_PUBLIC_BASE_URL="http://localhost:3000" # Update for your url and port
VERSION=1.1.2
CLUSTER_NAME="Cluster"
CLUSTER_LOGO="/cluster.png"

# DEV
NODE_ENV="dev"
REACT_EDITOR="code"

# SLURM
SLURM_API_VERSION="v0.0.40"
SLURM_SERVER="192.168.1.5"
SLURM_API_TOKEN=""
SLURM_API_ACCOUNT=""

# PLUGINS
NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN=false
NEXT_PUBLIC_ENABLE_PROMETHEUS_PLUGIN=false

# ADVANCED FEATURES
OPENAI_API_KEY=""
PROMETHEUS_URL=""  # Format http://192.168.1.5:9090
```

</details>

<details>
<summary><strong>Production Deployment</strong></summary>

For production environments, we recommend using PM2:

```bash
npm install -g pm2
pm2 start npm --name "hpc-dashboard" -- start
pm2 save
```

This ensures your dashboard runs continuously and restarts automatically if the server reboots.

</details>

## Advanced Usage

<details>
<summary><strong>Custom Data Collection</strong></summary>

### Historical Node Data

Collect historical node data with this script (run hourly via cron):

```bash
#!/bin/bash
SAVE_DIR="/path/to/data/directory"
mkdir -p "$SAVE_DIR"
FILENAME=$(date +"%Y-%m-%dT%H-%M-%S.000Z.json.gz")
curl -s "http://localhost:3000/api/slurm/nodes" | gzip > "$SAVE_DIR/$FILENAME"
find "$SAVE_DIR" -name "*.json.gz" -type f -mtime +30 -delete
```

### Module Data

Collect module data with this script (run daily via cron):

```bash
#!/bin/bash
json_dir="/path/to/public/directory"
json_output="${json_dir}/modules.json"
mkdir -p "$json_dir"
export MODULESHOME="/usr/share/lmod/lmod"
export MODULEPATH="/your/module/path"
$LMOD_DIR/spider -o jsonSoftwarePage $MODULEPATH | python -m json.tool > "$json_output"
```

</details>

<details>
<summary><strong>Open OnDemand Integration</strong></summary>

To integrate this dashboard with Open OnDemand:

Clone the generic Ruby app template:

```
git clone https://github.com/thediymaker/ood-status-iframe.git
```

Navigate to the cloned repository:

```
cd ood-status-iframe
```

Open the views/layout.erb file in your preferred text editor.
Update the URL in the views/layout.erb file to point to your deployed HPC Dashboard:
erb

```
<iframe src="https://your-hpc-dashboard-url.com" ...>
```

Follow Open OnDemand's documentation to deploy this app within your Open OnDemand environment.

This integration allows you to embed the HPC Dashboard within your Open OnDemand interface, providing users with easy access to cluster status information.

</details>

## Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch: `git checkout -b new-feature`
3. Make your changes and commit: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin new-feature`
5. Submit a pull request

## License

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE.md) file for details.

## Support and Contact

For support, please open an issue on our [GitHub repository](https://github.com/thediymaker/slurm-node-dashboard/issues).

For direct inquiries, contact Johnathan Lee at [john.lee@thediymaker.com](mailto:john.lee@thediymaker.com).

## Video

<details>
<summary><strong>Video Guides</strong></summary>

Quick start guide

[![Quickstart](https://img.youtube.com/vi/wVEhPN-IqEA/0.jpg)](https://youtu.be/wVEhPN-IqEA)

Open OnDemand iframe configuration

[![OOD iframe](https://img.youtube.com/vi/avLUYgMya98/0.jpg)](https://youtu.be/avLUYgMya98)

</details>

## Gallery

<details>
<summary><strong>Additional Screenshots</strong></summary>

|                 Feature Overview                 |                     Job Details                      |
| :----------------------------------------------: | :--------------------------------------------------: |
| ![Features](/images/new_features_screenshot.png) | ![Job Detail](/images/new_job_detail_screenshot.png) |

|                      Running Job                       |                       Completed Job                        |
| :----------------------------------------------------: | :--------------------------------------------------------: |
| ![Running Job](/images/new_running_job_screenshot.png) | ![Completed Job](/images/new_completed_job_screenshot.png) |

|                   Node Hover Details                    |
| :-----------------------------------------------------: |
| ![Hover Status](/images/new_dashboard_screenshot_2.png) |

</details>

---

<p align="center">
  Made with ❤️ for HPC
</p>
