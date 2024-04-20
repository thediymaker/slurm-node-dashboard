
# HPC Dashboard

This repository contains the source code for the HPC Dashboard, a Next.js application designed to monitor the status of SLURM nodes. The dashboard provides total utilization metrics for CPU and GPU nodes, as well as detailed individual node status.

## Features

- View total utilization of CPU and GPU nodes.
- Individual node status with details on CPU, GPU, and memory usage.
- Styled with Shadcn and Tailwind CSS.
- Built with Next.js and Docker for easy deployment and scalability.

## Prerequisites

Before you begin, ensure you have the following installed:
- Docker
- Node.js (v18 or later)
- Yarn or npm
- Slurm API enabled on your HPC cluster
- Slurm API token for authentication

## Getting Started

To get a local copy up and running, follow these simple steps.

### Clone the repository

```bash
git clone https://github.com/thediymaker/hpc-dashboard.git
cd hpc-dashboard
```

### Build the Docker image

```bash
docker build -t hpc-dashboard .
```

### Run the Docker container

```bash
docker run -p 3000:3000 hpc-dashboard
```

The application should now be running on [http://localhost:3000](http://localhost:3000).

## Environment Variables

To run this project, you will need to add the following environment variables to your `.env` file.

```plaintext
COMPANY_NAME=""
URL=""
NEXT_PUBLIC_APP_URL=""
VERSION="1.1.2"
CLUSTER_NAME=""
CLUSTER_LOGO="logo.png"

NODE_ENV="production"
REACT_EDITOR="code"

SLURM_API_VERSION="v0.0.40"
SLURM_SERVER=""
SLURM_API_TOKEN=""
```

**You will also need to make sure you place your logo.png in the plublic directory, as well as replace the default favicon.ico with your own.**


## Docker Configuration

Here's a brief overview of the Docker setup:

- **Base Image:** Uses `node:18-alpine` for a lightweight container.
- **Dependencies:** Installs project dependencies selectively based on the presence of a lock file.
- **Building:** Compiles the Next.js project.
- **Running:** Uses a non-root user for improved security.

Refer to the `Dockerfile` in the repository for detailed configuration.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Your Name – [john.lee@thediymaker.com](mailto:john.lee@thediymaker.com)

Project Link: [https://github.com/thediymaker/hpc-dashboard](https://github.com/thediymaker/hpc-dashboard)

## Screenshots

### Dashboard
![Dashboard Screenshot](/images/dashboard_screenshot.png "Dashboard Overview")

### Dashboard Hover
![Dashboard Hover Screenshot](/images/dashboard_screenshot2.png "Hover Status")

### Dashboard Footer
![Dashboard Footer Screenshot](/images/dashboard_screenshot3.png "Footer")

