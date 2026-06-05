# TickerNote - Annual Report Intelligence System

##  Project Overview

**FinTech Summarizer** is a comprehensive application designed to simplify financial analysis by automatically summarizing annual reports and providing an intelligent chatbot interface for direct queries. Users can upload annual reports (in PDF format) and interact with the content through an intuitive chat interface, making complex financial documents accessible and easy to understand.

### Key Features
-  **PDF Upload & Processing**: Upload annual reports and automatically extract and clean data
-  **AI-Powered Chat**: Ask questions directly about the annual report content
-  **Smart Summarization**: Generate concise summaries of complex financial reports
-  **User Management**: Create accounts and manage multiple reports
-  **Secure Access**: Email-based authentication
-  **Cloud Storage**: S3 integration for document storage
-  **Microservices Architecture**: Scalable backend with Python-based RAG service

##  System Pipeline

### Data Flow Architecture

##  System Pipeline

### Data Flow Architecture

```mermaid
flowchart TD

    %% Upload Pipeline

    A[User Uploads PDF]
    B[React Frontend]
    C[Node.js Backend]
    D[AWS S3 Storage]
    E[Python FastAPI Service]
    F[Extract PDF Text]
    G[Clean & Chunk Text]
    H[Generate Embeddings]
    I[(MongoDB)]

    A --> B
    B -->|POST /api/files/upload| C
    C --> D
    C --> E

    E --> F
    F --> G
    G --> H
    H --> I

    I --> C
    C --> B
    B --> J[Upload Success]

    %% Chat Pipeline

    K[User Asks Question]
    L[POST /api/chat/message]
    M[Semantic Search]
    N[Relevant Chunks]
    O[GPT / Gemini]
    P[Generated Answer]
    Q[Save Chat History]
    R[Display Answer]

    K --> B
    B --> L
    L --> C
    C --> E

    E --> M
    M --> I
    I --> N
    N --> O
    O --> P

    P --> E
    E --> C

    C --> Q
    Q --> I

    C --> B
    B --> R
```

### Simple End-to-End Pipeline

```mermaid
flowchart LR

    A[PDF Upload]
    --> B[S3 Storage]

    B
    --> C[Python Processing]

    C
    --> D[Text Extraction]

    D
    --> E[Chunking]

    E
    --> F[Embeddings]

    F
    --> G[(MongoDB)]

    H[User Question]
    --> I[React UI]

    I
    --> J[Node Backend]

    J
    --> K[Python RAG]

    K
    --> G

    G
    --> L[Relevant Context]

    L
    --> M[GPT / Gemini]

    M
    --> N[Answer]

    N
    --> I
```


### Component Interaction Flow
```mermaid
sequenceDiagram
    participant User
    participant Frontend as React Frontend
    participant Backend as Node.js Backend
    participant Python as Python Service
    participant DB as MongoDB
    participant S3 as AWS S3
    participant AI as OpenAI API
    
    rect rgb(200, 230, 255)
    Note over User,S3: File Upload & Processing Pipeline
    User->>Frontend: 1. Select & Upload PDF
    Frontend->>Backend: 2. POST /api/files/upload
    Backend->>S3: 3. Store Original PDF
    Backend->>Python: 4. Send file for processing
    Python->>Python: 5. Extract & Clean Text
    Python->>Python: 6. Generate Embeddings
    Python-->>Backend: 7. Return processed data
    Backend->>DB: 8. Save file metadata
    DB-->>Backend: 9. File saved
    Backend-->>Frontend: 10. Upload success
    Frontend-->>User: 11. Show file in library
    end
    
    rect rgb(200, 255, 230)
    Note over User,AI: Chat Query Pipeline
    User->>Frontend: 12. Ask question about report
    Frontend->>Backend: 13. POST /api/chat/message
    Backend->>Python: 14. Query RAG service
    Python->>Python: 15. Semantic search
    Python->>S3: 16. Retrieve relevant chunks
    Python->>AI: 17. Send context + query
    AI-->>Python: 18. Generate response
    Python-->>Backend: 19. Return answer
    Backend->>DB: 20. Save chat history
    Backend-->>Frontend: 21. Stream response
    Frontend-->>User: 22. Display answer
    end
```

### Service Architecture
```mermaid
graph LR
    subgraph "Frontend Layer"
        A[React App<br/>Port 5173]
    end
    
    subgraph "Backend Layer"
        B[Express Server<br/>Port 5000]
        B1[Auth Middleware]
        B2[File Controller]
        B3[Chat Controller]
        B4[User Controller]
    end
    
    subgraph "Data Layer"
        C[(MongoDB<br/>Collections)]
        D[S3 Bucket<br/>File Storage]
    end
    
    subgraph "AI & Processing Layer"
        E[Python FastAPI<br/>Port 8000]
        E1[PDF Processing]
        E2[LangChain RAG]
        E3[Embeddings]
    end
    
    subgraph "External Services"
        F[OpenAI API<br/>GPT-3.5-turbo]
        G[HuggingFace<br/>Embeddings]
    end
    
    A -->|REST API| B
    B --> B1
    B --> B2
    B --> B3
    B --> B4
    B2 --> D
    B3 --> E
    B -.->|Query| C
    E --> E1
    E --> E2
    E --> E3
    E1 --> D
    E2 --> F
    E3 --> G
```

##  Technology Stack

##  Technology Stack

### Frontend
- **React** 18+ with Vite
- **Tailwind CSS** - Utility-first CSS framework
- **ESLint** - Code quality
- **Markdown Parser** - Display formatted content

### Backend
- **Node.js/Express** - REST API server
- **MongoDB** - Document database
- **Amazon S3** - File storage
- **OpenAI API** - AI/NLP capabilities (free tier available)
- **Python FastAPI** - RAG service for semantic search

### Python Service
- **FastAPI** - Modern web framework
- **LangChain** - Prompt engineering & LLM integration
- **PyPDF2/PDFMiner** - PDF processing
- **Regular Expressions** - Report cleaning and parsing

##  Project Structure

```
summarizer/
├── backend/                          # Node.js Express server
│   ├── src/
│   │   ├── app.js                   # Express app configuration
│   │   ├── config/                  # Configuration files
│   │   │   ├── aiConfig.js          # AI/LLM settings
│   │   │   ├── dbConfig.js          # MongoDB connection
│   │   │   └── serverConfig.js      # Server settings
│   │   ├── controllers/             # Request handlers
│   │   │   ├── chatController.js    # Chat logic
│   │   │   ├── fileController.js    # File upload handling
│   │   │   └── userController.js    # User management
│   │   ├── middlewares/             # Express middleware
│   │   │   ├── authMiddleware.js    # JWT authentication
│   │   │   ├── errorHandler.js      # Error handling
│   │   │   └── uploadMiddleware.js  # File upload config
│   │   ├── repositories/            # Database queries
│   │   │   └── fileRepository.js    # File CRUD operations
│   │   ├── routers/                 # API routes
│   │   │   ├── chatRouter.js        # Chat endpoints
│   │   │   ├── fileRouter.js        # File endpoints
│   │   │   ├── userRouter.js        # User endpoints
│   │   │   └── Python/              # Python service routes
│   │   ├── schema/                  # MongoDB schemas
│   │   │   ├── chatSchema.js        # Chat message schema
│   │   │   ├── fileSchema.js        # File metadata schema
│   │   │   └── userSchema.js        # User schema
│   │   ├── services/                # Business logic
│   │   │   ├── aiService.js         # OpenAI integration
│   │   │   ├── pdfService.js        # PDF processing
│   │   │   ├── pythonChatService.js # Python service calls
│   │   │   ├── s3Service.js         # S3 operations
│   │   │   └── userService.js       # User operations
│   │   └── utilities/               # Helper functions
│   │       ├── markdownUtil.js      # Markdown formatting
│   │       └── sendEmail.js         # Email sending
│   ├── index.js                     # Server entry point
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                        # React + Vite application
│   ├── src/
│   │   ├── App.jsx                 # Main app component
│   │   ├── main.jsx                # Entry point
│   │   ├── Pages/
│   │   │   ├── Home.jsx            # Landing page
│   │   │   ├── Login.jsx           # Authentication
│   │   │   ├── Register.jsx        # User registration
│   │   │   ├── ChatPanel.jsx       # Chat interface
│   │   │   ├── Summarizer.jsx      # Summary display
│   │   │   ├── PythonConnectionTest.jsx  # Service testing
│   │   │   └── markdownParser.js   # Markdown rendering
│   │   └── utils/
│   │       └── api.js              # API client
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   ├── Dockerfile
│   └── .env.example
│
└── TickerNote-python-api/          # Legacy Python service
    ├── main.py                     # FastAPI server
    ├── ragService.py               # RAG implementation
    ├── reportCleaning.py           # PDF cleaning logic
    ├── Requirements.txt            # Python dependencies
    ├── Dockerfile
    └── runtime.txt
```

##  Installation Guide

### Prerequisites
- **Node.js** 16+ and npm
- **Python** 3.8+
- **MongoDB** (local or Atlas cloud database)
- **Docker** (optional, for containerization)
- Git

### Step 1: Clone & Setup Repository
```bash
git clone <repository-url>
cd summarizer
```

### Step 2: Backend Setup

#### 2.1 Install Dependencies
```bash
cd backend
npm install
```

#### 2.2 Environment Configuration
Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/summarizer
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/summarizer

# AI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo

# S3 Configuration (AWS)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Email Configuration (for notifications)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here

# Python Service URL
PYTHON_SERVICE_URL=http://localhost:8000

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

#### 2.3 Start Backend Server
```bash
npm start
# Server runs on http://localhost:5000
```

### Step 3: Python Service Setup

#### 3.1 Navigate to Python Service
```bash
cd backend/Python\ Service
# or
cd TickerNote-python-api
```

#### 3.2 Create Virtual Environment
```bash
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

#### 3.3 Install Python Dependencies
```bash
pip install -r Requirements.txt
```

#### 3.4 Start Python Service
```bash
python main.py
# Service runs on http://localhost:8000
```

### Step 4: Frontend Setup

#### 4.1 Install Dependencies
```bash
cd frontend
npm install
```

#### 4.2 Environment Configuration
Create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=FinTech Summarizer
```

#### 4.3 Start Development Server
```bash
npm run dev
# Application runs on http://localhost:5173
```

##  Docker Deployment

### Build and Run with Docker Compose
```bash
docker-compose up --build
```

### Individual Container Builds

#### Backend
```bash
cd backend
docker build -t fintech-summarizer-backend .
docker run -p 5000:5000 --env-file .env fintech-summarizer-backend
```

#### Frontend
```bash
cd frontend
docker build -t fintech-summarizer-frontend .
docker run -p 3000:80 fintech-summarizer-frontend
```

#### Python Service
```bash
cd backend/Python\ Service
docker build -t fintech-summarizer-python .
docker run -p 8000:8000 fintech-summarizer-python
```

##  API Endpoints

### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - User login
- `POST /api/users/logout` - User logout

### Files
- `POST /api/files/upload` - Upload annual report
- `GET /api/files` - List user's files
- `GET /api/files/:id` - Get file details
- `DELETE /api/files/:id` - Delete file

### Chat
- `POST /api/chat/message` - Send chat message
- `GET /api/chat/history/:fileId` - Get conversation history
- `POST /api/chat/summary` - Generate report summary

### Python Service
- `POST /api/python/analyze` - Analyze document with RAG
- `POST /api/python/extract` - Extract key information
- `GET /api/python/health` - Service health check

##  Usage Guide

### Basic Workflow

1. **Register/Login**
   - Navigate to the application
   - Create an account or login with existing credentials

2. **Upload Annual Report**
   - Click "Upload Report" button
   - Select a PDF file (annual report)
   - System automatically extracts and cleans data

3. **View Summary**
   - Access the auto-generated summary on the Summarizer page
   - Read key financial metrics and highlights

4. **Ask Questions**
   - Go to ChatPanel
   - Ask specific questions about the report
   - AI chatbot provides contextual answers based on document content

5. **Manage Reports**
   - View all uploaded reports
   - Delete reports no longer needed
   - Access previous conversations

##  Configuration Details

### OpenAI API
- **Model**: GPT-3.5-turbo (cost-effective, free tier available)
- **Purpose**: Natural language understanding and response generation
- **Free Tier**: $5 free credits for first 3 months

### MongoDB
- **Local**: Connection to localhost:27017
- **Cloud**: MongoDB Atlas free tier (M0 cluster, 512MB storage)
- **Collections**: Users, Files, Chat Messages

### AWS S3
- **Free Tier**: 5GB storage, 20,000 GET requests, 2,000 PUT requests/month
- **Bucket Policy**: Private with pre-signed URLs for secure access

### Python FastAPI
- **RAG Implementation**: Retrieval-Augmented Generation for accurate answers
- **Libraries Used**: LangChain, Hugging Face embeddings (free)
- **Processing**: PDF extraction, text cleaning, semantic search

##  Features Explained

### 1. PDF Upload & Processing
- Secure file upload with validation
- Automatic text extraction from PDFs
- Data cleaning and normalization
- Chunking for efficient processing

### 2. AI-Powered Summarization
- Extracts key financial metrics
- Generates executive summary
- Highlights risks and opportunities
- Formats in markdown for readability

### 3. Intelligent Chatbot
- Uses Retrieval-Augmented Generation (RAG)
- Semantic search across document
- Context-aware responses
- Supports follow-up questions

### 4. User Management
- Secure registration and login
- Email verification (optional)
- Profile management
- Session persistence

### 5. Cloud Storage
- Secure S3 bucket integration
- Automatic backup
- File versioning support
- Scalable storage

##  Troubleshooting

### Common Issues

**MongoDB Connection Error**
```
Solution: Ensure MongoDB is running and MONGODB_URI is correct in .env
```

**Python Service Not Responding**
```
Solution: Check if Python service is running on port 8000
Run: python backend/Python\ Service/main.py
```

**CORS Issues**
```
Solution: Verify FRONTEND_URL in backend .env matches your frontend URL
```

**OpenAI API Errors**
```
Solution: Check API key validity and rate limits at openai.com
```

**File Upload Fails**
```
Solution: Verify S3 credentials and bucket permissions
```

##  Environment Variables Summary

| Variable | Purpose | Example |
|----------|---------|---------|
| `MONGODB_URI` | Database connection | `mongodb://localhost:27017/summarizer` |
| `OPENAI_API_KEY` | AI service authentication | `sk-...` |
| `AWS_ACCESS_KEY_ID` | S3 access | Your AWS key |
| `S3_BUCKET_NAME` | File storage bucket | `my-reports-bucket` |
| `JWT_SECRET` | Authentication token key | Random string |
| `PYTHON_SERVICE_URL` | RAG service endpoint | `http://localhost:8000` |
| `FRONTEND_URL` | React app URL | `http://localhost:5173` |

##  Free Services Used

| Service | Free Tier Benefit | Link |
|---------|------------------|------|
| **OpenAI GPT-3.5** | $5 free credits (3 months) | https://openai.com |
| **MongoDB Atlas** | 512MB free cluster | https://www.mongodb.com/cloud/atlas |
| **AWS S3** | 5GB free storage/month | https://aws.amazon.com/s3 |
| **LangChain** | Open source (free) | https://www.langchain.com |
| **Hugging Face** | Free embedding models | https://huggingface.co |
| **FastAPI** | Open source framework | https://fastapi.tiangolo.com |
| **React** | Open source library | https://react.dev |
| **Node.js** | Open source runtime | https://nodejs.org |

##  Additional Resources

- [OpenAI Documentation](https://platform.openai.com/docs)
- [MongoDB Documentation](https://docs.mongodb.com)
- [FastAPI Guide](https://fastapi.tiangolo.com)
- [React Documentation](https://react.dev)
- [AWS S3 Guide](https://docs.aws.amazon.com/s3)

##  Contributing

Contributions are welcome! Please follow these guidelines:
1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

##  License

This project is open source and available under the MIT License.

##  Support

For issues, questions, or suggestions:
1. Check the Troubleshooting section
2. Review API documentation
3. Check logs in backend and frontend consoles
4. Verify all environment variables are set correctly

---

**Happy Report Summarizing! **
