from typing import Dict, List, Any
import qazvelo_analytics

class MarketAnalyticsService:
    @staticmethod
    def process_market_indicators(prices: List[float], period: int) -> Dict[str, Any]:

        if not prices or len(prices) < period:
            return {
                "status": "error",
                "message": f"Insufficient data. Needed at least {period} price points."
            }

        sma_calculated = qazvelo_analytics.calculate_sma(prices, period)
        vol_calculated = qazvelo_analytics.calculate_volatility(prices, period)

        return{
                "status": "success",
                "metrics": {
                "input_count": len(prices),
                "applied_period": period,
                "simple_moving_average": [round(x, 4) for x in sma_calculated],
                "volatility_standard_deviation": [round(x, 4) for x in vol_calculated]
                }
        }
              
          