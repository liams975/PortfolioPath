# PortfolioPath

Advanced Monte Carlo portfolio simulation tool for retail investors.

**Live App:** https://portfoliopath-f9197.web.app  
**API Docs:** https://portfoliopath-production.up.railway.app/docs

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### URLs (Local)
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Project Structure

```
PortfolioPath/
├── README.md           # This file
├── PITCH.md            # Sales pitch & strategy
├── frontend/           # React + Vite app
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── context/        # React context providers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API client
│   │   ├── utils/          # Utility functions
│   │   ├── constants/      # App constants
│   │   └── workers/        # Web workers
│   └── ...
├── backend/            # Python FastAPI
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── models/         # Database models
│   │   └── services/       # Business logic
│   └── ...
└── docs/               # Documentation
```

---

## Environment Variables

### Backend (`backend/.env`)
```env
DATABASE_URL=sqlite+aiosqlite:///./portfoliopath.db
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:8000
```

---

## Deployment

### Backend (Railway)
- Automatically deploys from `main` branch
- Uses `railway.toml` configuration

### Frontend (Firebase)
```bash
cd frontend
npm run build
firebase deploy --only hosting
```

---

## Features

- **Monte Carlo Simulation** - GARCH, regime switching, fat tails, jump diffusion
- **Portfolio Comparison** - Side-by-side analysis
- **Risk Metrics** - VaR, Sharpe ratio, max drawdown
- **Goal Probability** - Probability of reaching target amount
- **Stress Testing** - Historical crisis scenarios
- **Real Market Data** - Live Yahoo Finance integration
- **Export** - CSV and PDF reports

---

## License

MIT
