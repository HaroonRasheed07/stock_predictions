# import numpy as np
# import plotly.graph_objects as go
# import streamlit as st

# def run_simulation(df, simulations=300, days=30):
#     st.subheader("Monte Carlo Simulation")
#     try:
#         returns = df['Close'].pct_change().dropna()
#         last_price = df['Close'].iloc[-1]
#         mean = returns.mean()
#         std = returns.std()

#         price_paths = np.zeros((days, simulations))
#         price_paths[0] = last_price

#         for t in range(1, days):
#             rand = np.random.normal(mean, std, simulations)
#             price_paths[t] = price_paths[t-1] * (1 + rand)

#         fig = go.Figure()
#         for i in range(50):
#             fig.add_trace(go.Scatter(y=price_paths[:, i], mode='lines', line=dict(width=1), showlegend=False))

#         fig.update_layout(title=f"Monte Carlo Simulation ({simulations} paths)", xaxis_title="Day", yaxis_title="Price")
#         st.plotly_chart(fig, use_container_width=True)
#     except Exception as e:
#         st.error(f"Monte Carlo error: {e}")


import numpy as np
import plotly.graph_objects as go
import streamlit as st


def simulate_price_paths(returns, last_price, days=30, simulations=300, seed=42):
    clean_returns = np.asarray(returns, dtype=float)
    clean_returns = clean_returns[np.isfinite(clean_returns)]
    if clean_returns.size == 0:
        raise ValueError("No finite returns available for simulation")
    if not np.isfinite(last_price) or last_price <= 0:
        raise ValueError("last_price must be finite and positive")

    rng = np.random.default_rng(seed)
    simulated_returns = rng.normal(
        clean_returns.mean(), clean_returns.std(), size=(days, simulations)
    )
    simulated_returns = np.maximum(simulated_returns, -0.999)

    price_paths = np.zeros((days, simulations), dtype=float)
    price_paths[0] = last_price
    for t in range(1, days):
        price_paths[t] = price_paths[t - 1] * (1 + simulated_returns[t])
    return price_paths


def run_simulation(df):
    st.subheader("Monte Carlo Simulation")
    try:
        returns = df['Close'].pct_change().dropna()
        days = 30
        simulations = 300
        last_price = df['Close'].iloc[-1]
        price_paths = simulate_price_paths(returns, last_price, days=days, simulations=simulations, seed=42)
        fig_sim = go.Figure()
        for i in range(min(50, simulations)):
            fig_sim.add_trace(go.Scatter(x=list(range(days)), y=price_paths[:, i], mode='lines', line=dict(width=1, color='rgba(0,0,255,0.1)'), showlegend=False))
        fig_sim.add_trace(go.Scatter(x=list(range(days)), y=np.mean(price_paths, axis=1), mode='lines', line=dict(color='blue', width=2), name='Average Path'))
        fig_sim.update_layout(title=f"Monte Carlo Simulation - {simulations} Paths (30 Days)", xaxis_title="Days", yaxis_title="Price")
        st.plotly_chart(fig_sim, use_container_width=True)
    except Exception as e:
        st.error(f"Simulation error: {str(e)}")
