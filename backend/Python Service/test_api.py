import requests
import json

def test_pdf_processing():
    url = "http://127.0.0.1:8000/process-pdf/"   
    file_path = "your_sample.pdf"                

    with open(file_path, "rb") as f:
        files = {"file": (file_path, f, "application/pdf")}
        response = requests.post(url, files=files)

    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print(" Success! JSONL received")
        print(f"Content-Type: {response.headers.get('content-type')}")
        print(f"Content-Length: {len(response.content)} bytes")
        
        # Save to file
        with open("test_output.jsonl", "wb") as f:
            f.write(response.content)
        
        # Parse and show first few chunks
        chunks = response.content.decode('utf-8').splitlines()
        print(f"\nTotal chunks received: {len(chunks)}")
        
        print("\n--- First Chunk Preview ---")
        print(json.dumps(json.loads(chunks[0]), indent=2))
        
    else:
        print("Error:", response.text)

if __name__ == "__main__":
    test_pdf_processing()