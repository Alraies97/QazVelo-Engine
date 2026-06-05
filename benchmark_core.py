import time
import random
from app.services.analytics import MarketAnalyticsService

print("⏳ Generating 100,000 fake market prices...")
huge_prices = [random.uniform(10.0, 500.0) for _ in range(252)]
window_period = 20

print("🚀 Starting Hybrid Engine Benchmark (C++ Core)...")

start_cpp = time.perf_counter_ns()  

result_cpp = MarketAnalyticsService.process_market_indicators(
    prices=huge_prices, 
    period=window_period
)

end_cpp = time.perf_counter_ns()
cpp_duration_ms = (end_cpp - start_cpp) / 1_000_000  

print(f"✔️ C++ Core Finished in: {cpp_duration_ms:.4f} ms")
print(f"📊 Processed elements count: {result_cpp['metrics']['input_count']}")