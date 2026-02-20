Stock Market Analysis Dashboard fyp:

An advanced interactive stock analysis dashboard built using *Python*, *Streamlit*, and *Machine Learning*. This tool enables users to visualize historical stock performance, apply technical indicators, predict future prices using *LSTM models*, and evaluate news sentiment using *Transformer-based NLP models*.

---

Features:

| Module                     | Description                                                                 |
|---------------------------|-----------------------------------------------------------------------------|
| 📈 **Live Stock Data**     | Fetches real-time historical stock data from Yahoo Finance.                |
| 🧮 **Technical Indicators**| Calculates SMA, Bollinger Bands, RSI, and MACD indicators.                 |
| 🔮 **LSTM Forecasting**     | Loads pretrained model to predict future stock prices and visualize trends.|
| 📰 **News Sentiment (NLP)**| Uses HuggingFace transformer to analyze sentiment of recent news articles. |
| 🔁 **Monte Carlo Simulation** | Simulates price movement scenarios to analyze volatility and risk.        |
| 🎨 **Interactive Charts**  | Beautiful and intuitive charts using Plotly for all indicators and forecasts.|

---

 Technologies Used:

- `Python 3.9+`
- `Streamlit`
- `yfinance`
- `Plotly`
- `Pandas`, `NumPy`
- `Keras` / `TensorFlow` (for LSTM)
- `scikit-learn` (for scaling)
- `HuggingFace Transformers` (for NLP sentiment)
- `NewsData.io` API

---

preview:

| Chart Types        | Description                          
| ------------------ | ------------------------------------ 
| 📊 Moving Averages | Ribbon-style SMA20 & SMA50           
| 📉 Bollinger Bands | Range-based price visualization      
| 🔁 MACD & RSI      | Momentum indicators                  
| 🔮 LSTM Forecast   | Actual vs Predicted + Forecast       
| 📰 Sentiment       | Transformer-based polarity from news 
| 📈 Monte Carlo     | Simulated 30-day price paths         






APIs Used:

Yahoo Finance API (via yfinance) for historical prices

NewsData.io API for fetching latest financial news

HuggingFace Transformers for zero-shot sentiment classification





 Use Cases:

📈 Investors exploring technical patterns

📉 Traders predicting short-term market movement

🤖 AI Students showcasing NLP + Time Series skills

