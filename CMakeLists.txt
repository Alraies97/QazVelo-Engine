cmake_minimum_required(VERSION 3.15)
project(QazVeloEngineCpp VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

find_package(Python3 COMPONENTS Interpreter Development.Module REQUIRED)

execute_process(
    COMMAND python3 -c "import pybind11; print(pybind11.get_cmake_dir())"
    OUTPUT_VARIABLE PYBIND11_CMAKE_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

set(CMAKE_PREFIX_PATH ${CMAKE_PREFIX_PATH} ${PYBIND11_CMAKE_DIR})

find_package(pybind11 REQUIRED)

set(SOURCE_FILES
    src_cpp/analytics.cpp
    src_cpp/bindings.cpp
)

pybind11_add_module(qazvelo_analytics ${SOURCE_FILES})

target_include_directories(qazvelo_analytics PRIVATE src_cpp)

if(NOT MSVC)
    target_compile_options(qazvelo_analytics PRIVATE $<$<CONFIG:Release>:-O3>)
endif()

execute_process(
    COMMAND "${Python3_EXECUTABLE}" -c "import sysconfig; print(sysconfig.get_path('platlib'))"
    OUTPUT_VARIABLE PYTHON_SITE_PACKAGES
    OUTPUT_STRIP_TRAILING_WHITESPACE
)
install(TARGETS qazvelo_analytics
        LIBRARY DESTINATION "${PYTHON_SITE_PACKAGES}"
        RUNTIME DESTINATION "${PYTHON_SITE_PACKAGES}"
       )