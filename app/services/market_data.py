import yfinance as yf
from typing import List, Optional

class MarketDataService:
    @staticmethod
    def get_historical_price(ticker: str, period: str = '1mo') -> Optional[float]:

        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period=period)

            if hist.empty:
                return None

            close_prices: List[float] = hist['Close'].dropna().tolist()

            return close_prices

        except Exception as e:
            print(f"Error fetching historical price for {ticker}: {e}")
            return None

        