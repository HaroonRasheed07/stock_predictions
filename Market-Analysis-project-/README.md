<<<<<<< HEAD
# Ai driven Market

**Real-time Market Intelligence & Predictive Analytics Dashboard**

A professional-grade analytics platform for stocks, cryptocurrency, and e-commerce with AI-powered forecasting, sentiment analysis, and technical indicators.



## 🚀 Features

### 📊 Stock Market Analytics
- **Real-time Data**: Live market data with automatic updates every 10 seconds
- **Technical Analysis**: Advanced charting with candlestick patterns, RSI, MACD, and Bollinger Bands
- **Sentiment Analysis**: Real-time sentiment tracking from news and social media
- **Price Forecasting**: AI-powered predictions using LSTM and Prophet models with confidence intervals

### 🎨 Design & UX
- **Modern UI**: Glassmorphism effects, gradient accents, and smooth animations
- **Responsive Design**: Mobile-first approach with optimized layouts for all screen sizes
- **Page Transitions**: Smooth Framer Motion animations between routes
- **Loading States**: Skeleton loaders for better perceived performance

### 🛠 Technology Stack

**Frontend:**
- React 18 + TypeScript
- TailwindCSS (utility-first styling)
- shadcn/ui (beautiful components)
- Framer Motion (animations)
- Recharts (data visualization)

**State & Data:**
- TanStack React Query (data fetching & caching)
- Zustand (global state management)
- React Router v6 (routing)

**API & Data:**
- Axios (HTTP client)
- Mock data with realistic simulation
- Real-time price updates

## 📁 Project Structure

```
src/
├── components/
│   ├── common/          # Reusable components (LoadingSkeleton, etc.)
│   ├── layout/          # Layout components (Navbar, Footer, RootLayout)
│   └── ui/              # shadcn/ui components
├── pages/
│   ├── markets/
│   │   ├── stock/       # Stock market pages (Overview, Technical, Sentiment, Forecasting)
│   │   └── MarketsLayout.tsx
│   ├── Home.tsx
│   ├── About.tsx
│   ├── Analysis.tsx
│   └── NotFound.tsx
├── lib/
│   ├── mockData.ts      # Mock data generators
│   ├── api.ts           # API utilities
│   └── utils.ts         # Utility functions
├── store/
│   └── themeStore.ts    # Zustand theme store
├── App.tsx
├── main.tsx
└── index.css            # Design system & custom styles
```

## 🎨 Design System

**Color Palette:**
- Primary: `#6366f1` (Indigo)
- Secondary: `#8b5cf6` (Violet)
- Success: `#10b981` (Emerald)
- Destructive: `#ef4444` (Red)

**Typography:**
- Font Family: Inter (Google Fonts)
- Weights: 300-900

**Spacing & Effects:**
- Glass morphism cards with backdrop blur
- Custom gradients and glow effects
- Smooth transitions and micro-animations

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd insightforge

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:8080`

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build
npm run preview
```

## 📊 Available Routes

| Route | Description |
|-------|-------------|
| `/` | Home page with hero, features, and live ticker |
| `/markets/stock` | Stock market overview with key metrics |
| `/markets/stock/technical` | Technical analysis with candlestick charts |
| `/markets/stock/sentiment` | Sentiment analysis from news and social media |
| `/markets/stock/forecast` | AI-powered price forecasting |
| `/analysis` | Analysis tools overview |
| `/about` | About page with mission and technology stack |

## 🎯 Key Features Implemented

✅ Complete design system with HSL colors and semantic tokens  
✅ Dark/light mode with persistent storage  
✅ Responsive navigation with mobile menu  
✅ Stock market overview dashboard  
✅ Technical analysis with multiple indicators  
✅ Sentiment analysis with charts  
✅ Price forecasting with LSTM/Prophet models  
✅ Real-time price ticker simulation  
✅ Loading skeletons for all data fetches  
✅ Smooth page transitions  
✅ SEO-optimized meta tags  

## 🔜 Coming Soon

- Cryptocurrency market section
- E-commerce analytics
- Portfolio optimizer
- Risk calculator
- Backtesting engine
- User authentication
- Saved watchlists
- Custom alerts

## 🤝 Contributing

This project is built with Lovable. To contribute:

2. Make changes via prompts or code editor
3. Changes are automatically committed to the repository

## 📝 License

This project is for demonstration purposes.

## 🔗 Links

- **Live Demo**: [Your deployment URL]

- **Documentation**: See `/docs` folder

---

=======
# FYP
this project about stock and crypto in which decision making become more strong by adding future price predicton using ai and news sentiments 
>>>>>>> b78be9bbe01404696e6329bda83d5e2f4a983a8b
