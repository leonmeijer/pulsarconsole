# Pulsar Console

A modern, real-time management UI for Apache Pulsar.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)
![Python](https://img.shields.io/badge/Python-3.11+-3776ab.svg)

## Overview

Pulsar Console is a sleek, real-time web interface for managing and monitoring Apache Pulsar clusters. Built with React and Python FastAPI, it provides intuitive dashboards, topic management, subscription monitoring, and message browsing — all with a modern dark-themed UI.

## Features

- **Real-time Monitoring** — Live cluster health, message throughput, and broker status
- **Topic Management** — Create, delete, and configure topics with partition support
- **Subscription Management** — Monitor backlogs, skip messages, and reset cursors
- **Message Browser** — Inspect messages in subscriptions without consuming them
- **Multi-tenant Support** — Navigate tenants, namespaces, and topics hierarchically
- **Global Search** — Instantly find topics, subscriptions, consumers, namespaces, and brokers
- **Notifications** — Automatic alerts for consumer disconnects, broker health issues, and storage warnings
- **Favorites** — Quick access to frequently used topics and subscriptions
- **Audit Logging** — Track all management operations

## Screenshots

*Coming soon*

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose (optional)
- Access to an Apache Pulsar cluster

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/leonmeijer/pulsarconsole.git
   cd pulsarconsole
   ```

2. **Start infrastructure** (PostgreSQL, Redis)
   ```bash
   docker compose up -d postgres redis
   ```

3. **Setup backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env      # Edit .env with your Pulsar cluster URL
   alembic upgrade head      # Run database migrations
   uvicorn app.main:app --reload
   ```

4. **Setup frontend**
   ```bash
   cd ..  # Back to root
   npm install
   npm run dev
   ```

5. **Open** http://localhost:5173

### Docker Compose (Full Stack)

```bash
# Start everything including a local Pulsar instance
docker compose --profile full up -d
```

## Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PULSAR_ADMIN_URL` | Pulsar Admin REST API URL | `http://localhost:8080` |
| `PULSAR_AUTH_TOKEN` | Authentication token (optional) | — |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection string | — |

See `backend/.env.example` for all available options.

## Tech Stack

### Frontend
- React 19 with TypeScript
- Vite for build tooling
- TanStack Query for data fetching
- Tailwind CSS for styling
- Framer Motion for animations
- Recharts for visualizations

### Backend
- Python 3.11+ with FastAPI
- SQLAlchemy with async PostgreSQL
- Redis for caching
- Celery for background tasks

## Project Structure

```
pulsarconsole/
├── src/                    # React frontend
│   ├── api/               # API client and hooks
│   ├── components/        # Reusable UI components
│   ├── pages/             # Page components
│   └── context/           # React context providers
├── backend/               # Python FastAPI backend
│   ├── app/
│   │   ├── api/          # REST API endpoints
│   │   ├── services/     # Business logic
│   │   ├── models/       # Database models
│   │   └── worker/       # Celery tasks
│   └── alembic/          # Database migrations
├── docker-compose.yml     # Development setup
└── docker-compose.prod.yml # Production setup
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Apache Pulsar](https://pulsar.apache.org/) — The distributed messaging platform
- [Lucide Icons](https://lucide.dev/) — Beautiful open source icons
