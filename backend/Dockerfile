# Use a base image with Python and C++ compilers
FROM python:3.11-slim as builder

# Install system dependencies for OpenCV and Pybind11 compilation
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopencv-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# Copy source code and build pybind11 module
COPY setup.py .
COPY src/ src/
RUN pip install pybind11
RUN python setup.py build_ext --inplace
# Move the compiled .so file to src/
RUN mv pruner.*.so src/ 2>/dev/null || true

# Production stage
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libopencv-core4.0 \
    libopencv-imgproc4.0 \
    libopencv-videoio4.0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache /wheels/*

COPY --from=builder /app/src ./src
COPY .env.example .env

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
