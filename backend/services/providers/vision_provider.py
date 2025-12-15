"""
Vision/OCR Provider Abstraction Layer

Supports:
- Google Cloud Vision
- Azure Computer Vision
- AWS Textract
- Tesseract (local - default)
"""
import os
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional, Dict, Any, List, Union, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class OCRResult:
    """Standardized OCR result"""
    text: str
    confidence: float = 0.0
    blocks: List[Dict[str, Any]] = field(default_factory=list)
    language: Optional[str] = None
    raw_response: Optional[Dict] = None


@dataclass
class DocumentAnalysisResult:
    """Standardized document analysis result"""
    text: str
    tables: List[Dict[str, Any]] = field(default_factory=list)
    key_value_pairs: Dict[str, str] = field(default_factory=dict)
    entities: List[Dict[str, Any]] = field(default_factory=list)
    confidence: float = 0.0
    raw_response: Optional[Dict] = None


class VisionProvider(ABC):
    """Abstract base class for Vision/OCR providers"""
    
    @abstractmethod
    async def extract_text(
        self,
        image_data: Union[bytes, Path, str],  # bytes, file path, or URL
    ) -> OCRResult:
        """Extract text from an image"""
        pass
    
    @abstractmethod
    async def analyze_document(
        self,
        document_data: Union[bytes, Path, str],
    ) -> DocumentAnalysisResult:
        """Analyze a document for structured data"""
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """Get the provider name"""
        pass


class GoogleVisionProvider(VisionProvider):
    """Google Cloud Vision provider"""
    
    def __init__(
        self,
        credentials_path: Optional[str] = None,
        project_id: Optional[str] = None
    ):
        self.credentials_path = credentials_path
        self.project_id = project_id
        self._client = None
        self._init_client()
    
    def _init_client(self):
        try:
            from google.cloud import vision
            from google.oauth2 import service_account
            
            creds_path = self.credentials_path
            
            # Try to find credentials file
            if creds_path:
                if not os.path.exists(creds_path):
                    backend_dir = Path(__file__).parent.parent.parent
                    potential_path = backend_dir / creds_path
                    if potential_path.exists():
                        creds_path = str(potential_path)
                    else:
                        project_root = backend_dir.parent
                        potential_path = project_root / creds_path.lstrip('../')
                        if potential_path.exists():
                            creds_path = str(potential_path)
            
            if creds_path and os.path.exists(creds_path):
                credentials = service_account.Credentials.from_service_account_file(creds_path)
                self._client = vision.ImageAnnotatorClient(credentials=credentials)
                logger.info(f"Google Vision client initialized with credentials from {creds_path}")
            else:
                self._client = vision.ImageAnnotatorClient()
                logger.info("Google Vision client initialized with default credentials")
                
        except ImportError:
            logger.error("google-cloud-vision package not installed. Run: pip install google-cloud-vision")
        except Exception as e:
            logger.error(f"Failed to initialize Google Vision client: {e}")
    
    async def extract_text(
        self,
        image_data: Union[bytes, Path, str],
    ) -> OCRResult:
        if not self._client:
            return OCRResult(text="", confidence=0.0)
        
        try:
            from google.cloud import vision
            import asyncio
            
            image = vision.Image()
            
            if isinstance(image_data, bytes):
                image.content = image_data
            elif isinstance(image_data, (Path, str)):
                path = Path(image_data)
                if path.exists():
                    with open(path, 'rb') as f:
                        image.content = f.read()
                elif str(image_data).startswith(('http://', 'https://', 'gs://')):
                    image.source.image_uri = str(image_data)
                else:
                    raise ValueError(f"Invalid image path: {image_data}")
            
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                self._client.document_text_detection,
                image
            )
            
            if response.error.message:
                logger.error(f"Google Vision error: {response.error.message}")
                return OCRResult(text="", confidence=0.0)
            
            text = response.full_text_annotation.text if response.full_text_annotation else ""
            
            # Extract blocks
            blocks = []
            if response.full_text_annotation:
                for page in response.full_text_annotation.pages:
                    for block in page.blocks:
                        block_text = ""
                        for paragraph in block.paragraphs:
                            for word in paragraph.words:
                                word_text = "".join([symbol.text for symbol in word.symbols])
                                block_text += word_text + " "
                        blocks.append({
                            "text": block_text.strip(),
                            "confidence": block.confidence,
                            "bounding_box": [(v.x, v.y) for v in block.bounding_box.vertices]
                        })
            
            avg_confidence = sum(b.get("confidence", 0) for b in blocks) / len(blocks) if blocks else 0
            
            return OCRResult(
                text=text,
                confidence=avg_confidence,
                blocks=blocks,
                raw_response={"text_annotations": [ann.description for ann in response.text_annotations]}
            )
            
        except Exception as e:
            logger.error(f"Google Vision OCR error: {e}")
            return OCRResult(text="", confidence=0.0)
    
    async def analyze_document(
        self,
        document_data: Union[bytes, Path, str],
    ) -> DocumentAnalysisResult:
        # Google Vision doesn't have document analysis like Azure/AWS
        # Use text extraction instead
        ocr_result = await self.extract_text(document_data)
        return DocumentAnalysisResult(
            text=ocr_result.text,
            confidence=ocr_result.confidence,
            raw_response=ocr_result.raw_response
        )
    
    def get_provider_name(self) -> str:
        return "google-vision"


class AzureComputerVisionProvider(VisionProvider):
    """Azure Computer Vision provider"""
    
    def __init__(
        self,
        endpoint: str,
        api_key: str
    ):
        self.endpoint = endpoint
        self.api_key = api_key
        self._client = None
        self._doc_client = None
        self._init_client()
    
    def _init_client(self):
        try:
            from azure.cognitiveservices.vision.computervision import ComputerVisionClient
            from azure.ai.formrecognizer import DocumentAnalysisClient
            from azure.core.credentials import AzureKeyCredential
            from msrest.authentication import CognitiveServicesCredentials
            
            # Computer Vision client for OCR
            self._client = ComputerVisionClient(
                self.endpoint,
                CognitiveServicesCredentials(self.api_key)
            )
            
            # Document Intelligence client for document analysis
            self._doc_client = DocumentAnalysisClient(
                endpoint=self.endpoint.replace('/vision/', '/formrecognizer/'),
                credential=AzureKeyCredential(self.api_key)
            )
            
            logger.info("Azure Computer Vision client initialized")
            
        except ImportError:
            logger.error("Azure packages not installed. Run: pip install azure-cognitiveservices-vision-computervision azure-ai-formrecognizer")
        except Exception as e:
            logger.error(f"Failed to initialize Azure Computer Vision client: {e}")
    
    async def extract_text(
        self,
        image_data: Union[bytes, Path, str],
    ) -> OCRResult:
        if not self._client:
            return OCRResult(text="", confidence=0.0)
        
        try:
            import asyncio
            from azure.cognitiveservices.vision.computervision.models import OperationStatusCodes
            import time
            
            # Prepare image
            if isinstance(image_data, bytes):
                import io
                image_stream = io.BytesIO(image_data)
                read_operation = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self._client.read_in_stream(image_stream, raw=True)
                )
            elif isinstance(image_data, (Path, str)):
                path = Path(image_data)
                if path.exists():
                    with open(path, 'rb') as f:
                        import io
                        image_stream = io.BytesIO(f.read())
                    read_operation = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self._client.read_in_stream(image_stream, raw=True)
                    )
                else:
                    read_operation = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self._client.read(str(image_data), raw=True)
                    )
            
            # Get operation ID
            operation_id = read_operation.headers["Operation-Location"].split("/")[-1]
            
            # Wait for result
            while True:
                result = await asyncio.get_event_loop().run_in_executor(
                    None,
                    self._client.get_read_result,
                    operation_id
                )
                if result.status not in [OperationStatusCodes.running, OperationStatusCodes.not_started]:
                    break
                await asyncio.sleep(0.5)
            
            # Extract text
            text_lines = []
            blocks = []
            total_confidence = 0
            word_count = 0
            
            if result.status == OperationStatusCodes.succeeded:
                for page in result.analyze_result.read_results:
                    for line in page.lines:
                        text_lines.append(line.text)
                        for word in line.words:
                            total_confidence += word.confidence
                            word_count += 1
                        blocks.append({
                            "text": line.text,
                            "confidence": sum(w.confidence for w in line.words) / len(line.words) if line.words else 0,
                            "bounding_box": line.bounding_box
                        })
            
            avg_confidence = total_confidence / word_count if word_count > 0 else 0
            
            return OCRResult(
                text="\n".join(text_lines),
                confidence=avg_confidence,
                blocks=blocks
            )
            
        except Exception as e:
            logger.error(f"Azure Computer Vision OCR error: {e}")
            return OCRResult(text="", confidence=0.0)
    
    async def analyze_document(
        self,
        document_data: Union[bytes, Path, str],
    ) -> DocumentAnalysisResult:
        if not self._doc_client:
            return DocumentAnalysisResult(text="", confidence=0.0)
        
        try:
            import asyncio
            
            # Prepare document
            if isinstance(document_data, bytes):
                poller = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self._doc_client.begin_analyze_document("prebuilt-document", document_data)
                )
            elif isinstance(document_data, (Path, str)):
                path = Path(document_data)
                if path.exists():
                    with open(path, 'rb') as f:
                        doc_bytes = f.read()
                    poller = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self._doc_client.begin_analyze_document("prebuilt-document", doc_bytes)
                    )
                else:
                    poller = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self._doc_client.begin_analyze_document_from_url("prebuilt-document", str(document_data))
                    )
            
            # Wait for result
            result = await asyncio.get_event_loop().run_in_executor(None, poller.result)
            
            # Extract data
            text = result.content if result.content else ""
            
            # Extract tables
            tables = []
            for table in result.tables:
                table_data = {
                    "rows": table.row_count,
                    "columns": table.column_count,
                    "cells": []
                }
                for cell in table.cells:
                    table_data["cells"].append({
                        "row": cell.row_index,
                        "column": cell.column_index,
                        "text": cell.content,
                        "confidence": cell.confidence
                    })
                tables.append(table_data)
            
            # Extract key-value pairs
            key_value_pairs = {}
            for kv in result.key_value_pairs:
                if kv.key and kv.value:
                    key_value_pairs[kv.key.content] = kv.value.content
            
            return DocumentAnalysisResult(
                text=text,
                tables=tables,
                key_value_pairs=key_value_pairs,
                confidence=result.confidence if hasattr(result, 'confidence') else 0
            )
            
        except Exception as e:
            logger.error(f"Azure Document Analysis error: {e}")
            return DocumentAnalysisResult(text="", confidence=0.0)
    
    def get_provider_name(self) -> str:
        return "azure-computer-vision"


class AWSTextractProvider(VisionProvider):
    """AWS Textract provider"""
    
    def __init__(
        self,
        region: str = "us-east-1",
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None
    ):
        self.region = region
        self._client = None
        self._init_client(access_key_id, secret_access_key)
    
    def _init_client(
        self,
        access_key_id: Optional[str],
        secret_access_key: Optional[str]
    ):
        try:
            import boto3
            
            if access_key_id and secret_access_key:
                self._client = boto3.client(
                    'textract',
                    region_name=self.region,
                    aws_access_key_id=access_key_id,
                    aws_secret_access_key=secret_access_key
                )
            else:
                self._client = boto3.client('textract', region_name=self.region)
            
            logger.info("AWS Textract client initialized")
            
        except ImportError:
            logger.error("boto3 package not installed. Run: pip install boto3")
        except Exception as e:
            logger.error(f"Failed to initialize AWS Textract client: {e}")
    
    async def extract_text(
        self,
        image_data: Union[bytes, Path, str],
    ) -> OCRResult:
        if not self._client:
            return OCRResult(text="", confidence=0.0)
        
        try:
            import asyncio
            
            # Prepare image
            if isinstance(image_data, bytes):
                document = {'Bytes': image_data}
            elif isinstance(image_data, (Path, str)):
                path = Path(image_data)
                if path.exists():
                    with open(path, 'rb') as f:
                        document = {'Bytes': f.read()}
                elif str(image_data).startswith('s3://'):
                    # S3 URI
                    parts = str(image_data).replace('s3://', '').split('/', 1)
                    document = {'S3Object': {'Bucket': parts[0], 'Name': parts[1]}}
                else:
                    raise ValueError(f"Invalid image path: {image_data}")
            
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._client.detect_document_text(Document=document)
            )
            
            # Extract text
            lines = []
            blocks = []
            total_confidence = 0
            line_count = 0
            
            for block in response['Blocks']:
                if block['BlockType'] == 'LINE':
                    lines.append(block['Text'])
                    total_confidence += block['Confidence']
                    line_count += 1
                    blocks.append({
                        "text": block['Text'],
                        "confidence": block['Confidence'] / 100,
                        "bounding_box": block.get('Geometry', {}).get('BoundingBox', {})
                    })
            
            avg_confidence = (total_confidence / line_count / 100) if line_count > 0 else 0
            
            return OCRResult(
                text="\n".join(lines),
                confidence=avg_confidence,
                blocks=blocks,
                raw_response=response
            )
            
        except Exception as e:
            logger.error(f"AWS Textract OCR error: {e}")
            return OCRResult(text="", confidence=0.0)
    
    async def analyze_document(
        self,
        document_data: Union[bytes, Path, str],
    ) -> DocumentAnalysisResult:
        if not self._client:
            return DocumentAnalysisResult(text="", confidence=0.0)
        
        try:
            import asyncio
            
            # Prepare document
            if isinstance(document_data, bytes):
                document = {'Bytes': document_data}
            elif isinstance(document_data, (Path, str)):
                path = Path(document_data)
                if path.exists():
                    with open(path, 'rb') as f:
                        document = {'Bytes': f.read()}
                elif str(document_data).startswith('s3://'):
                    parts = str(document_data).replace('s3://', '').split('/', 1)
                    document = {'S3Object': {'Bucket': parts[0], 'Name': parts[1]}}
                else:
                    raise ValueError(f"Invalid document path: {document_data}")
            
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._client.analyze_document(
                    Document=document,
                    FeatureTypes=['TABLES', 'FORMS']
                )
            )
            
            # Extract text
            lines = []
            key_value_pairs = {}
            tables = []
            
            # Build block map
            blocks_map = {block['Id']: block for block in response['Blocks']}
            
            for block in response['Blocks']:
                if block['BlockType'] == 'LINE':
                    lines.append(block['Text'])
                elif block['BlockType'] == 'KEY_VALUE_SET':
                    if 'KEY' in block.get('EntityTypes', []):
                        key_text = self._get_text_from_block(block, blocks_map)
                        value_block = self._find_value_block(block, blocks_map)
                        if value_block:
                            value_text = self._get_text_from_block(value_block, blocks_map)
                            key_value_pairs[key_text] = value_text
                elif block['BlockType'] == 'TABLE':
                    table_data = self._extract_table(block, blocks_map)
                    tables.append(table_data)
            
            return DocumentAnalysisResult(
                text="\n".join(lines),
                tables=tables,
                key_value_pairs=key_value_pairs,
                raw_response=response
            )
            
        except Exception as e:
            logger.error(f"AWS Textract document analysis error: {e}")
            return DocumentAnalysisResult(text="", confidence=0.0)
    
    def _get_text_from_block(self, block: Dict, blocks_map: Dict) -> str:
        text = ""
        if 'Relationships' in block:
            for rel in block['Relationships']:
                if rel['Type'] == 'CHILD':
                    for child_id in rel['Ids']:
                        child_block = blocks_map.get(child_id)
                        if child_block and child_block['BlockType'] == 'WORD':
                            text += child_block.get('Text', '') + " "
        return text.strip()
    
    def _find_value_block(self, key_block: Dict, blocks_map: Dict) -> Optional[Dict]:
        if 'Relationships' in key_block:
            for rel in key_block['Relationships']:
                if rel['Type'] == 'VALUE':
                    for value_id in rel['Ids']:
                        return blocks_map.get(value_id)
        return None
    
    def _extract_table(self, table_block: Dict, blocks_map: Dict) -> Dict:
        table_data = {"cells": [], "rows": 0, "columns": 0}
        
        if 'Relationships' in table_block:
            for rel in table_block['Relationships']:
                if rel['Type'] == 'CHILD':
                    for cell_id in rel['Ids']:
                        cell_block = blocks_map.get(cell_id)
                        if cell_block and cell_block['BlockType'] == 'CELL':
                            row = cell_block.get('RowIndex', 0)
                            col = cell_block.get('ColumnIndex', 0)
                            text = self._get_text_from_block(cell_block, blocks_map)
                            
                            table_data["cells"].append({
                                "row": row,
                                "column": col,
                                "text": text,
                                "confidence": cell_block.get('Confidence', 0) / 100
                            })
                            
                            table_data["rows"] = max(table_data["rows"], row)
                            table_data["columns"] = max(table_data["columns"], col)
        
        return table_data
    
    def get_provider_name(self) -> str:
        return "aws-textract"


class TesseractProvider(VisionProvider):
    """Tesseract OCR provider (local)"""
    
    def __init__(self, lang: str = "eng", tesseract_cmd: Optional[str] = None):
        self.lang = lang
        if tesseract_cmd:
            import pytesseract
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        logger.info(f"Tesseract provider initialized with language: {lang}")
    
    async def extract_text(
        self,
        image_data: Union[bytes, Path, str],
    ) -> OCRResult:
        try:
            import pytesseract
            from PIL import Image
            import io
            import asyncio
            
            # Load image
            if isinstance(image_data, bytes):
                image = Image.open(io.BytesIO(image_data))
            elif isinstance(image_data, (Path, str)):
                image = Image.open(image_data)
            
            # Run OCR in executor
            loop = asyncio.get_event_loop()
            
            # Get detailed data
            data = await loop.run_in_executor(
                None,
                lambda: pytesseract.image_to_data(image, lang=self.lang, output_type=pytesseract.Output.DICT)
            )
            
            # Get full text
            text = await loop.run_in_executor(
                None,
                lambda: pytesseract.image_to_string(image, lang=self.lang)
            )
            
            # Build blocks
            blocks = []
            total_confidence = 0
            valid_count = 0
            
            for i in range(len(data['text'])):
                if data['text'][i].strip():
                    conf = float(data['conf'][i])
                    if conf > 0:
                        total_confidence += conf
                        valid_count += 1
                        blocks.append({
                            "text": data['text'][i],
                            "confidence": conf / 100,
                            "bounding_box": {
                                "left": data['left'][i],
                                "top": data['top'][i],
                                "width": data['width'][i],
                                "height": data['height'][i]
                            }
                        })
            
            avg_confidence = (total_confidence / valid_count / 100) if valid_count > 0 else 0
            
            return OCRResult(
                text=text,
                confidence=avg_confidence,
                blocks=blocks
            )
            
        except ImportError:
            logger.error("pytesseract or PIL not installed. Run: pip install pytesseract pillow")
            return OCRResult(text="", confidence=0.0)
        except Exception as e:
            logger.error(f"Tesseract OCR error: {e}")
            return OCRResult(text="", confidence=0.0)
    
    async def analyze_document(
        self,
        document_data: Union[bytes, Path, str],
    ) -> DocumentAnalysisResult:
        # Tesseract doesn't have document analysis - use text extraction
        ocr_result = await self.extract_text(document_data)
        return DocumentAnalysisResult(
            text=ocr_result.text,
            confidence=ocr_result.confidence,
            raw_response={"blocks": ocr_result.blocks}
        )
    
    def get_provider_name(self) -> str:
        return "tesseract"


# Provider factory
_vision_provider: Optional[VisionProvider] = None


def get_vision_provider() -> VisionProvider:
    """Get the configured vision provider singleton"""
    global _vision_provider
    
    if _vision_provider is None:
        from config import settings
        
        provider = getattr(settings, 'VISION_PROVIDER', 'tesseract').lower()
        
        if provider == 'google' or provider == 'google-vision':
            _vision_provider = GoogleVisionProvider(
                credentials_path=getattr(settings, 'GCP_CREDENTIALS_PATH', None),
                project_id=getattr(settings, 'GCP_PROJECT_ID', None)
            )
        elif provider == 'azure' or provider == 'azure-vision':
            _vision_provider = AzureComputerVisionProvider(
                endpoint=getattr(settings, 'AZURE_VISION_ENDPOINT', ''),
                api_key=getattr(settings, 'AZURE_VISION_API_KEY', '')
            )
        elif provider == 'aws' or provider == 'textract':
            _vision_provider = AWSTextractProvider(
                region=getattr(settings, 'AWS_REGION', 'us-east-1'),
                access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', None),
                secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
            )
        elif provider == 'tesseract':
            _vision_provider = TesseractProvider(
                lang=getattr(settings, 'TESSERACT_LANG', 'eng'),
                tesseract_cmd=getattr(settings, 'TESSERACT_CMD', None)
            )
        else:
            logger.warning(f"Unknown vision provider '{provider}', falling back to Tesseract")
            _vision_provider = TesseractProvider()
    
    return _vision_provider


def reset_vision_provider():
    """Reset the vision provider (useful for testing)"""
    global _vision_provider
    _vision_provider = None
