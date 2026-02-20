# import streamlit as st
# import pandas as pd
# import yfinance as yf
# from indicators import calculate_indicators, plot_indicators
# from sentiment import show_sentiment_analysis
# from forecast import show_forecast
# from montecarlo import run_simulation
# from utils import load_data

# st.set_page_config(page_title="Stock Dashboard", layout="wide")

# # Sidebar Inputs
# st.sidebar.title("Dashboard Settings")
# ticker = st.sidebar.text_input("Ticker", "AAPL").upper()
# period = st.sidebar.selectbox("Period", ["1mo", "3mo", "6mo", "1y", "2y", "5y"], index=3)

# st.sidebar.markdown("### Show Components")
# show_sma = st.sidebar.checkbox("Moving Averages", True)
# show_rsi = st.sidebar.checkbox("RSI", True)
# show_macd = st.sidebar.checkbox("MACD", True)
# show_bollinger = st.sidebar.checkbox("Bollinger Bands", True)
# show_sentiment = st.sidebar.checkbox("Sentiment Analysis", True)
# show_lstm = st.sidebar.checkbox("LSTM Forecast", True)
# show_montecarlo = st.sidebar.checkbox("Monte Carlo Simulation", True)

# # Load Data
# df = load_data(ticker, period)
# if df is None:
#     st.stop()

# # Indicators
# df = calculate_indicators(df)
# st.title(f"{ticker} Stock Analysis")
# plot_indicators(df, show_sma, show_rsi, show_macd, show_bollinger)

# # Sentiment
# if show_sentiment:
#     show_sentiment_analysis(ticker)

# # LSTM Forecast
# if show_lstm:
#     show_forecast(df)

# # Monte Carlo
# if show_montecarlo:
#     run_simulation(df)




# import streamlit as st
# import pandas as pd
# from utils import load_data
# from indicators import calculate_indicators, plot_indicators
# from sentiment import show_sentiment_analysis
# from forecasr_multi import load_forecast_model, predict_and_forecast
# from montecarlo import run_simulation
# import plotly.graph_objects as go


# st.set_page_config(page_title="Stock Dashboard", layout="wide")

# st.sidebar.title("Dashboard Settings")
# ticker = st.sidebar.text_input("Stock Ticker", value="AAPL").upper()
# period = st.sidebar.selectbox("Time Period", ["1mo", "3mo", "6mo", "1y", "2y", "5y"], index=3)

# st.sidebar.subheader("Technical Indicators")
# show_sma = st.sidebar.checkbox("Moving Averages", True)
# show_bollinger = st.sidebar.checkbox("Bollinger Bands", True)
# show_rsi = st.sidebar.checkbox("RSI", True)
# show_macd = st.sidebar.checkbox("MACD", True)
# show_forecast = st.sidebar.checkbox("LSTM Forecast", True)
# show_sentiment = st.sidebar.checkbox("News Sentiment", True)
# show_montecarlo = st.sidebar.checkbox("Monte Carlo Simulation", True)

# data = load_data(ticker, period)
# if data is None:
#     st.stop()

# data = calculate_indicators(data)
# st.title(f"{ticker} Stock Analysis")
# col1, col2, col3, col4 = st.columns(4)
# with col1:
#     try:
#         price = float(data['Close'].iloc[-1])
#         st.metric("Current Price", f"${price:.2f}")
#     except:
#         st.metric("Current Price", "N/A")

# with col2:
#     try:
#         prev_price = float(data['Close'].iloc[-2])
#         change = price - prev_price
#         pct_change = (change / prev_price) * 100
#         st.metric("Daily Change", f"${change:.2f}", f"{pct_change:.2f}%")
#     except:
#         st.metric("Daily Change", "N/A")

# with col3:
#     try:
#         sma20 = float(data['SMA20'].iloc[-1])
#         st.metric("20-Day SMA", f"${sma20:.2f}")
#     except:
#         st.metric("20-Day SMA", "N/A")

# with col4:
#     try:
#         sma50 = float(data['SMA50'].iloc[-1])
#         st.metric("50-Day SMA", f"${sma50:.2f}")
#     except:
#         st.metric("50-Day SMA", "N/A")


# plot_indicators(data, show_sma, show_bollinger, show_rsi, show_macd)



# if show_sentiment:
#     show_sentiment_analysis(ticker)

# if show_forecast:
#   try:
#     model, scaler = load_forecast_model()
#     actual, predicted, forecast, forecast_dates = predict_and_forecast(data, model, scaler)

#     fig3 = go.Figure()
#     fig3.add_trace(go.Scatter(x=data.index[-len(actual):], y=actual, name='Actual', line=dict(color='gray')))
#     fig3.add_trace(go.Scatter(x=data.index[-len(predicted):], y=predicted, name='Predicted', line=dict(color='purple')))
#     fig3.add_trace(go.Scatter(x=forecast_dates, y=forecast, name='Forecast', line=dict(color='green')))
#     fig3.add_trace(go.Scatter(x=forecast_dates, y=forecast, name='Forecast Ribbon', line=dict(color='green'),
#                               fill='tonexty', fillcolor='rgba(0,255,0,0.2)', showlegend=False))
#     fig3.update_layout(title="LSTM Forecast (Ribbon-style + Actual vs Predicted)",
#                        xaxis_title="Date", yaxis_title="Price", template="plotly_white")
#     st.plotly_chart(fig3, use_container_width=True)

#   except Exception as e:
#     st.error(f"LSTM Forecast error: {str(e)}")

# if show_montecarlo:
#     run_simulation(data)


# import streamlit as st
# import pandas as pd
# import plotly.graph_objects as go

# from utils import load_data
# from indicators import calculate_indicators, plot_indicators
# from sentiment import show_sentiment_analysis
# from forecasr_multi import predict_and_forecast   # ✅ use new per-stock version
# from montecarlo import run_simulation

# # -------------------------------------------------
# # Dashboard Settings
# # -------------------------------------------------
# st.set_page_config(page_title="Stock Dashboard", layout="wide")

# st.sidebar.title("Dashboard Settings")
# ticker = st.sidebar.text_input("Stock Ticker", value="AAPL").upper()
# period = st.sidebar.selectbox("Time Period", ["1mo", "3mo", "6mo", "1y", "2y", "5y"], index=3)

# st.sidebar.subheader("Technical Indicators")
# show_sma = st.sidebar.checkbox("Moving Averages", True)
# show_bollinger = st.sidebar.checkbox("Bollinger Bands", True)
# show_rsi = st.sidebar.checkbox("RSI", True)
# show_macd = st.sidebar.checkbox("MACD", True)
# show_forecast = st.sidebar.checkbox("LSTM Forecast", True)
# show_sentiment = st.sidebar.checkbox("News Sentiment", True)
# show_montecarlo = st.sidebar.checkbox("Monte Carlo Simulation", True)

# # -------------------------------------------------
# # Load stock data
# # -------------------------------------------------
# data = load_data(ticker, period)
# if data is None or data.empty:
#     st.error("⚠️ No data available for this ticker.")
#     st.stop()

# # Calculate indicators
# data = calculate_indicators(data)

# # -------------------------------------------------
# # Metrics Row
# # -------------------------------------------------
# st.title(f"{ticker} Stock Analysis")

# col1, col2, col3, col4 = st.columns(4)

# with col1:
#     try:
#         price = float(data['Close'].iloc[-1])
#         st.metric("Current Price", f"${price:.2f}")
#     except:
#         st.metric("Current Price", "N/A")

# with col2:
#     try:
#         prev_price = float(data['Close'].iloc[-2])
#         change = price - prev_price
#         pct_change = (change / prev_price) * 100
#         st.metric("Daily Change", f"${change:.2f}", f"{pct_change:.2f}%")
#     except:
#         st.metric("Daily Change", "N/A")

# with col3:
#     try:
#         sma20 = float(data['SMA20'].iloc[-1])
#         st.metric("20-Day SMA", f"${sma20:.2f}")
#     except:
#         st.metric("20-Day SMA", "N/A")

# with col4:
#     try:
#         sma50 = float(data['SMA50'].iloc[-1])
#         st.metric("50-Day SMA", f"${sma50:.2f}")
#     except:
#         st.metric("50-Day SMA", "N/A")

# # -------------------------------------------------
# # Charts & Features
# # -------------------------------------------------
# plot_indicators(data, show_sma, show_bollinger, show_rsi, show_macd)

# if show_sentiment:
#     show_sentiment_analysis(ticker)

# if show_forecast:
#     try:
#         actual, predicted, forecast, forecast_dates = predict_and_forecast(
#             ticker, period=period, forecast_days=10
#         )

#         fig3 = go.Figure()
#         fig3.add_trace(go.Scatter(x=data.index[-len(actual):], y=actual,
#                                   name='Actual', line=dict(color='gray')))
#         fig3.add_trace(go.Scatter(x=data.index[-len(predicted):], y=predicted,
#                                   name='Predicted', line=dict(color='purple')))
#         fig3.add_trace(go.Scatter(x=forecast_dates, y=forecast,
#                                   name='Forecast', line=dict(color='green')))
#         fig3.add_trace(go.Scatter(x=forecast_dates, y=forecast,
#                                   name='Forecast Ribbon', line=dict(color='green'),
#                                   fill='tonexty', fillcolor='rgba(0,255,0,0.2)', showlegend=False))
#         fig3.update_layout(title=f"{ticker} - LSTM Forecast (10 Days Ahead)",
#                            xaxis_title="Date", yaxis_title="Price", template="plotly_white")
#         st.plotly_chart(fig3, use_container_width=True)

#     except Exception as e:
#         st.error(f"⚠️ LSTM Forecast error for {ticker}: {str(e)}")

# if show_montecarlo:
#     run_simulation(data)






# import streamlit as st
# import yfinance as yf
# import pandas as pd
# import numpy as np
# import plotly.graph_objects as go
# from forecasr_multi import load_forecast_model, predict_and_forecast
# from datetime import datetime, timedelta

# # ---------------------------
# # Utility functions
# # ---------------------------

# def load_data(ticker, period="1y"):
#     try:
#         df = yf.download(ticker, period=period, progress=False)
#         if df.empty:
#             return None
#         return df
#     except Exception as e:
#         st.error(f"Error fetching {ticker}: {e}")
#         return None


# def calculate_indicators(df):
#     df["SMA20"] = df["Close"].rolling(window=20).mean()
#     df["SMA50"] = df["Close"].rolling(window=50).mean()

#     # Bollinger Bands
#     df["MiddleBB"] = df["Close"].rolling(window=20).mean()
#     df["UpperBB"] = df["MiddleBB"] + 2 * df["Close"].rolling(window=20).std()
#     df["LowerBB"] = df["MiddleBB"] - 2 * df["Close"].rolling(window=20).std()

#     # RSI
#     delta = df["Close"].diff()
#     gain = np.where(delta > 0, delta, 0)
#     loss = np.where(delta < 0, -delta, 0)
#     avg_gain = pd.Series(gain).rolling(window=14).mean()
#     avg_loss = pd.Series(loss).rolling(window=14).mean()
#     rs = avg_gain / (avg_loss + 1e-9)
#     df["RSI"] = 100 - (100 / (1 + rs))

#     # MACD
#     exp1 = df["Close"].ewm(span=12, adjust=False).mean()
#     exp2 = df["Close"].ewm(span=26, adjust=False).mean()
#     df["MACD"] = exp1 - exp2
#     df["Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()

#     return df


# def plot_indicators(df, show_sma, show_bollinger, show_rsi, show_macd):
#     fig = go.Figure()

#     # Price
#     fig.add_trace(go.Scatter(x=df.index, y=df["Close"], name="Close", line=dict(color="blue")))

#     if show_sma:
#         fig.add_trace(go.Scatter(x=df.index, y=df["SMA20"], name="SMA20", line=dict(color="orange")))
#         fig.add_trace(go.Scatter(x=df.index, y=df["SMA50"], name="SMA50", line=dict(color="purple")))

#     if show_bollinger:
#         fig.add_trace(go.Scatter(x=df.index, y=df["UpperBB"], name="Upper BB", line=dict(color="green", dash="dot")))
#         fig.add_trace(go.Scatter(x=df.index, y=df["LowerBB"], name="Lower BB", line=dict(color="red", dash="dot")))

#     fig.update_layout(title="Stock Price & Indicators", xaxis_title="Date", yaxis_title="Price", template="plotly_white")
#     st.plotly_chart(fig, use_container_width=True)

#     # RSI Plot
#     if show_rsi:
#         fig2 = go.Figure()
#         fig2.add_trace(go.Scatter(x=df.index, y=df["RSI"], name="RSI", line=dict(color="brown")))
#         fig2.add_hline(y=70, line=dict(color="red", dash="dash"))
#         fig2.add_hline(y=30, line=dict(color="green", dash="dash"))
#         fig2.update_layout(title="RSI", xaxis_title="Date", yaxis_title="RSI", template="plotly_white")
#         st.plotly_chart(fig2, use_container_width=True)

#     # MACD Plot
#     if show_macd:
#         fig3 = go.Figure()
#         fig3.add_trace(go.Scatter(x=df.index, y=df["MACD"], name="MACD", line=dict(color="blue")))
#         fig3.add_trace(go.Scatter(x=df.index, y=df["Signal"], name="Signal", line=dict(color="orange")))
#         fig3.update_layout(title="MACD", xaxis_title="Date", yaxis_title="Value", template="plotly_white")
#         st.plotly_chart(fig3, use_container_width=True)


# # ---------------------------
# # Streamlit UI
# # ---------------------------

# st.set_page_config(page_title="Stock Dashboard", layout="wide")

# st.sidebar.title("Dashboard Settings")
# ticker = st.sidebar.text_input("Stock Ticker", value="AAPL").upper()
# period = st.sidebar.selectbox("Time Period", ["1mo", "3mo", "6mo", "1y", "2y", "5y"], index=3)

# st.sidebar.subheader("Technical Indicators")
# show_sma = st.sidebar.checkbox("Moving Averages", True)
# show_bollinger = st.sidebar.checkbox("Bollinger Bands", True)
# show_rsi = st.sidebar.checkbox("RSI", True)
# show_macd = st.sidebar.checkbox("MACD", True)
# show_forecast = st.sidebar.checkbox("LSTM Forecast", True)
# show_sentiment = st.sidebar.checkbox("News Sentiment", False)  # Placeholder
# show_montecarlo = st.sidebar.checkbox("Monte Carlo Simulation", False)  # Placeholder

# data = load_data(ticker, period)
# if data is None:
#     st.stop()

# data = calculate_indicators(data)
# st.title(f"{ticker} Stock Analysis")

# # KPIs
# col1, col2, col3, col4 = st.columns(4)
# with col1:
#     price = float(data["Close"].iloc[-1])
#     st.metric("Current Price", f"${price:.2f}")
# with col2:
#     prev_price = float(data["Close"].iloc[-2])
#     change = price - prev_price
#     pct_change = (change / prev_price) * 100
#     st.metric("Daily Change", f"${change:.2f}", f"{pct_change:.2f}%")
# with col3:
#     st.metric("20-Day SMA", f"${data['SMA20'].iloc[-1]:.2f}")
# with col4:
#     st.metric("50-Day SMA", f"${data['SMA50'].iloc[-1]:.2f}")

# # Plot indicators
# plot_indicators(data, show_sma, show_bollinger, show_rsi, show_macd)

# # Sentiment Placeholder
# if show_sentiment:
#     st.info("📊 Sentiment analysis coming soon...")

# # LSTM Forecast
# if show_forecast:
#     try:
#         model, scaler = load_forecast_model()
#         actual, predicted, forecast, forecast_dates = predict_and_forecast(data, model, scaler)

#         fig3 = go.Figure()
#         fig3.add_trace(go.Scatter(x=data.index[-len(actual):], y=actual, name="Actual", line=dict(color="gray")))
#         fig3.add_trace(go.Scatter(x=data.index[-len(predicted):], y=predicted, name="Predicted", line=dict(color="purple")))
#         fig3.add_trace(go.Scatter(x=forecast_dates, y=forecast, name="Forecast", line=dict(color="green")))
#         fig3.add_trace(go.Scatter(x=forecast_dates, y=forecast, name="Forecast Ribbon", line=dict(color="green"),
#                                   fill="tonexty", fillcolor="rgba(0,255,0,0.2)", showlegend=False))
#         fig3.update_layout(title="LSTM Forecast (Ribbon-style + Actual vs Predicted)",
#                            xaxis_title="Date", yaxis_title="Price", template="plotly_white")
#         st.plotly_chart(fig3, use_container_width=True)
#     except Exception as e:
#         st.error(f"LSTM Forecast error: {str(e)}")

# # Monte Carlo Placeholder
# if show_montecarlo:
#     st.info("🎲 Monte Carlo simulation coming soon...")






# import streamlit as st
# import yfinance as yf
# import pandas as pd
# import numpy as np
# import matplotlib.pyplot as plt
# from sklearn.preprocessing import MinMaxScaler
# from tensorflow.keras.models import Sequential, load_model
# from tensorflow.keras.layers import LSTM, Dense, Dropout
# import os

# st.set_page_config(page_title="Multi-Stock LSTM Forecast", layout="wide")

# # -------------------------------
# # CONFIG
# # -------------------------------
# TICKERS = ["AAPL", "MSFT", "GOOG", "AMZN", "META"]
# MODEL_DIR = "saved_models"
# os.makedirs(MODEL_DIR, exist_ok=True)

# # -------------------------------
# # Fetch stock data
# # -------------------------------
# @st.cache_data
# def load_data(ticker, start="2015-01-01"):
#     df = yf.download(ticker, start=start)
#     df.dropna(inplace=True)
#     return df

# # -------------------------------
# # Indicators per ticker
# # -------------------------------
# def calculate_indicators(df):
#     temp = df.copy()
#     temp["SMA20"] = temp["Close"].rolling(window=20).mean()
#     temp["SMA50"] = temp["Close"].rolling(window=50).mean()
#     temp["MiddleBB"] = temp["SMA20"]
#     temp["UpperBB"] = temp["MiddleBB"] + 2 * temp["Close"].rolling(window=20).std()
#     temp["LowerBB"] = temp["MiddleBB"] - 2 * temp["Close"].rolling(window=20).std()

#     # RSI
#     delta = temp["Close"].diff()
#     gain = np.where(delta > 0, delta, 0)
#     loss = np.where(delta < 0, -delta, 0)
#     avg_gain = pd.Series(gain).rolling(14).mean()
#     avg_loss = pd.Series(loss).rolling(14).mean()
#     rs = avg_gain / avg_loss
#     temp["RSI"] = 100 - (100 / (1 + rs))

#     return temp

# # -------------------------------
# # LSTM functions
# # -------------------------------
# def create_sequences(data, time_step=60):
#     X, y = [], []
#     for i in range(len(data) - time_step):
#         X.append(data[i:i + time_step, 0])
#         y.append(data[i + time_step, 0])
#     return np.array(X), np.array(y)

# def build_and_train_model(df, ticker):
#     close_prices = df["Close"].values.reshape(-1, 1)
#     scaler = MinMaxScaler(feature_range=(0, 1))
#     scaled_data = scaler.fit_transform(close_prices)

#     time_step = 60
#     X, y = create_sequences(scaled_data, time_step)
#     X = X.reshape(X.shape[0], X.shape[1], 1)

#     # Train/test split
#     split = int(len(X) * 0.8)
#     X_train, X_test = X[:split], X[split:]
#     y_train, y_test = y[:split], y[split:]

#     model_path = os.path.join(MODEL_DIR, f"{ticker}_lstm.h5")

#     if os.path.exists(model_path):
#         model = load_model(model_path, compile=False)
#     else:
#         model = Sequential([
#             LSTM(50, return_sequences=True, input_shape=(time_step, 1)),
#             Dropout(0.2),
#             LSTM(50, return_sequences=False),
#             Dropout(0.2),
#             Dense(25),
#             Dense(1)
#         ])
#         model.compile(optimizer="adam", loss="mean_squared_error")
#         model.fit(X_train, y_train, epochs=10, batch_size=32, verbose=0)
#         model.save(model_path)

#     # Predict
#     predictions = model.predict(X_test)
#     predictions = scaler.inverse_transform(predictions.reshape(-1, 1))
#     actual = scaler.inverse_transform(y_test.reshape(-1, 1))

#     return actual, predictions, scaler, model, scaled_data

# def forecast_future(model, scaler, scaled_data, days=30, time_step=60):
#     last_sequence = scaled_data[-time_step:]
#     future_predictions = []

#     for _ in range(days):
#         seq = last_sequence.reshape(1, time_step, 1)
#         next_pred = model.predict(seq, verbose=0)
#         future_predictions.append(next_pred[0][0])

#         last_sequence = np.append(last_sequence, next_pred)[-time_step:]

#     return scaler.inverse_transform(np.array(future_predictions).reshape(-1, 1))

# # -------------------------------
# # STREAMLIT UI
# # -------------------------------
# st.title("📈 Multi-Stock Market Analysis & Forecast (LSTM)")

# ticker = st.selectbox("Select Ticker", TICKERS)
# df = load_data(ticker)
# df_ind = calculate_indicators(df)

# st.subheader(f"Stock Data for {ticker}")
# st.dataframe(df.tail())

# # Plot indicators
# st.subheader("Technical Indicators")
# fig, ax = plt.subplots(figsize=(12, 6))
# ax.plot(df_ind.index, df_ind["Close"], label="Close")
# ax.plot(df_ind.index, df_ind["SMA20"], label="SMA20")
# ax.plot(df_ind.index, df_ind["SMA50"], label="SMA50")
# ax.plot(df_ind.index, df_ind["UpperBB"], label="UpperBB", linestyle="--")
# ax.plot(df_ind.index, df_ind["LowerBB"], label="LowerBB", linestyle="--")
# ax.legend()
# st.pyplot(fig)

# # Train + Forecast
# st.subheader("LSTM Forecasting")
# actual, predictions, scaler, model, scaled_data = build_and_train_model(df, ticker)

# # Plot prediction vs actual
# fig2, ax2 = plt.subplots(figsize=(12, 6))
# ax2.plot(actual, label="Actual")
# ax2.plot(predictions, label="Predicted")
# ax2.legend()
# st.pyplot(fig2)

# # Future forecast
# future_days = st.slider("Forecast Days", 10, 60, 30)
# future_forecast = forecast_future(model, scaler, scaled_data, days=future_days)

# st.subheader(f"{future_days}-Day Forecast")
# fig3, ax3 = plt.subplots(figsize=(12, 6))
# ax3.plot(range(len(future_forecast)), future_forecast, label="Forecast")
# ax3.legend()
# st.pyplot(fig3)

# st.success("✅ Analysis complete!")



# import streamlit as st
# import matplotlib.pyplot as plt
# import yfinance as yf
# import pandas as pd
# from forecasr_multi import forecast_next  # <-- import function from forecast.py

# st.set_page_config(page_title="Stock Market Forecast", layout="wide")

# st.title("📈 LSTM Stock Price Forecasting")

# # Sidebar
# st.sidebar.header("Settings")
# ticker = st.sidebar.text_input("Enter Stock Ticker", "AAPL")
# days = st.sidebar.slider("Forecast Days", 1, 30, 7)

# if st.sidebar.button("Run Forecast"):
#     try:
#         # Fetch historical data
#         df = yf.download(ticker, period="2y")[["Close"]].dropna()

#         st.subheader(f"Last 60 Days of {ticker}")
#         st.line_chart(df[-60:])

#         # Run LSTM forecast (imported from forecast.py)
#         preds = forecast_next(ticker, days=days)

#         # Display forecast
#         st.subheader(f"🔮 {ticker} Forecast for Next {days} Days")
#         forecast_df = pd.DataFrame(preds, columns=["Forecast"])
#         st.write(forecast_df)

#         # Plot historical + forecast
#         fig, ax = plt.subplots(figsize=(10, 5))
#         ax.plot(df.index[-100:], df["Close"].values[-100:], label="Historical")
#         ax.plot(
#             pd.date_range(df.index[-1], periods=days+1, freq="B")[1:],
#             preds,
#             label="Forecast",
#             linestyle="--",
#             marker="o"
#         )
#         ax.legend()
#         st.pyplot(fig)

#     except Exception as e:
#         st.error(f"Error: {e}")


# app.py (main dashboard)
import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from utils import load_data
from indicators import calculate_indicators, plot_indicators
from sentiment import show_sentiment_analysis
# from forecasr_multi import load_forecast_model, forecast_stock
from forecast import load_forecast_model, forecast_stock

from sklearn.preprocessing import MinMaxScaler


from montecarlo import run_simulation

st.set_page_config(page_title="Stock Dashboard", layout="wide")

# Sidebar
st.sidebar.title("Dashboard Settings")
ticker = st.sidebar.text_input("Stock Ticker", value="AAPL").upper()
period = st.sidebar.selectbox("Time Period", ["1mo", "3mo", "6mo", "1y", "2y", "5y"], index=3)

st.sidebar.subheader("Technical Indicators")
show_sma = st.sidebar.checkbox("Moving Averages", True)
show_bollinger = st.sidebar.checkbox("Bollinger Bands", True)
show_rsi = st.sidebar.checkbox("RSI", True)
show_macd = st.sidebar.checkbox("MACD", True)
show_candlestick = st.sidebar.checkbox("Candlestick", True)
show_forecast = st.sidebar.checkbox("LSTM Forecast", True)
show_sentiment = st.sidebar.checkbox("News Sentiment", True)
show_montecarlo = st.sidebar.checkbox("Monte Carlo Simulation", True)

# Load stock data

data = load_data(ticker, period)
if data is None or data.empty:
    st.error("No stock data found. Please try another ticker/period.")
    st.stop()

data.columns = [col[0] if isinstance(col, tuple) else col for col in data.columns]

# Store raw OHLCV for candlestick
st.session_state["ohlcv"] = data.copy()



# Calculate indicators

data = calculate_indicators(data)

# Page title
st.title(f"{ticker} Stock Analysis")

# Top Metrics
col1, col2, col3, col4 = st.columns(4)
with col1:
    try:
        price = float(data['Close'].iloc[-1])
        st.metric("Current Price", f"${price:.2f}")
    except:
        st.metric("Current Price", "N/A")

with col2:
    try:
        prev_price = float(data['Close'].iloc[-2])
        change = price - prev_price
        pct_change = (change / prev_price) * 100
        st.metric("Daily Change", f"${change:.2f}", f"{pct_change:.2f}%")
    except:
        st.metric("Daily Change", "N/A")

with col3:
    try:
        sma20 = float(data['SMA20'].iloc[-1])
        st.metric("20-Day SMA", f"${sma20:.2f}")
    except:
        st.metric("20-Day SMA", "N/A")

with col4:
    try:
        sma50 = float(data['SMA50'].iloc[-1])
        st.metric("50-Day SMA", f"${sma50:.2f}")
    except:
        st.metric("50-Day SMA", "N/A")



plot_indicators(data, show_sma, show_bollinger, show_rsi, show_macd,show_candlestick,ticker)


# Sentiment
if show_sentiment:
    show_sentiment_analysis(ticker)


# LSTM Forecast (ribbon-style)
if show_forecast:
    try:
        st.subheader("📈 LSTM Stock Forecast")

        # load model + scalers_dict
        model, scalers = load_forecast_model()  # scalers is expected to be a dict

        # get scaler for the requested ticker (ticker variable is uppercased)
        scaler = None
        if isinstance(scalers, dict) and ticker in scalers:
            scaler = scalers[ticker]
        else:
            # fallback: fit a scaler on-the-fly (works but is less reliable)
            st.warning(
                f"Model was not trained on {ticker}. Using an on-the-fly scaler fitted to this ticker's data. "
                "Forecasts may be less reliable."
            )
            scaler = MinMaxScaler()
            scaler.fit(data[['Close']].values.reshape(-1, 1))

        # run forecast (returns actual, predicted, forecast, dates)
        actual, predicted, forecast, forecast_dates = forecast_stock(data, model, scaler, forecast_days=10)

        # Plot (ribbon-style + actual vs predicted)
        fig3 = go.Figure()
        fig3.add_trace(go.Scatter(x=data.index[-len(actual):], y=actual, name="Actual", line=dict(color="gray")))
        fig3.add_trace(go.Scatter(x=data.index[-len(predicted):], y=predicted, name="Predicted", line=dict(color="purple")))
        fig3.add_trace(go.Scatter(x=forecast_dates, y=forecast, name="Forecast", line=dict(color="green")))
        fig3.add_trace(go.Scatter(x=forecast_dates, y=forecast, name="Forecast Ribbon", line=dict(color="green"),
                                  fill="tonexty", fillcolor="rgba(0,255,0,0.2)", showlegend=False))
        fig3.update_layout(title="LSTM Forecast (Actual vs Predicted)",
                           xaxis_title="Date", yaxis_title="Price", template="plotly_white")
        st.plotly_chart(fig3, use_container_width=True)

    except Exception as e:
        st.error(f"LSTM Forecast error: {str(e)}")




# if show_forecast:
#     try:
#         st.subheader("📈 LSTM Stock Forecast")

#         # Load trained model + scalers
#         model, scalers = load_forecast_model()

#         if ticker not in scalers:
#             st.warning(f"⚠️ Model was not trained on {ticker}. Training tickers only: {list(scalers.keys())}")
#         else:
#             scaler = scalers[ticker]
#             predicted, forecast, forecast_dates = forecast_stock(data, model, scaler, forecast_days=10)

#             fig3 = go.Figure()
#             # Actual prices
#             fig3.add_trace(go.Scatter(
#                 x=data.index[-len(predicted):],
#                 y=data['Close'].iloc[-len(predicted):],
#                 name="Actual",
#                 line=dict(color="gray")
#             ))
#             # Predicted (historical fit)
#             fig3.add_trace(go.Scatter(
#                 x=data.index[-len(predicted):],
#                 y=predicted,
#                 name="Predicted",
#                 line=dict(color="purple")
#             ))
#             # Forecast future days
#             fig3.add_trace(go.Scatter(
#                 x=forecast_dates,
#                 y=forecast,
#                 name="Forecast",
#                 line=dict(color="green")
#             ))
#             # Forecast ribbon
#             fig3.add_trace(go.Scatter(
#                 x=forecast_dates,
#                 y=forecast,
#                 name="Forecast Ribbon",
#                 line=dict(color="green"),
#                 fill="tonexty",
#                 fillcolor="rgba(0,255,0,0.2)",
#                 showlegend=False
#             ))

#             fig3.update_layout(
#                 title=f"{ticker} LSTM Forecast (10 Business Days Ahead)",
#                 xaxis_title="Date",
#                 yaxis_title="Price",
#                 template="plotly_white"
#             )
#             st.plotly_chart(fig3, use_container_width=True)

#     except Exception as e:
#         st.error(f"LSTM Forecast error: {str(e)}")

# Monte Carlo Simulation
if show_montecarlo:
    run_simulation(data)
