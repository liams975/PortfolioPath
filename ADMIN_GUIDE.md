# Admin Guide - PortfolioPath

## Quick Reference

### Starting the Application

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate  # or: . venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd PortfolioPath/portfolio-app
npm run dev
```

### URLs
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## Environment Configuration

### Backend (.env file in /backend)

```env
# Database
DATABASE_URL=sqlite+aiosqlite:///./portfoliopath.db

# JWT Authentication
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@portfoliopath.com

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env file in /PortfolioPath/portfolio-app)

```env
VITE_API_URL=http://localhost:8000
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

---

## Database Management

### SQLite Location
```
/backend/portfoliopath.db
```

### View Database Contents
```bash
cd backend
sqlite3 portfoliopath.db

# List tables
.tables

# View users
SELECT id, email, name, is_verified FROM users;

# View portfolios
SELECT * FROM portfolios;

# Exit
.quit
```

### Reset Database
```bash
cd backend
rm portfoliopath.db
# Restart backend to recreate tables
```

---

## User Management

### Manually Verify a User
```sql
UPDATE users SET is_verified = 1 WHERE email = 'user@example.com';
```

### Check User Status
```bash
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Generate Test Token
```python
# In Python shell
from app.services.auth_service import create_access_token
token = create_access_token({"sub": "user@example.com"})
print(token)
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Get JWT token |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/auth/verify-email?token=` | Verify email |
| POST | `/api/auth/resend-verification` | Resend verification email |

### Portfolios
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/portfolios` | List user portfolios |
| POST | `/api/portfolios` | Save new portfolio |
| PUT | `/api/portfolios/{id}` | Update portfolio |
| DELETE | `/api/portfolios/{id}` | Delete portfolio |

### Simulation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/simulation/run` | Run Monte Carlo simulation |

### Stocks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stocks/quote/{ticker}` | Get stock quote |
| GET | `/api/stocks/search?q=` | Search tickers |
| GET | `/api/stocks/history/{ticker}` | Get price history |

---

## Common Issues & Solutions

### Backend won't start
```bash
# Check if port is in use
lsof -ti:8000 | xargs kill -9

# Reinstall dependencies
cd backend
pip install -r requirements.txt
```

### Frontend build fails
```bash
cd PortfolioPath/portfolio-app
rm -rf node_modules
npm install
npm run dev
```

### CORS errors
Ensure backend CORS is configured:
```python
# In app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Email not sending
1. Check SMTP credentials in .env
2. For Gmail: Enable "App Passwords" in Google Account
3. Check spam folder
4. Verify SMTP_HOST and SMTP_PORT

---

## Deployment Checklist

### Pre-deployment
- [ ] Update SECRET_KEY to strong random value
- [ ] Configure production database (PostgreSQL recommended)
- [ ] Set up production email service
- [ ] Configure Stripe production keys
- [ ] Update FRONTEND_URL to production domain
- [ ] Enable HTTPS

### Backend (Railway/Render/Heroku)
```bash
# Procfile
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Frontend (Vercel/Netlify)
```bash
# Build command
npm run build

# Output directory
dist
```

---

## Monitoring

### Check Backend Health
```bash
curl http://localhost:8000/health
```

### View Logs
```bash
# Backend logs are in terminal running uvicorn
# For production, configure logging to file/service
```

### Performance Metrics
- Simulation time: ~2-5 seconds for 1000 simulations
- API response time: <100ms for most endpoints
- Frontend bundle size: ~1.2MB (consider code splitting)

---

## Security Notes

1. **Never commit .env files** - Use environment variables
2. **JWT tokens expire** - Default 30 minutes
3. **Password hashing** - bcrypt with automatic salting
4. **SQL injection protected** - Using SQLAlchemy ORM
5. **XSS protected** - React escapes by default
6. **CORS configured** - Only allow specific origins in production

---

*Last Updated: December 2024*
