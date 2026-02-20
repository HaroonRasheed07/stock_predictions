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

def run_simulation(df):
    st.subheader("Monte Carlo Simulation")
    try:
        returns = df['Close'].pct_change().dropna()
        days = 30
        simulations = 300
        last_price = df['Close'].iloc[-1]
        np.random.seed(42)
        simulated_returns = np.random.normal(returns.mean(), returns.std(), size=(days, simulations))
        price_paths = np.zeros_like(simulated_returns)
        price_paths[0] = last_price
        for t in range(1, days):
            price_paths[t] = price_paths[t-1] * (1 + simulated_returns[t])
        fig_sim = go.Figure()
        for i in range(min(50, simulations)):
            fig_sim.add_trace(go.Scatter(x=list(range(days)), y=price_paths[:, i], mode='lines', line=dict(width=1, color='rgba(0,0,255,0.1)'), showlegend=False))
        fig_sim.add_trace(go.Scatter(x=list(range(days)), y=np.mean(price_paths, axis=1), mode='lines', line=dict(color='blue', width=2), name='Average Path'))
        fig_sim.update_layout(title=f"Monte Carlo Simulation - {simulations} Paths (30 Days)", xaxis_title="Days", yaxis_title="Price")
        st.plotly_chart(fig_sim, use_container_width=True)
    except Exception as e:
        st.error(f"Simulation error: {str(e)}")
