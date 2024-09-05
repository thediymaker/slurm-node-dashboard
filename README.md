# HPC Dashboard

This repository contains the source code for the HPC Dashboard, a Next.js application designed to monitor the status of SLURM nodes. The dashboard provides total utilization metrics for CPU and GPU nodes, as well as detailed statuses for individual nodes. This application is built using well known packages, and styled with tailwindcss and Shadcn components

## Standard Features

- View total utilization of CPU and GPU nodes.
- Individual node status with details on CPU, GPU, and memory usage.
- View Slurm job details.

## Optional Features

The optional features will be enabled by adding the detailst to the environments file. If these are left blank, the intergration will not show up, but the rest of the application will continue to function correctly.

- LMOD module details
- Prometheus integration
- InfluxDB intergration
- OpenAI intergration

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v18 or later)
- Yarn or npm
- Slurm API enabled on your HPC cluster
- Slurm API token for authentication

## Enabling the Slurm API

Start by viewing the Schedmd quickstart guide
https://slurm.schedmd.com/rest_quickstart.html

You will need to make slurmrestd is running.

Once you have the slurm API running, you will need to generate an API key for use with the API.

This API key will need access to read all data, here is an example using the slurm user, with a lifespan of 1 year:

```
scontrol token username=slurm lifespan=31536000
```

Since this is a JWT token, you can view the expiration date on the token, and set up a reminder to renew, or automate the renewal of the token (even with a shorter time frame). Note: The expiration of this token will be added to the future admin section on the dashboard.

## Getting Started

To get a local copy of the dashboard up and running, follow these steps.

### Clone the repository

```bash
git clone https://github.com/thediymaker/slurm-node-dashboard.git
cd slurm-node-dashboard
```

### Install dependencies

```
npm install
```

```
dnf install pm2
or
apt install pm2
```

### Run the application with PM2

```
pm2 start npm --name "slurm-node-dashboard" -- start
```

The application should now be running on [http://localhost:3000](http://localhost:3000).

## Environment Variables

To run this project, you can start by adding the following environment variables to your `.env` file.

```plaintext
COMPANY_NAME="ACME INC"
CLUSTER_NAME="SUPERCOMPUTER"
CLUSTER_LOGO="/logo.png"

PROMETHEUS_URL="http://1.2.3.4:9090" # EXAMPLE Keep blank if not using (placeholder to show proper format)

OPENAI_API_KEY=""

NODE_ENV="production"
REACT_EDITOR="code"

SLURM_API_VERSION="v0.0.40"
SLURM_SERVER=""
SLURM_API_TOKEN=""
```

The only required env variables are the "SLURM" ones. You will also want to update teh cluster and company details. The OPENAI and PROMETHEUS varaiables are only required if you want to use those features.

**You will also need to make sure you place your logo.png in the plublic directory, as well as replace the default favicon.ico with your own.**

## Collecting node data in JSON format, for use with the "Historical" node status module.

In order to capture the data for use with the historical module, you need to create a script that pulls down the node data on an hourly basis, here is an example script, that you would then call hourly via cron.

```
#!/bin/bash

# Set the timezone
export TZ='America/Phoenix'

# Set the directory where you want to save the JSON files
SAVE_DIR="/var/www/beta_dashboard/data"

# Ensure the save directory exists
mkdir -p "$SAVE_DIR"

# Generate the filename with the current date and time
FILENAME=$(date +"%Y-%m-%dT%H-%M-%S.000Z.json.gz")

# Fetch the data and save it to the file
curl -s "http://localhost:3000/api/slurm/nodes" | gzip > "$SAVE_DIR/$FILENAME"

# Optional: Keep only the last 30 days of data
find "$SAVE_DIR" -name "*.json.gz" -type f -mtime +30 -delete
```

## Collecting module data in JSON format, for use with the "Modules" module.

In order to collect the JSON data for the modules page, you will need to create this script and call it on any cadence you see fit. This will overwrite the existing modules.json.

```
#!/bin/bash

# Set output variables
json_dir="/var/www/beta_dashboard/public"
json_output="${json_dir}/modules.json"

# Create json directory if it doesn't exist
mkdir -p "$json_dir"

# Set environment variables - this will likely change for you
export MODULESHOME="/usr/share/lmod/lmod"
export MODULEPATH="/packages/modulefiles/apps:/packages/modulefiles/spack"

# Run the spider command and save JSON output
$LMOD_DIR/spider -o jsonSoftwarePage $MODULEPATH | python -m json.tool > "$json_output"
```

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the GNU License. See `LICENSE.md` for more information.

## Contact

Johnathan Lee

[john.lee@thediymaker.com](mailto:john.lee@thediymaker.com)

[https://github.com/thediymaker/slurm-node-dashboard](https://github.com/thediymaker/slurm-node-dashboard)

## Screenshots

### Dashboard image displaying refresh countdown and footer

![Dashboard Screenshot](/images/new_dashboard_screenshot_1.png "Basic Dashboard")

### Dashboard features

![Dashboard Hover Screenshot](/images/new_features_screenshot.png "Features")

### Node detail with job view

![Dashboard Footer Screenshot](/images/new_job_detail_screenshot.png "Job Detail")

### Running job detail

![Dashboard Footer Screenshot](/images/new_running_job_screenshot.png "Basic Job Detail")

### Completed job detail

![Dashboard Screenshot](/images/new_completed_job_screenshot.png "Dashboard Overview")

### Dashboard Hover

![Dashboard Hover Screenshot](/images/new_dashboard_screenshot_2.png "Hover Status")
