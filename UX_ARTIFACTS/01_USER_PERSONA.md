# User Persona: PortfolioPath

## Persona 1: "DIY Investor Marcus"

### 📸 Profile
**Name:** Marcus Chen  
**Age:** 34  
**Occupation:** Software Engineer  
**Location:** San Francisco, CA  
**Tech Savviness:** High  
**Investment Experience:** Intermediate (3-5 years)

### 📝 Bio/Context
Marcus is a mid-career software engineer who actively manages his own retirement accounts. He's comfortable with technology but finds traditional financial planning tools either too expensive (requiring subscriptions) or too simplistic (basic calculators). He often researches investment strategies during his commute on BART, where internet connectivity is unreliable. He wants to understand the long-term implications of his portfolio choices but doesn't want to pay $50/month for professional software.

### 🎯 Goals
1. **Model Different Scenarios:** "I want to see how different asset allocations perform over 10-30 years"
2. **Understand Risk:** "I need to visualize worst-case scenarios, not just average returns"
3. **Quick Experimentation:** "I want to test ideas quickly without waiting for pages to load"
4. **Data-Driven Decisions:** "I need real market data, not generic assumptions"
5. **Access Anywhere:** "I want to analyze portfolios on my commute, even without signal"

### 😤 Frustrations
1. **Expensive Tools:** "Bloomberg Terminal is $2,000/month, and consumer tools with Monte Carlo cost $30-50/month"
2. **Internet Dependency:** "Most financial apps are useless in the subway or on flights"
3. **Slow Performance:** "Running simulations takes forever on web apps"
4. **Lack of Transparency:** "Most tools don't show me the actual math or let me adjust assumptions"
5. **Poor Visualization:** "Static charts don't help me understand the distribution of outcomes"

### 💡 Quote
> "I don't need a financial advisor to tell me what to do—I need tools that show me the math so I can decide for myself."

### 📱 Devices Used
- **Primary:** MacBook Pro (personal projects at home)
- **Secondary:** iPhone 14 Pro (commute, casual browsing)
- **Context:** Often uses apps in low-connectivity environments (subway, flights, coffee shops with slow WiFi)

### 🎓 Technical Knowledge
- Understands basic portfolio theory (diversification, risk/return tradeoff)
- Familiar with terms like "Monte Carlo simulation," "volatility," "Sharpe ratio"
- Reads investment blogs and Reddit r/investing regularly
- Comfortable with spreadsheets but wants something more interactive

---

## Persona 2: "Financial Advisor Rachel"

### 📸 Profile
**Name:** Rachel Martinez  
**Age:** 42  
**Occupation:** Independent Financial Advisor (CFP)  
**Location:** Austin, TX  
**Tech Savviness:** Moderate  
**Investment Experience:** Expert (15+ years)

### 📝 Bio/Context
Rachel runs her own financial planning practice with 50+ clients. She's frustrated with expensive enterprise software that requires internet connectivity and takes time to load during client meetings. She often meets clients at their homes or offices where WiFi may be unreliable. She needs a tool that works instantly, looks professional, and helps clients visualize retirement outcomes without paying thousands per year for software licenses.

### 🎯 Goals
1. **Client Education:** "I need to show clients what risk actually looks like, not just tell them"
2. **Professional Presentation:** "The tool needs to look polished during client meetings"
3. **Offline Reliability:** "I can't have an app freeze during a presentation because WiFi drops"
4. **Quick Comparisons:** "I need to compare multiple portfolio strategies side-by-side"
5. **Save Client Scenarios:** "I want to save portfolio models for each client"

### 😤 Frustrations
1. **Enterprise Software Costs:** "I pay $3,000/year for eMoney, and it's overkill for Monte Carlo"
2. **Internet Dependency:** "Client meetings get awkward when the app won't load"
3. **Complexity Overload:** "Most tools have 100 features I don't need"
4. **Poor Mobile Experience:** "I can't show portfolio projections on my iPad without issues"
5. **Generic Assumptions:** "Cookie-cutter tools don't use real market data"

### 💡 Quote
> "When I'm sitting with a 60-year-old couple planning retirement, I need tools that work flawlessly and explain risk visually—not spreadsheets."

### 📱 Devices Used
- **Primary:** iPad Pro (client meetings, presentations)
- **Secondary:** MacBook Air (office work)
- **Context:** Client homes, offices, coffee shops—connectivity varies

### 🎓 Technical Knowledge
- Expert in portfolio theory, risk management, retirement planning
- Understands Monte Carlo methodology, standard deviation, percentiles
- Less comfortable with technical implementation details
- Wants tools that "just work" without configuration

---

## Design Implications

### For Marcus (DIY Investor):
- **Dark mode by default** (developer preference)
- **Advanced options visible** (GARCH, regime switching, jump diffusion)
- **Keyboard shortcuts** for power users
- **Export/download data** for further analysis
- **Technical documentation** explaining methodology

### For Rachel (Financial Advisor):
- **Clean, professional UI** (client-facing)
- **Simple mode by default** (hide advanced features)
- **Large, clear charts** for presentations
- **Save/load portfolios** for different clients
- **Print-friendly reports**

### Universal Needs:
✅ **Offline-first:** App must work without internet  
✅ **Fast performance:** Simulations in seconds, not minutes  
✅ **Real data:** Use actual market data (yfinance)  
✅ **Visual clarity:** Charts that explain risk intuitively  
✅ **No subscription:** Free or one-time purchase  
✅ **Mobile responsive:** Works on phones, tablets, desktops
