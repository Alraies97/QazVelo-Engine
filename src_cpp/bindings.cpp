#include <pybind11/pybind11.h>
#include <pybind11/stl.h>

std::vector<double> calculate_sma(const std::vector<double>& prices, int period);
std::vector<double> calculate_volatility(const std::vector<double>& prices, int period);


PYBIND11_MODULE(qazvelo_analytics, m) {
    m.doc() = "QazVelo-Engine High-Performance C++ Core Analytics Engine";
    
    m.def("calculate_sma", &calculate_sma, "Calculate SMA using C++",
          py::arg("prices"), py::arg("period"));
          
    m.def("calculate_volatility", &calculate_volatility, "Calculate Volatility using C++",
          py::arg("prices"), py::arg("period"));
}
