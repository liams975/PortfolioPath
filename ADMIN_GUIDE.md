# PortfolioPath Admin Guide

## 🔍 Viewing Backend System

### 1. **API Documentation (Swagger UI)**
The easiest way to view and interact with the backend:

**URL**: http://localhost:8000/docs

**Features**:
- Interactive API documentation
- Test endpoints directly from browser
- View request/response schemas
- See all available endpoints

**Alternative**: http://localhost:8000/redoc (ReDoc format)

### 2. **Health Check Endpoints**

**Basic Health**:
```bash
curl http://localhost:8000/health
```

**Detailed Health**:
```bash
curl http://localhost:8000/api/health
```

**Response**:
```json
{
  "status": "healthy",
  "database": "connected",
  "version": "1.0.0"
}
```

### 3. **Database Access**

**SQLite Database Location**:
- `backend/portfoliopath.db` (development)

**View Database**:
```bash
# Using sqlite3 CLI
sqlite3 backend/portfoliopath.db

# View tables
.tables

# View users
SELECT * FROM users;

# View portfolios
SELECT * FROM portfolios;

# View portfolio holdings
SELECT * FROM portfolio_holdings;

# Exit
.exit
```

**Alternative - Use DB Browser for SQLite**:
- Download: https://sqlitebrowser.org/
- Open `backend/portfoliopath.db`

### 4. **Server Logs**

**Log File Location**:
- `backend/server.log`

**View Logs**:
```bash
# View all logs
cat backend/server.log

# Follow logs in real-time
tail -f backend/server.log

# View last 50 lines
tail -n 50 backend/server.log

# Search for errors
grep ERROR backend/server.log
```

**Console Logs**:
- When running with `uvicorn`, logs appear in the terminal
- Check the terminal where you started the server

### 5. **Backend Status Check**

**Check if Backend is Running**:
```bash
# Check process
ps aux | grep uvicorn

# Check if port 8000 is listening
lsof -i :8000

# Or use netstat
netstat -an | grep 8000
```

**Test Backend Connectivity**:
```bash
# Test root endpoint
curl http://localhost:8000/

# Test health endpoint
curl http://localhost:8000/health

# Test API health endpoint
curl http://localhost:8000/api/health
```

### 6. **Environment Variables**

**View Current Configuration**:
```bash
# View .env file (if exists)
cat backend/.env

# Check environment variables
cd backend
source venv/bin/activate
python -c "from app.config import settings; print(settings)"
```

### 7. **Database Statistics**

**Get User Count**:
```bash
sqlite3 backend/portfoliopath.db "SELECT COUNT(*) FROM users;"
```

**Get Portfolio Count**:
```bash
sqlite3 backend/portfoliopath.db "SELECT COUNT(*) FROM portfolios;"
```

**Get Recent Activity**:
```bash
sqlite3 backend/portfoliopath.db "SELECT * FROM users ORDER BY created_at DESC LIMIT 10;"
```

### 8. **API Testing with curl**

**Test Authentication**:
```bash
# Register user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","username":"admin","password":"Test1234"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Test1234"}'

# Get current user (replace TOKEN with actual token)
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

**Test Stock Data**:
```bash
# Get stock quote
curl http://localhost:8000/api/stocks/quote/AAPL

# Get batch quotes
curl -X POST http://localhost:8000/api/stocks/batch \
  -H "Content-Type: application/json" \
  -d '{"tickers":["AAPL","MSFT"]}'
```

**Test Portfolios**:
```bash
# List portfolios (requires auth token)
curl http://localhost:8000/api/portfolios \
  -H "Authorization: Bearer TOKEN"
```

### 9. **Monitoring & Debugging**

**Enable Debug Mode**:
Set in `backend/.env`:
```
DEBUG=true
LOG_LEVEL=DEBUG
```

**View SQL Queries**:
When `DEBUG=true`, SQLAlchemy will log all queries to console/logs.

**Check CORS Configuration**:
```bash
curl -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS \
  http://localhost:8000/api/stocks/quote/AAPL \
  -v
```

### 10. **Common Admin Tasks**

**Reset Database** (⚠️ Deletes all data):
```python
# In Python shell
from app.database import drop_tables, create_tables
import asyncio

asyncio.run(drop_tables())
asyncio.run(create_tables())
```

**Create Admin User**:
```python
# In Python shell
from app.services.auth_service import AuthService
from app.database import get_db
import asyncio

async def create_admin():
    async for db in get_db():
        user = await AuthService.create_user(
            db=db,
            email="admin@portfoliopath.com",
            username="admin",
            password="Admin1234!",
            full_name="Admin User"
        )
        print(f"Admin user created: {user.email}")
        break

asyncio.run(create_admin())
```

**View All Users**:
```bash
sqlite3 backend/portfoliopath.db "SELECT id, email, username, is_active, created_at FROM users;"
```

**View All Portfolios**:
```bash
sqlite3 backend/portfoliopath.db "SELECT id, name, owner_id, initial_investment, created_at FROM portfolios;"
```

### 11. **Performance Monitoring**

**Check API Response Times**:
```bash
# Time API calls
time curl http://localhost:8000/api/stocks/quote/AAPL
```

**Monitor Database Size**:
```bash
ls -lh backend/portfoliopath.db
```

**Check Memory Usage**:
```bash
ps aux | grep uvicorn | awk '{print $6/1024 " MB"}'
```

### 12. **Troubleshooting**

**Backend Won't Start**:
1. Check if port 8000 is already in use: `lsof -i :8000`
2. Check Python version: `python --version` (needs 3.8+)
3. Check dependencies: `pip list` in venv
4. Check logs: `tail -f backend/server.log`

**Database Issues**:
1. Check database file exists: `ls -la backend/portfoliopath.db`
2. Check file permissions: `chmod 644 backend/portfoliopath.db`
3. Verify database integrity: `sqlite3 backend/portfoliopath.db "PRAGMA integrity_check;"`

**CORS Issues**:
1. Check `.env` file has correct `CORS_ORIGINS`
2. Verify frontend URL matches CORS config
3. Check browser console for CORS errors

**Connection Issues**:
1. Verify backend is running: `curl http://localhost:8000/health`
2. Check firewall settings
3. Verify frontend is calling correct URL (check browser Network tab)

## 🚀 Quick Admin Commands

```bash
# Start backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# View logs
tail -f backend/server.log

# Check health
curl http://localhost:8000/api/health

# View database
sqlite3 backend/portfoliopath.db

# Open API docs
open http://localhost:8000/docs
```

## 📊 Admin Dashboard (Future Enhancement)

For production, consider adding:
- Admin dashboard at `/admin`
- User management interface
- Database statistics dashboard
- API usage metrics
- Error log viewer

## 🔐 Security Notes

- Never commit `.env` file to git
- Use strong `SECRET_KEY` in production
- Regularly backup database
- Monitor logs for suspicious activity
- Use HTTPS in production
- Implement rate limiting for production

