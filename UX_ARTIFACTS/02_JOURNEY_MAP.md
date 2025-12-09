# Customer Journey Map: PortfolioPath

## Scenario 1: Marcus on the BART Commute

### 🎬 The Complete Journey

---

### Phase 1: THE TRIGGER ⚡
**When:** Monday morning, 8:15 AM  
**Where:** BART train, underground between stations  
**Context:** Marcus is reading a Reddit thread about 60/40 vs 80/20 portfolios. He wants to test it right now.

**Marcus's Thoughts:**  
💭 *"I wonder if going 80/20 is worth the extra volatility... let me check"*

**Pain Point:**  
❌ Traditional web apps won't load underground  
❌ Most finance apps require login and take 10+ seconds to load  
❌ Can't access his Vanguard account to check allocation models  

**Emotional State:** 😐 Curious but skeptical the app will work

---

### Phase 2: THE ACTION 🎯
**Time:** 8:16 AM (1 minute later)  
**Action:** Marcus opens PortfolioPath PWA from his home screen

**What Happens:**
1. **Instant Load** ⚡ - App opens in <1 second (cached)
2. **No Login Required** 🚫🔐 - Direct to input screen
3. **Sees Last Portfolio** 💾 - His previous 60/40 allocation is still there

**Marcus's Actions:**
```
Input Portfolio A (Current):
- SPY: 60%
- BND: 40%

Input Portfolio B (Aggressive):
- SPY: 80%
- BND: 20%

Time Horizon: 30 years
Initial: $100,000
```

**Emotional State:** 😊 Relieved it works underground

---

### Phase 3: THE PWA MOMENT ⭐ (Critical!)
**Time:** 8:17 AM  
**The Magic:** App works perfectly offline

**What Happens Behind the Scenes:**
1. ✅ **Service Worker serves cached app shell**
2. ✅ **IndexedDB loads previously fetched SPY/BND data** (last updated yesterday)
3. ✅ **Monte Carlo simulation runs CLIENT-SIDE** (no backend needed)
4. ✅ **Real-time progress bar** shows calculation (1000 simulations)
5. ✅ **Results display in 3 seconds**

**Marcus Sees:**
```
📊 Portfolio A (60/40):
Expected Return: 8.2% annually
Median Final Value: $987,000
95th Percentile: $1.2M
5th Percentile: $812,000

📊 Portfolio B (80/20):
Expected Return: 9.5% annually
Median Final Value: $1,142,000
95th Percentile: $1.6M
5th Percentile: $684,000
```

**Visual Feedback:**
- 📈 Distribution charts show both portfolios overlaid
- 🎨 Color-coded risk zones (green = good outcomes, red = worst 5%)
- 📉 Sample paths show potential trajectories

**Marcus's Realization:**  
💡 *"Wow, the 80/20 portfolio has way wider tails... the worst case is $130k worse, but the best case is $400k better. That extra 1.3% return comes with real risk."*

**Emotional State:** 🤯 Impressed and informed

---

### Phase 4: THE DEEP DIVE 🔍
**Time:** 8:19 AM (train still underground)  
**Action:** Marcus adjusts assumptions

**He Experiments:**
- Adds recession scenario (-30% to returns)
- Enables fat-tail modeling (kurtosis)
- Tests with monthly contributions ($1,000/month)

**PWA Magic:**
- ✅ All calculations still work offline
- ✅ Charts update in real-time
- ✅ Results save automatically to localStorage

**Emotional State:** 🤓 Engaged and learning

---

### Phase 5: THE RESULT ✨
**Time:** 8:23 AM (train emerges above ground)  
**Outcome:** Marcus has made a decision

**What Marcus Does:**
1. **Screenshots** the comparison chart
2. **Saves** both portfolios with names ("Conservative" and "Aggressive")
3. **Shares** screenshot to his investment group chat
4. **Plans** to gradually shift to 70/30 (compromise)

**Marcus's Reflection:**  
💬 *"I just ran professional-grade portfolio analysis on a train with no signal. This would have cost me $50/month elsewhere."*

**Emotional State:** 😄 Satisfied and confident

**Long-Term Impact:**
- ✅ Trusts the app for future decisions
- ✅ Recommends it to friends
- ✅ Uses it as his primary portfolio modeling tool
- ✅ Values offline capability for travel

---

## Scenario 2: Rachel's Client Meeting

### Phase 1: THE TRIGGER ⚡
**When:** Wednesday, 3:00 PM  
**Where:** Client's home (retired couple, ages 62 & 64)  
**Context:** Discussing retirement portfolio strategy, client WiFi password isn't working

**Rachel's Thoughts:**  
💭 *"Oh no, their WiFi is down... please let this work offline"*

**Pain Point:**  
❌ Enterprise software requires internet  
❌ Client meetings get awkward with technical issues  
❌ Can't demonstrate risk vs. return without visuals  

**Emotional State:** 😰 Slightly worried

---

### Phase 2: THE PWA MOMENT ⭐
**Time:** 3:02 PM  
**Action:** Rachel opens PortfolioPath on her iPad

**What Happens:**
1. ✅ **App loads instantly** despite no WiFi
2. ✅ **Loads pre-saved client portfolio** from last week
3. ✅ **Professional dark theme** looks polished on iPad

**Rachel's Demo:**
```
Client's Current Portfolio:
- 50% Stocks (VTI)
- 30% Bonds (BND)
- 20% Cash

Proposed Retirement Portfolio:
- 40% Stocks
- 50% Bonds
- 10% Cash
```

**The Visualization:**
- 📊 Side-by-side distribution charts
- 📈 20-year projection paths
- 🎯 Probability of reaching $1.5M goal: 73% vs 64%

**Client's Reaction:**  
👵 *"Oh, I can actually SEE the difference! The first one has more variation but higher upside."*

**Emotional State:** 😌 Professional and prepared

---

### Phase 3: THE RESULT ✨
**Outcome:** Client trusts the recommendation

**What Happens:**
1. ✅ Client agrees to the proposed allocation
2. ✅ Rachel emails a screenshot of the analysis
3. ✅ Meeting feels professional despite WiFi issues
4. ✅ Rachel looks prepared and tech-savvy

**Rachel's Reflection:**  
💬 *"The app saved my presentation. Clients trust visual evidence, and it worked flawlessly offline."*

**Business Impact:**
- ✅ Client signs on for ongoing advisory services
- ✅ Rachel uses PortfolioPath for all future client meetings
- ✅ Recommends app to advisor network

---

## Journey Insights: Key Touchpoints

### 🎯 Critical Success Factors

| Touchpoint | User Need | PWA Solution | Emotional Impact |
|------------|-----------|--------------|------------------|
| **Discovery** | Find the app | PWA installable from browser | 😊 Easy |
| **First Load** | Fast startup | Service worker caches app | 😃 Impressed |
| **Offline Use** | Works without internet | IndexedDB + client-side compute | 🤯 Amazed |
| **Data Input** | Quick entry | Autofill, validation, clear UI | 😌 Smooth |
| **Simulation** | See results fast | Web Workers for performance | 😊 Satisfied |
| **Visualization** | Understand risk | Interactive charts | 💡 Enlightened |
| **Save/Share** | Keep results | LocalStorage + screenshots | ✅ Convenient |

---

## User Emotions Over Time

```
Emotional Journey Arc:

Initial State:     😐 Skeptical
↓ (App loads instantly)
First Impression:  😊 Pleasant surprise
↓ (Works offline)
PWA Moment:        🤯 Amazed
↓ (Sees results)
Understanding:     💡 Enlightened
↓ (Makes decision)
Final State:       😄 Satisfied & Confident
```

---

## Pain Points Eliminated

### ❌ Before PortfolioPath:
- Wait for slow web apps to load
- Can't work offline
- Pay expensive subscriptions
- Complex, overwhelming interfaces
- Generic, unrealistic assumptions

### ✅ After PortfolioPath:
- Instant load times (<1 second)
- Works anywhere, even underground
- Free, open-source tool
- Clean, focused interface
- Real market data (yfinance)

---

## The "Aha!" Moments

### For Marcus:
💡 **"This app just did what Bloomberg Terminal does, on my phone, underground, for free."**

### For Rachel:
💡 **"I can finally show clients visual proof of portfolio risk without worrying about WiFi."**

### Universal PWA Value:
⭐ **"It works when everything else fails."**
