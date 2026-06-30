# import numpy as np
# import pandas as pd
# import plotly.graph_objects as go
# import streamlit as st

# def calculate_indicators(df):
#     df['SMA20'] = df['Close'].rolling(20).mean()
#     df['SMA50'] = df['Close'].rolling(50).mean()
#     df['UpperBand'] = df['SMA20'] + 2 * df['Close'].rolling(20).std()
#     df['LowerBand'] = df['SMA20'] - 2 * df['Close'].rolling(20).std()

#     delta = df['Close'].diff()
#     gain = delta.clip(lower=0)
#     loss = -delta.clip(upper=0)
#     avg_gain = gain.rolling(14).mean()
#     avg_loss = loss.rolling(14).mean()
#     rs = avg_gain / avg_loss
#     df['RSI'] = 100 - (100 / (1 + rs))

#     exp12 = df['Close'].ewm(span=12).mean()
#     exp26 = df['Close'].ewm(span=26).mean()
#     df['MACD'] = exp12 - exp26
#     df['Signal'] = df['MACD'].ewm(span=9).mean()

#     return df

# def plot_indicators(df, sma=True, rsi=True, macd=True, bollinger=True):
#     if sma:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['Close'], name='Close'))
#         fig.add_trace(go.Scatter(x=df.index, y=df['SMA20'], name='SMA20'))
#         fig.add_trace(go.Scatter(x=df.index, y=df['SMA50'], name='SMA50'))
#         fig.update_layout(title="Moving Averages")
#         st.plotly_chart(fig, use_container_width=True)

#     if bollinger:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['UpperBand'], name='Upper Band'))
#         fig.add_trace(go.Scatter(x=df.index, y=df['LowerBand'], name='Lower Band', fill='tonexty'))
#         fig.update_layout(title="Bollinger Bands")
#         st.plotly_chart(fig, use_container_width=True)

#     if rsi:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['RSI'], name='RSI'))
#         fig.add_hline(y=70, line_dash='dash', line_color='red')
#         fig.add_hline(y=30, line_dash='dash', line_color='green')
#         fig.update_layout(title="RSI")
#         st.plotly_chart(fig, use_container_width=True)

#     if macd:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['MACD'], name='MACD'))
#         fig.add_trace(go.Scatter(x=df.index, y=df['Signal'], name='Signal'))
#         fig.update_layout(title="MACD")
#         st.plotly_chart(fig, use_container_width=True)


# import numpy as np
# import pandas as pd
# import plotly.graph_objects as go
# import streamlit as st

# def calculate_indicators(df):
#     df['SMA20'] = df['Close'].rolling(20).mean()
#     df['SMA50'] = df['Close'].rolling(50).mean()
#     rolling_mean = df['Close'].rolling(20).mean()
#     rolling_std = df['Close'].rolling(20).std()
#     df['UpperBand'] = rolling_mean + (2 * rolling_std)
#     df['LowerBand'] = rolling_mean - (2 * rolling_std)

#     delta = df['Close'].diff(1)
#     gain = delta.where(delta > 0, 0)
#     loss = -delta.where(delta < 0, 0)
#     avg_gain = gain.rolling(14).mean()
#     avg_loss = loss.rolling(14).mean()
#     rs = avg_gain / avg_loss.replace(0, np.nan).fillna(0)
#     df['RSI'] = 100 - (100 / (1 + rs))

#     exp12 = df['Close'].ewm(span=12, adjust=False).mean()
#     exp26 = df['Close'].ewm(span=26, adjust=False).mean()
#     df['MACD'] = exp12 - exp26
#     df['Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()

#     return df

# def plot_indicators(df, show_sma, show_bollinger, show_rsi, show_macd):
#     if show_sma:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['SMA20'], name='SMA20', mode='lines'))
#         fig.add_trace(go.Scatter(x=df.index, y=df['SMA50'], name='SMA50', mode='lines'))
#         fig.update_layout(title="Moving Averages")
#         st.plotly_chart(fig, use_container_width=True)

#     if show_bollinger:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['UpperBand'], name='Upper Band'))
#         fig.add_trace(go.Scatter(x=df.index, y=df['LowerBand'], name='Lower Band', fill='tonexty'))
#         fig.update_layout(title="Bollinger Bands")
#         st.plotly_chart(fig, use_container_width=True)

#     if show_rsi:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['RSI'], name='RSI'))
#         fig.add_hline(y=70, line_dash="dash", line_color="red")
#         fig.add_hline(y=30, line_dash="dash", line_color="green")
#         fig.update_layout(title="RSI")
#         st.plotly_chart(fig, use_container_width=True)

#     if show_macd:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['MACD'], name='MACD'))
#         fig.add_trace(go.Scatter(x=df.index, y=df['Signal'], name='Signal'))
#         fig.update_layout(title="MACD")
#         st.plotly_chart(fig, use_container_width=True)




# import numpy as np
# import pandas as pd
# import plotly.graph_objects as go
# import streamlit as st
# # import yfinance as yf
# # df = yf.download(ticker, period=period, progress=False)
# # df.dropna(inplace=True)


# def calculate_indicators(df):
#     df['SMA20'] = df['Close'].rolling(20).mean()
#     df['SMA50'] = df['Close'].rolling(50).mean()
#     rolling_mean = df['Close'].rolling(20).mean()
#     rolling_std = df['Close'].rolling(20).std()
#     df['UpperBand'] = rolling_mean + (2 * rolling_std)
#     df['LowerBand'] = rolling_mean - (2 * rolling_std)

#     delta = df['Close'].diff(1)
#     gain = delta.where(delta > 0, 0)
#     loss = -delta.where(delta < 0, 0)
#     avg_gain = gain.rolling(14).mean()
#     avg_loss = loss.rolling(14).mean()
#     rs = avg_gain / avg_loss.replace(0, np.nan).fillna(0)
#     df['RSI'] = 100 - (100 / (1 + rs))

#     exp12 = df['Close'].ewm(span=12, adjust=False).mean()
#     exp26 = df['Close'].ewm(span=26, adjust=False).mean()
#     df['MACD'] = exp12 - exp26
#     df['Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()

#     return df

# def plot_indicators(df, show_sma, show_bollinger, show_rsi, show_macd,show_candlestick):
#     if show_sma:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['SMA20'], name='SMA20', mode='lines'))
#         fig.add_trace(go.Scatter(x=df.index, y=df['SMA50'], name='SMA50', mode='lines'))
#         fig.update_layout(title="Moving Averages")
#         st.plotly_chart(fig, use_container_width=True)

#     if show_bollinger:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['UpperBand'], name='Upper Band'))
#         fig.add_trace(go.Scatter(x=df.index, y=df['LowerBand'], name='Lower Band', fill='tonexty'))
#         fig.update_layout(title="Bollinger Bands")
#         st.plotly_chart(fig, use_container_width=True)

#     if show_rsi:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['RSI'], name='RSI'))
#         fig.add_hline(y=70, line_dash="dash", line_color="red")
#         fig.add_hline(y=30, line_dash="dash", line_color="green")
#         fig.update_layout(title="RSI")
#         st.plotly_chart(fig, use_container_width=True)

#     if show_macd:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['MACD'], name='MACD'))
#         fig.add_trace(go.Scatter(x=df.index, y=df['Signal'], name='Signal'))
#         fig.update_layout(title="MACD")
#         st.plotly_chart(fig, use_container_width=True)

#     if show_candlestick:
#         data1=df[["Open", "High", "Low", "Close", "Volume"]]

#         fig = go.Figure(data=[go.Candlestick(
#             x=data1.index,
#             open=data1['Open'],
#             high=data1['High'],
#             low=data1['Low'],
#             close=data1['Close'],
#             name="Candlestick"
#         )])
#         fig.update_layout(
#             title="Candlestick Chart",
#             xaxis_title="Date",
#             yaxis_title="Price",
#             xaxis_rangeslider_visible=False,
#             template="plotly_white"
#         )
#         st.plotly_chart(fig, use_container_width=True)

#     # if show_candlestick:
#     #     fig = go.Figure(data=[go.Candlestick(
#     #     x=df.index,
#     #     open=df['Open'],
#     #     high=df['High'],
#     #     low=df['Low'],
#     #     close=df['Close'],
#     #     name="Candlestick"
#     # )])
#     # fig.update_layout(
#     #     title="Candlestick Chart",
#     #     xaxis_title="Date",
#     #     yaxis_title="Price",
#     #     xaxis_rangeslider_visible=False,
#     #     template="plotly_white"
#     # )
#     # st.plotly_chart(fig, use_container_width=True)
#     # if show_candlestick:
#     #     df = df.reset_index()  # make sure Date is a column
#     #     fig = go.Figure(
#     #     data=[
#     #         go.Candlestick(
#     #             x=df['Date'],
#     #             open=df['Open'],
#     #             high=df['High'],
#     #             low=df['Low'],
#     #             close=df['Close'],
#     #             name="Candlestick"
#     #         )
#     #     ]
#     # )
#     # fig.update_layout(
#     #     title="Candlestick Chart",
#     #     xaxis_rangeslider_visible=False,
#     #     template="plotly_white"
#     # )
#     # st.plotly_chart(fig, use_container_width=True)





# import numpy as np
# import pandas as pd
# import plotly.graph_objects as go
# import streamlit as st

# def calculate_indicators(df):
#     df['SMA20'] = df['Close'].rolling(20).mean()
#     df['SMA50'] = df['Close'].rolling(50).mean()

#     rolling_mean = df['Close'].rolling(20).mean()
#     rolling_std = df['Close'].rolling(20).std()
#     df['UpperBand'] = rolling_mean + (2 * rolling_std)
#     df['LowerBand'] = rolling_mean - (2 * rolling_std)

#     delta = df['Close'].diff(1)
#     gain = delta.where(delta > 0, 0)
#     loss = -delta.where(delta < 0, 0)
#     avg_gain = gain.rolling(14).mean()
#     avg_loss = loss.rolling(14).mean()
#     rs = avg_gain / avg_loss.replace(0, np.nan).fillna(0)
#     df['RSI'] = 100 - (100 / (1 + rs))

#     exp12 = df['Close'].ewm(span=12, adjust=False).mean()
#     exp26 = df['Close'].ewm(span=26, adjust=False).mean()
#     df['MACD'] = exp12 - exp26
#     df['Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()

#     return df


# def plot_indicators(df, show_sma, show_bollinger, show_rsi, show_macd, show_candlestick, ticker=""):
#     if df is None or df.empty:
#         st.warning("⚠️ No data available to plot indicators.")
#         return

#     # Ensure datetime index
#     df = df.copy()
#     if not isinstance(df.index, pd.DatetimeIndex):
#         df.index = pd.to_datetime(df.index)

#     if show_sma:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['SMA20'], name='SMA20', mode='lines'))
#         fig.add_trace(go.Scatter(x=df.index, y=df['SMA50'], name='SMA50', mode='lines'))
#         fig.update_layout(title="Moving Averages")
#         st.plotly_chart(fig, use_container_width=True)

#     if show_bollinger:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['UpperBand'], name='Upper Band'))
#         fig.add_trace(go.Scatter(x=df.index, y=df['LowerBand'], name='Lower Band', fill='tonexty'))
#         fig.update_layout(title="Bollinger Bands")
#         st.plotly_chart(fig, use_container_width=True)

#     if show_rsi:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['RSI'], name='RSI'))
#         fig.add_hline(y=70, line_dash="dash", line_color="red")
#         fig.add_hline(y=30, line_dash="dash", line_color="green")
#         fig.update_layout(title="RSI")
#         st.plotly_chart(fig, use_container_width=True)

#     if show_macd:
#         fig = go.Figure()
#         fig.add_trace(go.Scatter(x=df.index, y=df['MACD'], name='MACD'))
#         fig.add_trace(go.Scatter(x=df.index, y=df['Signal'], name='Signal'))
#         fig.update_layout(title="MACD")
#         st.plotly_chart(fig, use_container_width=True)

#     # if show_candlestick:
#     #     fig = go.Figure(data=[go.Candlestick(
#     #         x=df.index,
#     #         open=df["Open"],
#     #         high=df["High"],
#     #         low=df["Low"],
#     #         close=df["Close"],
#     #         name="Candlestick"
#     #     )])

#     #     # Add SMAs on top of candlestick if available
#     #     if "SMA20" in df.columns:
#     #         fig.add_trace(go.Scatter(x=df.index, y=df["SMA20"],
#     #                                  line=dict(color="blue", width=1),
#     #                                  name="SMA20"))
#     #     if "SMA50" in df.columns:
#     #         fig.add_trace(go.Scatter(x=df.index, y=df["SMA50"],
#     #                                  line=dict(color="orange", width=1),
#     #                                  name="SMA50"))

#     #     fig.update_layout(
#     #         title=f"{ticker} Candlestick Chart",
#     #         xaxis_title="Date",
#     #         yaxis_title="Price",
#     #         xaxis_rangeslider_visible=False,
#     #         template="plotly_white"
#     #     )
#     #     st.plotly_chart(fig, use_container_width=True)
#     if show_candlestick:
#     # Ensure we use raw OHLCV (not overwritten by indicators)
#         if "ohlcv" in st.session_state:
#             ohlcv = st.session_state["ohlcv"]
#         else:
#             ohlcv = df  # fallback if not stored

#         fig = go.Figure(data=[go.Candlestick(
#         x=ohlcv.index,
#         open=ohlcv["Open"],
#         high=ohlcv["High"],
#         low=ohlcv["Low"],
#         close=ohlcv["Close"],
#         name="Candlestick"
#     )])

#     # Add SMAs
#     # if "SMA20" in df.columns:
#     #     fig.add_trace(go.Scatter(x=df.index, y=df["SMA20"], line=dict(color="blue", width=1), name="SMA20"))
#     # if "SMA50" in df.columns:
#     #     fig.add_trace(go.Scatter(x=df.index, y=df["SMA50"], line=dict(color="orange", width=1), name="SMA50"))

#     fig.update_layout(
#         title=f"{ticker} Candlestick Chart",
#         xaxis_title="Date",
#         yaxis_title="Price",
#         xaxis_rangeslider_visible=False,
#         template="plotly_white"
#     )
#     st.plotly_chart(fig, use_container_width=True)



# indicators.py (Cleaned for API use)
import numpy as np
import pandas as pd
# Removed: import plotly.graph_objects as go
# Removed: import streamlit as st

def calculate_indicators(df):
    # Work on a copy to avoid mutating cached DataFrames
    df = df.copy()

    # Robust MultiIndex handling: flatten and squeeze so df['Close'] is always a Series
    if hasattr(df.columns, 'nlevels') and df.columns.nlevels > 1:
        df.columns = df.columns.droplevel(1)  # drop the ticker level
    # If columns are still MultiIndex with one level, flatten to plain Index
    if hasattr(df.columns, 'nlevels') and df.columns.nlevels > 1:
        df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]
    # Squeeze: if df['Close'] returns a DataFrame (single-column), convert to Series
    for col in ['Close', 'High', 'Low', 'Open', 'Volume']:
        if col in df.columns:
            val = df[col]
            if isinstance(val, pd.DataFrame):
                df[col] = val.iloc[:, 0]

    df['SMA20'] = df['Close'].rolling(20).mean()
    df['SMA50'] = df['Close'].rolling(50).mean()
    df['EMA20'] = df['Close'].ewm(span=20, adjust=False).mean()
    
    # Calculate ATR
    prev_close = df['Close'].shift(1)
    tr1 = df['High'] - df['Low']
    tr2 = (df['High'] - prev_close).abs()
    tr3 = (df['Low'] - prev_close).abs()
    true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    df['ATR'] = true_range.rolling(window=14).mean()
    
    # ... (Rest of Bollinger, RSI, MACD calculation logic is fine) ...
    rolling_mean = df['Close'].rolling(20).mean()
    rolling_std = df['Close'].rolling(20).std()
    df['UpperBand'] = rolling_mean + (2 * rolling_std)
    df['LowerBand'] = rolling_mean - (2 * rolling_std)

    delta = df['Close'].diff(1)
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    avg_gain = gain.rolling(14).mean()
    avg_loss = loss.rolling(14).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan).fillna(0)
    df['RSI'] = 100 - (100 / (1 + rs))

    exp12 = df['Close'].ewm(span=12, adjust=False).mean()
    exp26 = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD'] = exp12 - exp26
    df['Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()

    result = df.dropna().reset_index()
    # Ensure the date column is named 'Date' regardless of index name
    date_col = result.columns[0]
    if date_col != 'Date':
        result = result.rename(columns={date_col: 'Date'})
    # Convert Timestamp objects to strings for JSON serialization
    if 'Date' in result.columns:
        result['Date'] = result['Date'].astype(str)
    return result.to_dict('records')

# Removed: The entire plot_indicators function. Plotting is a frontend (Next.js) task.