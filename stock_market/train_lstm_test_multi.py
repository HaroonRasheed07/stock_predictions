# # import yfinance as yf
# # import numpy as np
# # import pandas as pd
# # from sklearn.preprocessing import MinMaxScaler
# # from tensorflow.keras.models import Sequential
# # from tensorflow.keras.layers import LSTM, Dense
# # import pickle
# # import os

# # # Step 1: Fetch multiple tickers
# # def fetch_multi_data(tickers, period="5y"):
# #     df = yf.download(tickers, period=period, progress=False)["Close"]
# #     df = df.dropna()
# #     return df

# # # Step 2: Prepare training sequences
# # def prepare_multi_data(df, window_size=60):
# #     scaler = MinMaxScaler()
# #     scaled = scaler.fit_transform(df.values.reshape(-1, 1))

# #     X, y = [], []
# #     for i in range(window_size, len(scaled)):
# #         X.append(scaled[i - window_size:i, 0])
# #         y.append(scaled[i, 0])

# #     X, y = np.array(X), np.array(y)
# #     X = np.reshape(X, (X.shape[0], X.shape[1], 1))
# #     return X, y, scaler

# # # Step 3: Train generalized LSTM
# # def train_lstm(X, y):
# #     model = Sequential([
# #         LSTM(128, activation='relu', return_sequences=True, input_shape=(X.shape[1], 1)),
# #         LSTM(64, activation='relu'),
# #         Dense(25),
# #         Dense(10),
# #         Dense(1)
# #     ])
# #     model.compile(optimizer='adam', loss='mean_squared_error')
# #     model.fit(X, y, epochs=50, batch_size=16, verbose=1)
# #     return model

# # if __name__ == "__main__":
# #     tickers = ["AAPL", "TSLA", "MSFT", "AMZN", "GOOGL"]
# #     data = fetch_multi_data(tickers, period="5y")

# #     # Flatten into 1D for scaling
# #     stacked_data = data.stack().reset_index(drop=True)

# #     X, y, scaler = prepare_multi_data(stacked_data, window_size=60)
# #     model = train_lstm(X, y)

# #     model.save("lstm_multi_model.h5")
# #     with open("scaler_multi.pkl", "wb") as f:
# #         pickle.dump(scaler, f)

# #     print("✅ Multi-stock LSTM model and scaler saved successfully.")


# # import numpy as np
# # import pandas as pd
# # import yfinance as yf
# # from sklearn.preprocessing import MinMaxScaler
# # from tensorflow.keras.models import Sequential
# # from tensorflow.keras.layers import LSTM, Dense, Dropout

# # # ------------------------
# # # 1. Download Multiple Stocks (OHLCV)
# # # ------------------------
# # tickers = ["AAPL", "MSFT", "GOOGL", "TSLA", "AMZN"]
# # df = yf.download(tickers, start="2015-01-01", end="2023-01-01")

# # # Only keep OHLCV
# # df = df[["Open", "High", "Low", "Close", "Volume"]]
# # df = df.dropna()

# # print("Data Shape:", df.shape)
# # print(df.head())

# # # ------------------------
# # # 2. Scale Data
# # # ------------------------
# # # Flatten multi-index (Stock, Feature) -> single index
# # df.columns = [f"{col[0]}_{col[1]}" for col in df.columns]

# # scaler = MinMaxScaler(feature_range=(0,1))
# # scaled_data = scaler.fit_transform(df)

# # # ------------------------
# # # 3. Create Sequences
# # # ------------------------
# # def create_sequences(data, seq_length=60):
# #     X, y = [], []
# #     for i in range(seq_length, len(data)):
# #         X.append(data[i-seq_length:i])   # last 60 days of OHLCV
# #         y.append(data[i])                # predict next day OHLCV
# #     return np.array(X), np.array(y)

# # sequence_length = 60
# # X, y = create_sequences(scaled_data, sequence_length)

# # print("X shape:", X.shape)  # (samples, 60, num_features)
# # print("y shape:", y.shape)

# # # ------------------------
# # # 4. Train/Test Split
# # # ------------------------
# # split = int(0.8 * len(X))
# # X_train, X_test = X[:split], X[split:]
# # y_train, y_test = y[:split], y[split:]

# # # ------------------------
# # # 5. Build Model
# # # ------------------------
# # model = Sequential()
# # model.add(LSTM(128, return_sequences=True, input_shape=(X_train.shape[1], X_train.shape[2])))
# # model.add(Dropout(0.3))
# # model.add(LSTM(128))
# # model.add(Dropout(0.3))
# # model.add(Dense(X_train.shape[2]))   # predict OHLCV for all stocks

# # model.compile(optimizer="adam", loss="mean_squared_error")

# # # ------------------------
# # # 6. Train Model
# # # ------------------------
# # history = model.fit(
# #     X_train, y_train,
# #     epochs=10,
# #     batch_size=32,
# #     validation_data=(X_test, y_test),
# #     shuffle=False
# # )

# # import pickle
# # model.save("lstm_multi_model.h5")
# # with open("scaler_multi.pkl", "wb") as f:
# #     pickle.dump(scaler, f)
# #     print("✅ Multi-stock LSTM model and scaler saved successfully.")

# # # ------------------------
# # # 7. Predictions
# # # ------------------------
# # # predictions = model.predict(X_test)
# # # predicted_data = scaler.inverse_transform(predictions)
# # # real_data = scaler.inverse_transform(y_test)

# # # # Convert to DataFrame for easy comparison
# # # results = pd.DataFrame(predicted_data, columns=df.columns)
# # # results_real = pd.DataFrame(real_data, columns=df.columns)

# # # # Compare for Apple Close
# # # results_compare = pd.DataFrame({
# # #     "Predicted_AAPL_Close": results["AAPL_Close"],
# # #     "Real_AAPL_Close": results_real["AAPL_Close"]
# # # })
# # # print(results_compare.head())


# # train_lstm_multi.py

# # import yfinance as yf
# # import numpy as np
# # import pandas as pd
# # from sklearn.preprocessing import MinMaxScaler
# # from tensorflow.keras.models import Sequential
# # from tensorflow.keras.layers import LSTM, Dense, Dropout
# # from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
# # import pickle
# # import os

# # # Step 1: Fetch multiple tickers
# # def fetch_multi_data(tickers, period="5y"):
# #     all_data = pd.DataFrame()

# #     for ticker in tickers:
# #         try:
# #             print(f"📡 Downloading {ticker}...")
# #             df = yf.download(ticker, period=period, progress=False, timeout=20)

# #             if df.empty:
# #                 print(f"⚠️ Warning: No data for {ticker}, skipping.")
# #                 continue

# #             all_data[ticker] = df["Close"]

# #         except Exception as e:
# #             print(f"❌ Failed to download {ticker}: {e}")
# #             continue

# #     if all_data.empty:
# #         raise ValueError("❌ No stock data was fetched. Please check internet or tickers.")

# #     all_data = all_data.dropna()
# #     return all_data

# # # Step 2: Prepare training sequences
# # def prepare_multi_data(df, window_size=60):
# #     # Flatten all stock prices into one long sequence
# #     stacked_data = df.stack().reset_index(drop=True).values.reshape(-1, 1)

# #     scaler = MinMaxScaler()
# #     scaled = scaler.fit_transform(stacked_data)

# #     X, y = [], []
# #     for i in range(window_size, len(scaled)):
# #         X.append(scaled[i - window_size:i, 0])
# #         y.append(scaled[i, 0])

# #     X, y = np.array(X), np.array(y)
# #     X = np.reshape(X, (X.shape[0], X.shape[1], 1))
# #     return X, y, scaler

# # # Step 3: Train generalized LSTM
# # def train_lstm(X, y):
# #     model = Sequential([
# #         LSTM(128, return_sequences=True, input_shape=(X.shape[1], 1)),
        

# #         LSTM(64, return_sequences=True),
        

# #         LSTM(32, return_sequences=False),
        

# #         Dense(64, activation="relu"),
# #         Dense(1)
# #     ])

# #     model.compile(optimizer="adam", loss="mean_squared_error")

# #     # Callbacks for better accuracy
# #     es = EarlyStopping(monitor="loss", patience=10, restore_best_weights=True)
# #     mc = ModelCheckpoint("lstm_multi_model_best.h5", save_best_only=True, monitor="loss")

# #     model.fit(X, y, epochs=25, batch_size=16, verbose=1, callbacks=[es, mc])
# #     return model

# # if __name__ == "__main__":
# #     tickers = ["AAPL", "TSLA", "MSFT", "AMZN", "GOOGL", "META", "NVDA", "IBM", "ORCL", "NFLX"]
# #     print(f"📈 Fetching data for {len(tickers)} tickers...")
# #     data = fetch_multi_data(tickers, period="10y")

# #     print("🔄 Preparing data...")
# #     X, y, scaler = prepare_multi_data(data, window_size=60)

# #     print("🚀 Training LSTM model...")
# #     model = train_lstm(X, y)

# #     # Save model & scaler
# #     model.save("lstm_multi_model.h5")
# #     with open("scaler_multi.pkl", "wb") as f:
# #         pickle.dump(scaler, f)

# #     print("✅ Multi-stock LSTM model and scaler saved successfully.")



# # import yfinance as yf
# # import numpy as np
# # import pandas as pd
# # from sklearn.preprocessing import MinMaxScaler
# # from tensorflow.keras.models import Sequential
# # from tensorflow.keras.layers import LSTM, Dense, Dropout
# # from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
# # import pickle
# # import os

# # # Step 1: Prepare training sequences
# # def prepare_stock_data(df, window_size=60):
# #     close_prices = df[['Close']].values
# #     scaler = MinMaxScaler()
# #     scaled = scaler.fit_transform(close_prices)

# #     X, y = [], []
# #     for i in range(window_size, len(scaled)):
# #         X.append(scaled[i - window_size:i, 0])
# #         y.append(scaled[i, 0])

# #     X, y = np.array(X), np.array(y)
# #     X = np.reshape(X, (X.shape[0], X.shape[1], 1))
# #     return X, y, scaler


# # # Step 2: Define model
# # def train_lstm(X, y):
# #     model = Sequential([
# #         LSTM(128, return_sequences=True, input_shape=(X.shape[1], 1)),
# #         Dropout(0.2),
# #         LSTM(64, return_sequences=False),
# #         Dense(32, activation="relu"),
# #         Dense(10, activation="relu"),
# #         Dense(1)
# #     ])

# #     model.compile(optimizer="adam", loss="mean_squared_error")

# #     # Callbacks
# #     es = EarlyStopping(monitor="loss", patience=8, restore_best_weights=True)
# #     return model, es


# # if __name__ == "__main__":
# #     tickers = ["AAPL", "TSLA", "MSFT", "AMZN", "GOOGL"]  # you can extend
# #     os.makedirs("models", exist_ok=True)
# #     os.makedirs("scalers", exist_ok=True)

# #     for ticker in tickers:
# #         print(f"📡 Training model for {ticker}...")

# #         df = yf.download(ticker, period="5y", progress=False)
# #         if df.empty:
# #             print(f"⚠️ No data for {ticker}, skipping...")
# #             continue

# #         X, y, scaler = prepare_stock_data(df)

# #         model, es = train_lstm(X, y)
# #         mc = ModelCheckpoint(f"models/lstm_{ticker}.h5", save_best_only=True, monitor="loss")

# #         model.fit(X, y, epochs=20, batch_size=16, verbose=1, callbacks=[es, mc])

# #         # Save model & scaler
# #         model.save(f"models/lstm_{ticker}.h5")
# #         with open(f"scalers/{ticker}_scaler.pkl", "wb") as f:
# #             pickle.dump(scaler, f)

# #         print(f"✅ Model and scaler saved for {ticker}")


# # # train_lstm_multi.py
# # import yfinance as yf
# # import numpy as np
# # import pandas as pd
# # from sklearn.preprocessing import MinMaxScaler
# # from tensorflow.keras.models import Sequential
# # from tensorflow.keras.layers import LSTM, Dense, Dropout
# # from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
# # import pickle
# # import os

# # # Step 1: Fetch multiple tickers
# # def fetch_multi_data(tickers, period="10y"):
# #     all_data = {}
# #     for ticker in tickers:
# #         try:
# #             print(f"📡 Downloading {ticker}...")
# #             df = yf.download(ticker, period=period, progress=False, timeout=20)
# #             if df.empty:
# #                 print(f"⚠️ Skipping {ticker} (no data).")
# #                 continue
# #             # all_data[ticker] = df[["Close"]]
# #             # Keep all OHLCV columns instead of only Close
# #             all_data[ticker] = df.dropna()
# #         except Exception as e:
# #             print(f"❌ Failed {ticker}: {e}")
# #     if not all_data:
# #         raise ValueError("❌ No stock data fetched.")
# #     return all_data

# # # Step 2: Prepare sequences per stock
# # def prepare_stock_data(df, window_size=60):
# #     scaler = MinMaxScaler()
# #     scaled = scaler.fit_transform(df[["Close"]].values)

# #     X, y = [], []
# #     for i in range(window_size, len(scaled)):
# #         X.append(scaled[i-window_size:i, 0])
# #         y.append(scaled[i, 0])

# #     X, y = np.array(X), np.array(y)
# #     X = X.reshape((X.shape[0], X.shape[1], 1))
# #     return X, y, scaler

# # # Step 3: Combine multiple stocks into one training set
# # def prepare_multi_data(all_data, window_size=60):
# #     X_all, y_all = [], []
# #     scalers = {}

# #     for ticker, df in all_data.items():
# #         X, y, scaler = prepare_stock_data(df, window_size)
# #         X_all.append(X)
# #         y_all.append(y)
# #         scalers[ticker] = scaler

# #     X_all = np.concatenate(X_all, axis=0)
# #     y_all = np.concatenate(y_all, axis=0)
# #     return X_all, y_all, scalers

# # # Step 4: Train generalized LSTM
# # def train_lstm(X, y):
# #     model = Sequential([
# #         LSTM(128, return_sequences=True, input_shape=(X.shape[1], 1)),
# #         Dropout(0.2),
# #         LSTM(64, return_sequences=True),
# #         Dropout(0.2),
# #         LSTM(32),
# #         Dense(64, activation="relu"),
# #         Dense(1)
# #     ])

# #     model.compile(optimizer="adam", loss="mean_squared_error")

# #     es = EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True)
# #     mc = ModelCheckpoint("lstm_multi_model_best.h5", save_best_only=True, monitor="val_loss")

# #     model.fit(X, y, epochs=40, batch_size=8, 
# #               validation_split=0.2, 
# #               verbose=1, callbacks=[es, mc])
# #     return model

# # if __name__ == "__main__":
# #     tickers = ["AAPL", "TSLA", "MSFT", "AMZN", "GOOGL","ORCL","IBM","NFLX","META","NVDA"]
# #     data_dict = fetch_multi_data(tickers, period="10y")

# #     print("🔄 Preparing data...")
# #     X, y, scalers = prepare_multi_data(data_dict, window_size=60)

# #     print("🚀 Training LSTM model...")
# #     model = train_lstm(X, y)

# #     # Save model & scalers
# #     model.save("lstm_multi_model.h5")
# #     with open("scalers_multi.pkl", "wb") as f:
# #         pickle.dump(scalers, f)

# #     print("✅ Model trained and saved successfully.")



# # # train_lstm_multi.py
# # import yfinance as yf
# # import numpy as np
# # import pandas as pd
# # from sklearn.preprocessing import MinMaxScaler
# # from tensorflow.keras.models import Sequential
# # from tensorflow.keras.layers import LSTM, Dense, Dropout, Bidirectional
# # from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
# # from tensorflow.keras.regularizers import l2
# # import pickle
# # import os

# # # Step 1: Fetch multiple tickers
# # def fetch_multi_data(tickers, period="10y"):
# #     all_data = {}
# #     for ticker in tickers:
# #         try:
# #             print(f"📡 Downloading {ticker}...")
# #             df = yf.download(ticker, period=period, progress=False, timeout=20)
# #             if df.empty:
# #                 print(f"⚠️ Skipping {ticker} (no data).")
# #                 continue
# #             all_data[ticker] = df.dropna()
# #         except Exception as e:
# #             print(f"❌ Failed {ticker}: {e}")
# #     if not all_data:
# #         raise ValueError("❌ No stock data fetched.")
# #     return all_data

# # # Step 2: Prepare sequences per stock
# # def prepare_stock_data(df, window_size=60):
# #     scaler = MinMaxScaler()
# #     scaled = scaler.fit_transform(df[["Close"]].values)

# #     X, y = [], []
# #     for i in range(window_size, len(scaled)):
# #         X.append(scaled[i-window_size:i, 0])
# #         y.append(scaled[i, 0])

# #     X, y = np.array(X), np.array(y)
# #     X = X.reshape((X.shape[0], X.shape[1], 1))
# #     return X, y, scaler

# # # Step 3: Combine multiple stocks into one dataset
# # def prepare_multi_data(all_data, window_size=60):
# #     X_all, y_all = [], []
# #     scalers = {}

# #     for ticker, df in all_data.items():
# #         X, y, scaler = prepare_stock_data(df, window_size)
# #         X_all.append(X)
# #         y_all.append(y)
# #         scalers[ticker] = scaler

# #     X_all = np.concatenate(X_all, axis=0)
# #     y_all = np.concatenate(y_all, axis=0)
# #     return X_all, y_all, scalers

# # # Step 4: Train Bidirectional LSTM
# # def train_lstm(X, y):
# #     model = Sequential([
# #         Bidirectional(LSTM(128, return_sequences=True, 
# #                            kernel_regularizer=l2(1e-4),
# #                            recurrent_regularizer=l2(1e-4),
# #                            bias_regularizer=l2(1e-4)),
# #                       input_shape=(X.shape[1], 1)),
# #         Dropout(0.25),

# #         Bidirectional(LSTM(64, return_sequences=True)),
# #         Dropout(0.25),

# #         Bidirectional(LSTM(32)),
        
# #         Dense(64, activation="relu"),
# #         Dropout(0.2),
# #         Dense(1)
# #     ])

# #     model.compile(
# #         optimizer="adam",
# #         loss="mean_squared_error",
# #     )

# #     es = EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True)
# #     mc = ModelCheckpoint("lstm_multi_model_best.h5", save_best_only=True, monitor="val_loss")

# #     model.fit(
# #         X, y,
# #         epochs=50,
# #         batch_size=8,
# #         validation_split=0.2,
# #         verbose=1,
# #         callbacks=[es, mc]
# #     )
# #     return model


# # # MAIN RUN
# # if __name__ == "__main__":
# #     tickers = ["AAPL", "TSLA", "MSFT", "AMZN", "GOOGL", "ORCL", "IBM", "NFLX", "META", "NVDA"]
# #     data_dict = fetch_multi_data(tickers, period="10y")

# #     print("🔄 Preparing data...")
# #     X, y, scalers = prepare_multi_data(data_dict, window_size=60)

# #     print("🚀 Training Bidirectional LSTM model...")
# #     model = train_lstm(X, y)

# #     # Save model + scalers
# #     model.save("lstm_multi_model.h5")
# #     with open("scalers_multi.pkl", "wb") as f:
# #         pickle.dump(scalers, f)

# #     print("✅ Bidirectional LSTM model trained and saved successfully.")




# # train_lstm_multi_attention.py

# import yfinance as yf
# import numpy as np
# import pandas as pd
# from sklearn.preprocessing import MinMaxScaler
# import tensorflow as tf
# from tensorflow.keras.models import Model
# from tensorflow.keras.layers import (
#     Input, LSTM, Dense, Dropout, Bidirectional, Layer
# )
# from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
# from tensorflow.keras.regularizers import l2
# import pickle
# import os

# # =======================
# # 🔥 Custom Attention Layer
# # =======================
# class SimpleAttention(Layer):
#     def __init__(self):
#         super(SimpleAttention, self).__init__()

#     def call(self, inputs):
#         # inputs → (batch, timesteps, features)
#         score = tf.nn.softmax(inputs, axis=1)        # attention weights
#         context = score * inputs                     # weighted values
#         return tf.reduce_sum(context, axis=1)        # (batch, features)

# # =======================
# # 1. Fetch multi-ticker data
# # =======================
# def fetch_multi_data(tickers, period="10y"):
#     data = {}
#     for t in tickers:
#         try:
#             print(f"📡 Downloading {t} ...")
#             df = yf.download(t, period=period, progress=False)
#             if df.empty:
#                 print(f"⚠️ Skipping {t}")
#                 continue
#             data[t] = df.dropna()
#         except Exception as e:
#             print(f"❌ Failed {t}: {e}")
#     if not data:
#         raise ValueError("No stock data found!")
#     return data

# # =======================
# # 2. Prepare windowed dataset
# # =======================
# def prepare_stock_data(df, window=60):
#     scaler = MinMaxScaler()
#     scaled = scaler.fit_transform(df[["Close"]].values)

#     X, y = [], []
#     for i in range(window, len(scaled)):
#         X.append(scaled[i-window:i, 0])
#         y.append(scaled[i, 0])

#     X = np.array(X).reshape(-1, window, 1)
#     y = np.array(y)
#     return X, y, scaler

# # =======================
# # 3. Combine all tickers
# # =======================
# def prepare_multi_data(all_data, window=60):
#     X_list, y_list, scalers = [], [], {}
    
#     for t, df in all_data.items():
#         X, y, sc = prepare_stock_data(df, window)
#         X_list.append(X)
#         y_list.append(y)
#         scalers[t] = sc
    
#     X_all = np.concatenate(X_list, axis=0)
#     y_all = np.concatenate(y_list, axis=0)
#     return X_all, y_all, scalers

# # =======================
# # 4. Build LSTM + Attention model
# # =======================
# def build_model(window):
#     inputs = Input(shape=(window, 1))

#     # Bidirectional LSTM layers
#     x = Bidirectional(LSTM(128, return_sequences=True,
#                            kernel_regularizer=l2(1e-4),
#                            recurrent_regularizer=l2(1e-4)))(inputs)
#     x = Dropout(0.25)(x)

#     x = Bidirectional(LSTM(64, return_sequences=True))(x)
#     x = Dropout(0.25)(x)

#     # Attention applied on the full sequence output
#     x = SimpleAttention()(x)

#     # Dense layers
#     x = Dense(64, activation="relu")(x)
#     x = Dropout(0.2)(x)

#     outputs = Dense(1)(x)

#     model = Model(inputs, outputs)
#     model.compile(optimizer="adam", loss="mean_squared_error")

#     model.summary()
#     return model

# # =======================
# # 5. Train model
# # =======================
# def train_lstm_model(X, y, window):
#     model = build_model(window)

#     es = EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True)
#     mc = ModelCheckpoint("lstm_attn_best.h5", save_best_only=True, monitor="val_loss")

#     model.fit(
#         X, y,
#         epochs=30,
#         batch_size=16,
#         validation_split=0.2,
#         callbacks=[es, mc],
#         verbose=1
#     )
#     return model

# # =======================
# # MAIN RUN
# # =======================
# if __name__ == "__main__":
#     tickers = ["AAPL", "TSLA", "MSFT", "AMZN", "GOOGL", 
#                "ORCL", "IBM", "NFLX", "META", "NVDA"]

#     print("📥 Fetching stock data...")
#     data_dict = fetch_multi_data(tickers)

#     window = 60
#     print("🔄 Preparing dataset...")
#     X, y, scalers = prepare_multi_data(data_dict, window)

#     print("🚀 Training Bidirectional LSTM + Attention...")
#     model = train_lstm_model(X, y, window)

#     # Save full model and scalers
#     model.save("lstm_multi_final.h5")
#     with open("scalers_multi.pkl", "wb") as f:
#         pickle.dump(scalers, f)

#     print("✅ Training complete! Model + scalers saved.")


# train_lstm_attention.py
import os
import numpy as np
import pandas as pd
import yfinance as yf
import pickle
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.layers import Input, LSTM, Dense, Dropout, Bidirectional
from tensorflow.keras.models import Model
from tensorflow.keras.losses import MeanSquaredError
from tensorflow.keras.metrics import MeanAbsoluteError


# =========================================================
# 1. Custom Attention Layer (FULLY KERAS COMPATIBLE)
# =========================================================
class SimpleAttention(tf.keras.layers.Layer):
    def __init__(self, **kwargs):
        super(SimpleAttention, self).__init__(**kwargs)

    def call(self, inputs):
        score = tf.nn.softmax(inputs, axis=1)     # attention weights
        context = score * inputs                  # weighted features
        return tf.reduce_sum(context, axis=1)     # collapse time dimension

    def get_config(self):
        config = super(SimpleAttention, self).get_config()
        return config


# =========================================================
# 2. Build Model (Bidirectional LSTM + Attention)
# =========================================================
def build_model(window_size=60):
    inputs = Input(shape=(window_size, 1))

    x = Bidirectional(LSTM(64, return_sequences=True))(inputs)
    x = Dropout(0.2)(x)

    x = Bidirectional(LSTM(32, return_sequences=True))(x)
    x = Dropout(0.2)(x)

    x = SimpleAttention()(x)

    x = Dense(32, activation="relu")(x)
    outputs = Dense(1)(x)

    model = Model(inputs, outputs)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss=MeanSquaredError(),
        metrics=[MeanAbsoluteError()]
    )

    model.summary()
    return model


# =========================================================
# 3. Load + Scale Data
# =========================================================
def load_and_prepare_data(tickers, window_size=60):
    all_X, all_y = [], []
    scalers = {}

    for tick in tickers:
        print(f"Downloading {tick}...")
        df = yf.download(tick, period="5y", interval="1d")
        df = df[['Close']].dropna()

        scaler = MinMaxScaler()
        scaled = scaler.fit_transform(df[['Close']])
        scalers[tick] = scaler

        X, y = [], []
        for i in range(window_size, len(scaled)):
            X.append(scaled[i-window_size:i, 0])
            y.append(scaled[i, 0])

        X = np.array(X).reshape(-1, window_size, 1)
        y = np.array(y)

        all_X.append(X)
        all_y.append(y)

    X = np.vstack(all_X)
    y = np.concatenate(all_y)

    print(f"Final training data shape: {X.shape}, {y.shape}")
    return X, y, scalers


# =========================================================
# 4. Train + Save
# =========================================================
def train_lstm_attention():
    window_size = 60
    tickers = ["AAPL", "MSFT", "TSLA", "AMZN", "NVDA","META","GOOGL","ORCL","IBM","NFLX",
               "CVNA","TGL","CRH","ADBE","FIX","SOFI","WBD","AAL","INTC","HBI"]  # multi-stock learning

    X, y, scalers = load_and_prepare_data(tickers, window_size)

    # Build model
    model = build_model(window_size)

    # callbacks for stable + low-risk training
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=10,
            restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=5,
            min_lr=1e-6
        )
    ]

    # Train model
    model.fit(
        X, y,
        validation_split=0.1,
        epochs=50,
        batch_size=8,
        callbacks=callbacks,
        shuffle=True
    )

    # Save trained LSTM model
    model.save("lstm_attention_final.h5")
    print("Model saved: lstm_attention_final.h5")

    # Save scalers
    with open("scalers_multi.pkl", "wb") as f:
        pickle.dump(scalers, f)
    print("Scalers saved: scalers_multi.pkl")


if __name__ == "__main__":
    train_lstm_attention()
