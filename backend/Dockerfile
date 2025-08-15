# Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY . .
RUN pip install --upgrade pip setuptools \
	&& pip install --no-cache-dir -r requirements.txt

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
