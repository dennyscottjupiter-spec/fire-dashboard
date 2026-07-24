/* ============================================================
   FIRE Dashboard — data.js
   Vendored historical market data for Monte Carlo + backtesting.
   Load BEFORE engine.js.

   HIST: annual S&P 500 TOTAL return (price + reinvested dividends)
   paired with US CPI year-over-year inflation, 1926–2023.

   Source: public S&P 500 total-return and US BLS CPI series
   (Damodaran/NYU Stern, Shiller, slickcharts). Figures are rounded
   historical approximations for illustration — the US market is used
   as a long-history proxy. Past performance ≠ future results.

   Values are decimals: ret 0.116 = +11.6%, infl 0.011 = +1.1%.
   ============================================================ */

'use strict';

const HIST = [
  { year: 1926, ret:  0.116, infl: -0.011 },
  { year: 1927, ret:  0.375, infl: -0.023 },
  { year: 1928, ret:  0.436, infl: -0.012 },
  { year: 1929, ret: -0.084, infl:  0.000 },
  { year: 1930, ret: -0.249, infl: -0.027 },
  { year: 1931, ret: -0.433, infl: -0.089 },
  { year: 1932, ret: -0.082, infl: -0.103 },
  { year: 1933, ret:  0.540, infl: -0.052 },
  { year: 1934, ret: -0.014, infl:  0.035 },
  { year: 1935, ret:  0.477, infl:  0.026 },
  { year: 1936, ret:  0.339, infl:  0.010 },
  { year: 1937, ret: -0.350, infl:  0.037 },
  { year: 1938, ret:  0.311, infl: -0.020 },
  { year: 1939, ret: -0.004, infl: -0.013 },
  { year: 1940, ret: -0.098, infl:  0.007 },
  { year: 1941, ret: -0.116, infl:  0.099 },
  { year: 1942, ret:  0.203, infl:  0.090 },
  { year: 1943, ret:  0.259, infl:  0.030 },
  { year: 1944, ret:  0.198, infl:  0.023 },
  { year: 1945, ret:  0.364, infl:  0.022 },
  { year: 1946, ret: -0.081, infl:  0.181 },
  { year: 1947, ret:  0.057, infl:  0.088 },
  { year: 1948, ret:  0.055, infl:  0.030 },
  { year: 1949, ret:  0.188, infl: -0.021 },
  { year: 1950, ret:  0.317, infl:  0.059 },
  { year: 1951, ret:  0.240, infl:  0.060 },
  { year: 1952, ret:  0.184, infl:  0.008 },
  { year: 1953, ret: -0.010, infl:  0.007 },
  { year: 1954, ret:  0.526, infl: -0.007 },
  { year: 1955, ret:  0.316, infl:  0.004 },
  { year: 1956, ret:  0.066, infl:  0.030 },
  { year: 1957, ret: -0.108, infl:  0.029 },
  { year: 1958, ret:  0.434, infl:  0.018 },
  { year: 1959, ret:  0.120, infl:  0.017 },
  { year: 1960, ret:  0.005, infl:  0.014 },
  { year: 1961, ret:  0.269, infl:  0.007 },
  { year: 1962, ret: -0.087, infl:  0.013 },
  { year: 1963, ret:  0.228, infl:  0.016 },
  { year: 1964, ret:  0.165, infl:  0.010 },
  { year: 1965, ret:  0.125, infl:  0.019 },
  { year: 1966, ret: -0.101, infl:  0.035 },
  { year: 1967, ret:  0.240, infl:  0.030 },
  { year: 1968, ret:  0.111, infl:  0.047 },
  { year: 1969, ret: -0.085, infl:  0.062 },
  { year: 1970, ret:  0.040, infl:  0.056 },
  { year: 1971, ret:  0.143, infl:  0.033 },
  { year: 1972, ret:  0.190, infl:  0.034 },
  { year: 1973, ret: -0.147, infl:  0.087 },
  { year: 1974, ret: -0.265, infl:  0.123 },
  { year: 1975, ret:  0.372, infl:  0.069 },
  { year: 1976, ret:  0.238, infl:  0.049 },
  { year: 1977, ret: -0.072, infl:  0.067 },
  { year: 1978, ret:  0.066, infl:  0.090 },
  { year: 1979, ret:  0.184, infl:  0.133 },
  { year: 1980, ret:  0.324, infl:  0.125 },
  { year: 1981, ret: -0.049, infl:  0.089 },
  { year: 1982, ret:  0.214, infl:  0.038 },
  { year: 1983, ret:  0.225, infl:  0.038 },
  { year: 1984, ret:  0.063, infl:  0.039 },
  { year: 1985, ret:  0.322, infl:  0.038 },
  { year: 1986, ret:  0.185, infl:  0.011 },
  { year: 1987, ret:  0.052, infl:  0.044 },
  { year: 1988, ret:  0.168, infl:  0.044 },
  { year: 1989, ret:  0.315, infl:  0.046 },
  { year: 1990, ret: -0.031, infl:  0.061 },
  { year: 1991, ret:  0.305, infl:  0.031 },
  { year: 1992, ret:  0.076, infl:  0.029 },
  { year: 1993, ret:  0.101, infl:  0.027 },
  { year: 1994, ret:  0.013, infl:  0.027 },
  { year: 1995, ret:  0.376, infl:  0.025 },
  { year: 1996, ret:  0.230, infl:  0.033 },
  { year: 1997, ret:  0.334, infl:  0.017 },
  { year: 1998, ret:  0.286, infl:  0.016 },
  { year: 1999, ret:  0.210, infl:  0.027 },
  { year: 2000, ret: -0.091, infl:  0.034 },
  { year: 2001, ret: -0.119, infl:  0.016 },
  { year: 2002, ret: -0.221, infl:  0.024 },
  { year: 2003, ret:  0.287, infl:  0.019 },
  { year: 2004, ret:  0.109, infl:  0.033 },
  { year: 2005, ret:  0.049, infl:  0.034 },
  { year: 2006, ret:  0.158, infl:  0.025 },
  { year: 2007, ret:  0.055, infl:  0.041 },
  { year: 2008, ret: -0.370, infl:  0.001 },
  { year: 2009, ret:  0.265, infl:  0.027 },
  { year: 2010, ret:  0.151, infl:  0.015 },
  { year: 2011, ret:  0.021, infl:  0.030 },
  { year: 2012, ret:  0.160, infl:  0.017 },
  { year: 2013, ret:  0.324, infl:  0.015 },
  { year: 2014, ret:  0.137, infl:  0.008 },
  { year: 2015, ret:  0.014, infl:  0.007 },
  { year: 2016, ret:  0.120, infl:  0.021 },
  { year: 2017, ret:  0.218, infl:  0.021 },
  { year: 2018, ret: -0.044, infl:  0.019 },
  { year: 2019, ret:  0.315, infl:  0.023 },
  { year: 2020, ret:  0.184, infl:  0.014 },
  { year: 2021, ret:  0.287, infl:  0.070 },
  { year: 2022, ret: -0.181, infl:  0.065 },
  { year: 2023, ret:  0.263, infl:  0.034 },
];

// Infamous retirement start years for the historical replay dropdown.
// `span` (v2.5) — the crash window length in years, replayed verbatim from
// `year` once the user clicks the chart to place it. Sized to the actual
// down-years in HIST for that vintage (e.g. 2008: -37% then +27% rebound).
const VINTAGES = [
  { year: 1929, label: '1929 💀 Great Crash',       span: 4 },
  { year: 1966, label: '1966 🪫 Stagflation era',    span: 8 },
  { year: 1973, label: '1973 🛢️ Oil shock',          span: 2 },
  { year: 2000, label: '2000 💻 Dot-com bust',       span: 3 },
  { year: 2008, label: '2008 🏚️ Global Financial Crisis', span: 2 },
];
