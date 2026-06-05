cmake_minimum_required(VERSION 3.15)
project(QazVeloEngineCpp VERSION 0.1.0)

set(CMAKE_CXX_STRANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CMAKE_BUILD_TYPE Release)
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -march=native")

find_package(Python3 COMPONENTS Interpreter Development.Module REQUIRED)
find_package(pybind11 REQUIRED)

set(SOURCE_FILES
    src_cpp/analytics.cpp
    src_cpp/bindings.cpp
)

pybind11_add_module(qazvelo_analytics ${SOURCE_FILES})

target_include_directories(qazvelo_analytics PRIVATE src_cpp)