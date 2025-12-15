# PortfolioPath - Application Flow Chart & User Journey Map

---

## SECTION 1: APPLICATION FLOW CHART

### Flow Chart Legend
| Shape | Meaning | Color |
|-------|---------|-------|
| ⬭ Oval | Start / End | Green |
| ▭ Rectangle | Action / Process | Blue |
| ◇ Diamond | Decision | Amber |
| ▱ Parallelogram | Input / Output | Purple |

---

### Complete Application Flow

```
                            ⬭ START
                         User Opens App
                              │
                              ▼
                    ◇ First-Time User?
                     ╱              ╲
                  YES                NO
                   │                  │
                   ▼                  ▼
        ▭ Display Onboarding    ▭ Load Saved State
           Tutorial                from LocalStorage
                   │                  │
                   └────────┬─────────┘
                            │
                            ▼
                ▭ Display Input View
              (Portfolio Configuration)
                            │
                            ▼
              ▱ User Enters Portfolio Data
              • Ticker symbols (SPY, QQQ)
              • Weight allocations (%)
              • Initial capital ($)
              • Time horizon (days)
                            │
                            ▼
                  ◇ Is Ticker Valid?
                   ╱              ╲
                 NO                YES
                  │                 │
                  ▼                 ▼
        ▱ OUTPUT: Error      ▭ Fetch Real Market
        "Ticker not found"      Data from API
        (Red highlight)             │
                  │                 │
                  └────────┬────────┘
                           │
                           ▼
              ◇ Do Weights Sum to 100%?
                   ╱              ╲
                 NO                YES
                  │                 │
                  ▼                 ▼
        ▱ OUTPUT: Warning    ▭ Enable "Run
        "Weights = 85%"      Simulation" Button
        (Red indicator)            │
                  │                │
                  └────────┬───────┘
                           │
                           ▼
              ▱ User Clicks "Run Simulation"
                           │
                           ▼
               ◇ Is User Authenticated?
                   ╱              ╲
                 NO                YES
                  │                 │
                  ▼                 ▼
        ▭ Guest Mode          ◇ Is User Pro?
        (Limited features)     ╱          ╲
                  │          NO            YES
                  │           │              │
                  │           ▼              │
                  │    ◇ Daily Limit         │
                  │    Reached (10)?         │
                  │     ╱        ╲           │
                  │   YES         NO         │
                  │    │           │          │
                  │    ▼           │          │
                  │  ▭ Show        │          │
                  │  Upgrade       │          │
                  │  Modal         │          │
                  │    │           │          │
                  └────┴───────────┴──────────┤
                                              │
                                              ▼
                              ◇ Backend Connected?
                                 ╱              ╲
                               NO                YES
                                │                 │
                                ▼                 ▼
                  ▭ Run Client-Side      ▭ Call Backend API
                  Monte Carlo            /api/simulation/run
                  (Cached Data)          (Real Yahoo Finance)
                                │                 │
                                └────────┬────────┘
                                         │
                                         ▼
                        ▭ Execute Monte Carlo Simulation
                        • 1,000-10,000 paths
                        • GARCH volatility
                        • Regime switching
                        • Fat tail distribution
                        • Calculate percentiles
                                         │
                                         ▼
                        ▭ Cache Results to LocalStorage
                                         │
                                         ▼
                        ▱ OUTPUT: Display Results
                        • Fan chart visualization
                        • Risk metrics (VaR, Sharpe)
                        • Goal probability %
                        • Max drawdown
                                         │
                                         ▼
                            ◇ User Action?
                    ╱        │        │        ╲
                Export     Save     New      Compare
                   │         │        │          │
                   ▼         ▼        ▼          ▼
              ▭ Generate  ▭ Save   ▭ Return   ▭ Enable
              PDF/CSV     to DB    to Input   Comparison
              Download            View        Mode
                   │         │        │          │
                   └─────────┴────────┴──────────┘
                                    │
                                    ▼
                                ⬭ END
                          Session Complete
                       (Data Persisted Locally)
```

---

### Sub-Flow: Ticker Validation Process

```
        ▱ User Types Ticker
                │
                ▼
        ▭ Debounce Input (500ms)
                │
                ▼
        ▭ Send to Validation API
                │
                ▼
        ◇ API Response?
         ╱            ╲
     SUCCESS         ERROR
        │               │
        ▼               ▼
▱ Show Green ✓    ▱ Show Red ✗
  + Stock Name      "Not Found"
  + Live Price
  + % Change
```

---

### Sub-Flow: Comparison Mode

```
        ▱ User Enables Comparison
                │
                ▼
        ▭ Display Second Portfolio Panel
                │
                ▼
        ▱ User Enters Portfolio B
                │
                ▼
        ◇ Both Portfolios Valid?
         ╱            ╲
       NO             YES
        │               │
        ▼               ▼
  ▱ Show Error    ▭ Run Parallel
                   Simulations
                        │
                        ▼
                ▱ OUTPUT: Side-by-Side
                  Results Comparison
```

---

## SECTION 2: USER JOURNEY MAP

### Persona
**Name:** Alex Chen  
**Age:** 34  
**Role:** Software Engineer  
**Goal:** Plan early retirement at age 50  

---

### User Journey Map Grid

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│                 │    AWARENESS    │  CONSIDERATION  │   ACQUISITION   │     SERVICE     │     LOYALTY     │
│                 │                 │                 │                 │                 │                 │
│                 │  Discovers the  │  Evaluates if   │  First-time     │  Regular usage  │  Long-term      │
│                 │  problem/need   │  app is right   │  use of app     │  of features    │  engagement     │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│                 │                 │                 │                 │                 │                 │
│  USER           │ • Reads article │ • Searches      │ • Opens app     │ • Runs multiple │ • Returns       │
│  ACTIONS        │   about         │   "Monte Carlo  │ • Skips tour    │   simulations   │   weekly        │
│                 │   sequence-of-  │   portfolio     │ • Selects       │ • Enables       │ • Upgrades to   │
│                 │   returns risk  │   simulator"    │   preset        │   advanced      │   Pro ($29.99)  │
│                 │ • Realizes      │ • Clicks on     │ • Enters own    │   models        │ • Saves 5+      │
│                 │   portfolio     │   PortfolioPath │   ticker        │ • Compares      │   portfolio     │
│                 │   isn't tested  │   in results    │   symbols       │   portfolios    │   scenarios     │
│                 │ • Opens Google  │ • Reads landing │ • Sets $180K    │ • Exports PDF   │ • Shares with   │
│                 │   to research   │   page          │   initial       │   for advisor   │   spouse        │
│                 │                 │ • Sees "Free    │ • Clicks "Run   │ • Tests stress  │ • Refers 3      │
│                 │                 │   to try"       │   Simulation"   │   scenarios     │   coworkers     │
│                 │                 │                 │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│                 │                 │                 │                 │                 │                 │
│  GOALS &        │ GOAL:           │ GOAL:           │ GOAL:           │ GOAL:           │ GOAL:           │
│  EXPERIENCES    │ Understand      │ Find a tool     │ Get first       │ Make informed   │ Integrate into  │
│                 │ retirement risk │ that's easy     │ probability     │ investment      │ financial       │
│                 │                 │ but powerful    │ result          │ decisions       │ routine         │
│                 │ EXPERIENCE:     │ EXPERIENCE:     │ EXPERIENCE:     │ EXPERIENCE:     │ EXPERIENCE:     │
│                 │ Reading         │ Browsing        │ Smooth          │ Data-driven     │ Confident       │
│                 │ financial       │ multiple tools, │ onboarding,     │ insights,       │ planning,       │
│                 │ blogs, feeling  │ comparing       │ instant         │ professional    │ sharing with    │
│                 │ overwhelmed     │ features        │ results         │ visualizations  │ others          │
│                 │                 │                 │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│                 │                 │                 │                 │                 │                 │
│  FEELINGS &     │ 😰 ANXIOUS      │ 🤔 CURIOUS      │ 😮 SURPRISED    │ 😌 CONFIDENT    │ 🎯 EMPOWERED    │
│  THOUGHTS       │                 │                 │                 │                 │                 │
│                 │ "What if the    │ "This looks     │ "Wow, it works  │ "73% chance of  │ "I finally      │
│                 │ market crashes  │ professional.   │ even offline!   │ hitting my      │ have control    │
│                 │ right when I    │ But is it       │ The simulation  │ goal. That's    │ over my         │
│                 │ retire? I have  │ actually        │ ran in 2        │ better than I   │ retirement.     │
│                 │ no idea what    │ accurate?"      │ seconds!"       │ expected."      │ This app is     │
│                 │ my odds are."   │                 │                 │                 │ essential."     │
│                 │                 │ "Free to try    │ "This is what   │ "I can see the  │                 │
│                 │ "Traditional    │ is good. I      │ the pros use.   │ worst case      │ "I should tell  │
│                 │ calculators     │ don't want to   │ I feel like a   │ clearly now."   │ my coworkers    │
│                 │ only show       │ pay before      │ real investor." │                 │ about this."    │
│                 │ averages."      │ testing."       │                 │                 │                 │
│                 │                 │                 │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│                 │                 │                 │                 │                 │                 │
│  OPPORTUNITIES  │ ✨ SEO content  │ ✨ Clear value  │ ✨ Onboarding   │ ✨ Pro upsell   │ ✨ Referral     │
│                 │ targeting       │ proposition     │ tutorial for    │ at natural      │ program with    │
│                 │ "retirement     │ on landing      │ first-time      │ friction point  │ rewards         │
│                 │ risk            │ page            │ users           │ (daily limit)   │                 │
│                 │ calculator"     │                 │                 │                 │ ✨ Community    │
│                 │                 │ ✨ Social proof │ ✨ Preset       │ ✨ PDF export   │ forum for       │
│                 │ ✨ Educational  │ (testimonials,  │ portfolios      │ for advisor     │ power users     │
│                 │ blog posts      │ user count)     │ reduce          │ meetings        │                 │
│                 │ about Monte     │                 │ friction        │                 │ ✨ Feature      │
│                 │ Carlo           │ ✨ "No signup   │                 │ ✨ Email        │ request         │
│                 │                 │ required"       │ ✨ Real-time    │ summary of      │ voting          │
│                 │                 │ messaging       │ ticker          │ portfolio       │                 │
│                 │                 │                 │ validation      │ performance     │                 │
│                 │                 │                 │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│                 │                 │                 │                 │                 │                 │
│  PAIN           │ 🔴 Existing     │ 🔴 Overwhelmed  │ 🔴 Unfamiliar   │ 🔴 Daily        │ 🔴 Feature      │
│  POINTS         │ tools are too   │ by options,     │ with ticker     │ simulation      │ requests not    │
│                 │ simple or too   │ hard to         │ symbols         │ limit (10/day)  │ implemented     │
│                 │ complex         │ compare tools   │                 │ feels           │ fast enough     │
│                 │                 │                 │ 🔴 Not sure     │ restrictive     │                 │
│                 │ 🔴 Most         │ 🔴 Skeptical    │ what models     │                 │ 🔴 No mobile    │
│                 │ calculators     │ of "free"       │ to enable       │ 🔴 Can't add    │ app (PWA        │
│                 │ don't show      │ tools - what's  │                 │ monthly         │ only)           │
│                 │ probability     │ the catch?      │ 🔴 Results      │ contributions   │                 │
│                 │ distributions   │                 │ feel abstract   │ to simulation   │ 🔴 No           │
│                 │                 │ 🔴 Worried      │ without         │                 │ integration     │
│                 │ 🔴 No way to    │ about data      │ context         │ 🔴 Comparison   │ with brokerage  │
│                 │ stress test     │ privacy         │                 │ mode requires   │ accounts        │
│                 │ without Excel   │                 │                 │ re-entering     │                 │
│                 │                 │                 │                 │ data            │                 │
│                 │                 │                 │                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

---

### Emotional Journey Curve

```
EMOTION
   │
 High │                                              ┌───────────────
      │                                         ╱    │   LOYALTY
      │                                    ╱         │   🎯 Empowered
      │                               ╱              │
      │                    ┌─────────                │
      │               ╱    │ SERVICE                 │
      │          ╱         │ 😌 Confident            │
      │     ╱              │                         │
      │ ┌──                │                         │
      │ │ ACQUISITION      │                         │
      │ │ 😮 Surprised     │                         │
Neutral├─┼─────────────────┼─────────────────────────┼──────────────▶ TIME
      │ │                  │                         │
      │ │ CONSIDERATION    │                         │
      │ │ 🤔 Curious       │                         │
      │╱                   │                         │
      │ AWARENESS          │                         │
  Low │ 😰 Anxious         │                         │
      │                    │                         │
      └────────────────────┴─────────────────────────┘
           Day 1           Week 1                   Month 1+
```

---

### Key Touchpoints by Phase

| Phase | Touchpoint | Channel | Emotion |
|-------|-----------|---------|---------|
| Awareness | Financial blog article | Organic Search | 😰 Anxious |
| Awareness | Reddit r/FinancialIndependence | Social | 😰 Anxious |
| Consideration | Google search results | Paid/Organic | 🤔 Curious |
| Consideration | Landing page | Website | 🤔 Curious |
| Acquisition | App first load | PWA | 😮 Surprised |
| Acquisition | First simulation | PWA | 😮 Surprised |
| Service | Results dashboard | PWA | 😌 Confident |
| Service | PDF export | PWA | 😌 Confident |
| Service | Pro upgrade modal | PWA | 💳 Considering |
| Loyalty | Saved portfolios | PWA | 🎯 Empowered |
| Loyalty | Share with friend | Word of mouth | 🎯 Empowered |

---

### PWA-Specific Journey Moment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ⚡ THE PWA MAGIC MOMENT                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SCENARIO: Alex is on subway, enters tunnel, loses cellular signal          │
│                                                                              │
│  ┌─────────────────────────┐     ┌─────────────────────────────────────┐    │
│  │   TRADITIONAL WEB APP   │     │      PORTFOLIOPATH PWA              │    │
│  ├─────────────────────────┤     ├─────────────────────────────────────┤    │
│  │                         │     │                                     │    │
│  │  ❌ "Network Error"     │     │  ✅ App continues working           │    │
│  │  ❌ Spinner forever     │     │  ✅ Cached market data used         │    │
│  │  ❌ User input lost     │     │  ✅ Monte Carlo runs client-side    │    │
│  │  ❌ Must start over     │     │  ✅ Results saved to LocalStorage   │    │
│  │                         │     │  ✅ Syncs when back online          │    │
│  │  😤 Frustrated          │     │  😮 "Wait, it still works?!"        │    │
│  │                         │     │                                     │    │
│  └─────────────────────────┘     └─────────────────────────────────────┘    │
│                                                                              │
│  USER THOUGHT: "This app just worked underground with no signal.            │
│                 That's incredible. I'm telling everyone about this."        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## SECTION 3: DECISION POINTS SUMMARY

### For Figma Diamond Shapes

| # | Decision | YES Path | NO Path |
|---|----------|----------|---------|
| 1 | Is ticker valid? | Fetch market data, show ✓ | Show error, red highlight |
| 2 | Weights = 100%? | Enable run button | Disable button, show warning |
| 3 | User authenticated? | Check Pro status | Guest mode (limited) |
| 4 | User is Pro? | Unlimited simulations | Check daily limit |
| 5 | Daily limit reached? | Show upgrade modal | Run simulation |
| 6 | Backend connected? | Use real API data | Use cached fallback |
| 7 | First-time user? | Show onboarding | Load saved state |
