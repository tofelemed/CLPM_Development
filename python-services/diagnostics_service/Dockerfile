FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml /app/
RUN pip install --upgrade pip && pip install --no-cache-dir fastapi uvicorn numpy scipy pydantic
COPY src /app/
EXPOSE 8050
CMD ["python", "-m", "uvicorn", "diagnostics_service.app:app", "--host", "0.0.0.0", "--port", "8050"]
