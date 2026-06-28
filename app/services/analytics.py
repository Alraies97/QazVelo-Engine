from typing import Dict, List, Any
import qazvelo_analytics
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import query
from app.models.analytics import AnalyticsModel
from sqlalchemy.future import select
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
              
    @staticmethod
    async def get_live_market_analytics(db: AsyncSession, metric_name: str, period: int)-> Dict[str, Any]:
          
        query=(
            select(AnalyticsModel.metric_value)
            .where(AnalyticsModel.metric_name == metric_name)
            .order_by(AnalyticsModel.id.asc())
           )
    
        result = await db.execute(query)
        prices = [float(row[0]) for row in result.all()]

        return MarketAnalyticsService.process_market_indicators(prices, period)
