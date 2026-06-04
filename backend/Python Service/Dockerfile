FROM python:3.11

WORKDIR /app

COPY Requirements.txt .
RUN pip install -r Requirements.txt

COPY . .

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]