# HPC Dashboard

[![License: GNU](https://img.shields.io/badge/License-GNU-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-latest-lightgrey)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-latest-38B2AC)](https://tailwindcss.com/)
[![Shadcn](https://img.shields.io/badge/Shadcn-components-8B5CF6)](https://ui.shadcn.com/)

> Powerful monitoring for your SLURM-based HPC cluster

The HPC Dashboard is a Next.js application designed to provide comprehensive monitoring of SLURM nodes. With a focus on performance and usability, this dashboard offers real-time insights into your HPC resources.

![Dashboard Screenshot](/images/dashboard1.png "HPC Dashboard Overview")

## Key Features

- Real-time monitoring of CPU and GPU node utilization
- Detailed individual node status
- Comprehensive Slurm job details and history
- Dynamic data updates with refresh countdown
- Job metrics analytics with historical reporting
- GPU utilization tracking
- LMOD module display
- Prometheus metrics integration
- OpenAI-powered chat assistant

## Documentation

For complete setup instructions, configuration guides, and advanced features, visit our documentation site:

**[https://slurmdash.com](https://slurmdash.com)**

## Quick Start

```bash
git clone https://github.com/thediymaker/slurm-node-dashboard.git
cd slurm-node-dashboard
npm install
# Set up your .env file (see docs for configuration)
npm run dev
```

Visit `http://localhost:3000` to see your dashboard in action.

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

- **Documentation**: [https://slurmdash.com](https://slurmdash.com)
- **Issues**: [GitHub Issues](https://github.com/thediymaker/slurm-node-dashboard/issues)
- **Contact**: Johnathan Lee - [john.lee@thediymaker.com](mailto:john.lee@thediymaker.com)

---

<p align="center">
  Made with ❤️ for HPC
</p>
