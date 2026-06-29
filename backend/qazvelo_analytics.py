"""
Pure-Python drop-in replacement for the qazvelo_analytics native extension.
Exposes the same public interface:
  calculate_sma(prices, period) -> list[float]
  calculate_volatility(prices, period) -> list[float]
"""
from __future__ import annotations
import math
from typing import List


def calculate_sma(prices: List[float], period: int) -> List[float]:
    """Rolling simple moving average of `period` over `prices`.

    Returns a list whose length == len(prices) - period + 1.
    Each element is the mean of the preceding `period` values.
    """
    if period <= 0:
        raise ValueError(f"period must be > 0, got {period}")
    if len(prices) < period:
        return []

    result: List[float] = []
    window_sum = sum(prices[:period])
    result.append(window_sum / period)

    for i in range(period, len(prices)):
        window_sum += prices[i] - prices[i - period]
        result.append(window_sum / period)

    return result


def calculate_volatility(prices: List[float], period: int) -> List[float]:
    """Rolling population standard deviation of `period` over `prices`.

    Returns a list whose length == len(prices) - period + 1.
    """
    if period <= 0:
        raise ValueError(f"period must be > 0, got {period}")
    if len(prices) < period:
        return []

    result: List[float] = []
    for i in range(len(prices) - period + 1):
        window = prices[i : i + period]
        mean = sum(window) / period
        variance = sum((x - mean) ** 2 for x in window) / period
        result.append(math.sqrt(variance))

    return result
