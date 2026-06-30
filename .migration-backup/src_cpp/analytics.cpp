#include <vector>
#include <numeric>
#include <cmath>
#include <stdexcept>

std::vector<double> calculate_sma(const std::vector<double>& prices, int period)
{
    std::vector<double> sma_result;
    
    if (prices.size()<static_cast<size_t>(period)|| period <= 0)
    {
       return sma_result;
    }

    sma_result.reserve(prices.size() - period + 1);

    double current_sum = std::accumulate(prices.begin(), prices.begin() + period, 0.0);
    sma_result.push_back(current_sum / period);

    for (size_t i = period; i < prices.size(); ++i)
    {
        current_sum += prices[i] - prices[i - period];
        sma_result.push_back(current_sum / period);
    }

    return sma_result;
} 


std::vector<double> calculate_volatility(const std::vector<double>& prices, int period)
{
    std::vector<double> volatility_result;
    
    if (prices.size() < static_cast<size_t>(period) || period <= 1)
    {
        return volatility_result;
    }

    volatility_result.reserve(prices.size()- period + 1);

    for (size_t i=0; i <= prices.size() - period; ++i)
    {
         double sum= 0.0;
         for (size_t j = i; j < i + period; ++j)
         {
            sum += prices[j];
         }
         double mean = sum / period;
         
         double variance_sum = 0.0;
         for (size_t j=i; j < i + period; ++j)
         {
            variance_sum += std::pow(prices[j] - mean, 2);
         }

         volatility_result.push_back(std::sqrt(variance_sum / (period - 1)));

    }

    return volatility_result;
}