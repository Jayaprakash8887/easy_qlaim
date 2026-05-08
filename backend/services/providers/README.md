# Multi-Vendor Provider Architecture

This document describes the multi-vendor provider abstraction layer that enables the Easy Qlaim to be deployed on various cloud platforms.

## Overview

The system supports multiple cloud providers and AI services through an abstraction layer. This allows you to:

1. **Deploy on any major cloud**: Azure, AWS, or GCP
2. **Choose your preferred AI provider**: Google Gemini, OpenAI, Azure OpenAI, Anthropic Claude, AWS Bedrock, or local Ollama
3. **Select your OCR solution**: Cloud-based (Google Vision, Azure Computer Vision, AWS Textract) or local (Tesseract)
4. **Mix and match**: Use Azure Storage with OpenAI and Tesseract OCR, for example

## Quick Start

### 1. Set Provider Selection in Environment

```bash
# Storage Provider: gcs | azure | aws | local
STORAGE_PROVIDER=azure

# LLM Provider: gemini | openai | azure_openai | anthropic | bedrock | ollama
LLM_PROVIDER=azure_openai

# Vision/OCR Provider: google-vision | azure-vision | textract | tesseract
VISION_PROVIDER=tesseract
```

### 2. Configure Your Chosen Providers

See `.env.example` for all available configuration options.

## Storage Providers

### Google Cloud Storage (GCS)
```bash
STORAGE_PROVIDER=gcs
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-bucket-name
GCP_CREDENTIALS_PATH=/path/to/credentials.json
```

### Azure Blob Storage
```bash
STORAGE_PROVIDER=azure
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
# OR
AZURE_STORAGE_ACCOUNT_NAME=your-account
AZURE_STORAGE_ACCOUNT_KEY=your-key
AZURE_STORAGE_CONTAINER=documents
```

### AWS S3
```bash
STORAGE_PROVIDER=aws
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
# Optional - leave empty to use IAM roles
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Local Storage (Development)
```bash
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=./uploads
```

## LLM Providers

### Google Gemini (Default)
```bash
LLM_PROVIDER=gemini
GOOGLE_API_KEY=your-api-key
GEMINI_MODEL=gemini-2.0-flash-exp
GEMINI_TEMPERATURE=0.7
GEMINI_MAX_TOKENS=5000
```

### OpenAI
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=4096
```

### Azure OpenAI
```bash
LLM_PROVIDER=azure_openai
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4-deployment
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

### Anthropic Claude
```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### AWS Bedrock
```bash
LLM_PROVIDER=bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
AWS_REGION=us-east-1
```

### Ollama (Local)
```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

## Vision/OCR Providers

### Google Cloud Vision
```bash
VISION_PROVIDER=google-vision
GCP_CREDENTIALS_PATH=/path/to/credentials.json
GCP_PROJECT_ID=your-project-id
```

### Azure Computer Vision
```bash
VISION_PROVIDER=azure-vision
AZURE_VISION_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_VISION_API_KEY=your-api-key
```

### AWS Textract
```bash
VISION_PROVIDER=textract
AWS_REGION=us-east-1
```

### Tesseract (Local - Default)
```bash
VISION_PROVIDER=tesseract
TESSERACT_LANG=eng
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application Layer                           │
│     (FastAPI Routes, Business Logic, AI Agents)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Service Layer                                │
│    storage.py, base_agent.py, document_processor.py            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Provider Abstraction Layer                      │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐      │
│  │   Storage    │  │     LLM      │  │     Vision       │      │
│  │   Provider   │  │   Provider   │  │    Provider      │      │
│  └──────────────┘  └──────────────┘  └──────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │    GCS      │    │   Gemini    │    │   Google    │
   │    Azure    │    │   OpenAI    │    │   Vision    │
   │    AWS S3   │    │   Claude    │    │   Azure CV  │
   │    Local    │    │   Bedrock   │    │   Textract  │
   │             │    │   Ollama    │    │   Tesseract │
   └─────────────┘    └─────────────┘    └─────────────┘
```

## Files Structure

```
backend/
├── services/
│   ├── providers/
│   │   ├── __init__.py              # Provider exports
│   │   ├── storage_provider.py      # Storage abstraction
│   │   ├── llm_provider.py          # LLM abstraction
│   │   └── vision_provider.py       # Vision/OCR abstraction
│   └── storage.py                   # Updated to use providers
├── agents/
│   └── base_agent.py                # Updated to use LLM provider
├── config.py                        # All provider configurations
└── .env.example                     # Example environment variables
```

## Installation

### Core Dependencies
```bash
pip install -r requirements.txt
```

### Provider-Specific Dependencies

**For Azure:**
```bash
pip install azure-storage-blob azure-identity azure-cognitiveservices-vision-computervision azure-ai-formrecognizer
```

**For AWS:**
```bash
pip install boto3
```

**For OpenAI:**
```bash
pip install openai
```

**For Anthropic:**
```bash
pip install anthropic
```

**For Google Cloud (already included):**
```bash
pip install google-cloud-storage google-generativeai google-cloud-vision
```

## Usage Examples

### Using Storage Provider
```python
from services.providers import get_storage_provider

storage = get_storage_provider()
path, blob_name = storage.upload_file(file_path, claim_id, filename)
url = storage.get_signed_url(blob_name)
```

### Using LLM Provider
```python
from services.providers import get_llm_provider

llm = get_llm_provider()
response = await llm.generate(prompt, system_instruction="You are a helpful assistant")
```

### Using Vision Provider
```python
from services.providers import get_vision_provider

vision = get_vision_provider()
result = await vision.extract_text(image_bytes)
print(result.text)
```

## Migration from GCS-only Setup

If you're migrating from the original GCS-only setup:

1. No code changes required - the default configuration uses GCS
2. Set `STORAGE_PROVIDER=gcs` to maintain current behavior
3. Gradually migrate to new providers as needed

## Best Practices

1. **Use Environment Variables**: Never hardcode credentials
2. **Test Locally First**: Use `STORAGE_PROVIDER=local` and `LLM_PROVIDER=ollama` for development
3. **Handle Errors Gracefully**: All providers implement fallback mechanisms
4. **Monitor Costs**: Cloud providers have different pricing models
5. **Use IAM Roles**: When deploying to cloud, prefer IAM roles over API keys

## Troubleshooting

### Provider Not Found
```
Unknown provider 'xyz', falling back to default
```
Check that the provider name is correct and the required packages are installed.

### Import Errors
If you see import errors, install the required package:
```bash
pip install <package-name>
```

### Authentication Errors
Verify your credentials are set correctly in environment variables or credential files.

## Contributing

When adding new providers:

1. Create a new class inheriting from the base provider
2. Implement all abstract methods
3. Add configuration options to `config.py`
4. Update the factory function in the provider module
5. Document in this file
