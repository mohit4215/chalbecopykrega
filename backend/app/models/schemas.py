from typing import List, Optional, Dict
from pydantic import BaseModel, Field

class MatchSpan(BaseModel):
    start_char: int = Field(..., description="Starting character index in uploaded text")
    end_char: int = Field(..., description="Ending character index in uploaded text")

class PlagiarismMatch(BaseModel):
    id: str = Field(..., description="Unique identifier for this match cluster")
    start_char: int = Field(..., description="Start character offset in uploaded document")
    end_char: int = Field(..., description="End character offset in uploaded document")
    matched_text: str = Field(..., description="Extracted text from candidate document")
    source_title: str = Field(..., description="Title of reference paper or Web page")
    source_url: Optional[str] = Field(None, description="URL of reference if found via internet cross-reference")
    source_id: Optional[str] = Field(None, description="Internal document UUID if matched against database")
    source_snippet: Optional[str] = Field(None, description="Corresponding source text snippet for comparison")
    similarity_score: float = Field(..., description="Confidence/similarity score between 0.0 and 1.0")
    match_type: str = Field(..., description="Classification: 'exact', 'paraphrase', or 'web'")
    source_category: str = Field(..., description="'Internet', 'Submitted Works', or 'Publications'")

class SourceBreakdown(BaseModel):
    internet_percentage: float = 0.0
    internal_db_percentage: float = 0.0
    publications_percentage: float = 0.0

class ScanReport(BaseModel):
    document_id: Optional[str] = None
    title: str
    total_characters: int
    total_words: int
    overall_similarity_percentage: float
    originality_percentage: float
    sources_breakdown: SourceBreakdown
    matches: List[PlagiarismMatch]
    raw_text: str

class IngestDocumentRequest(BaseModel):
    title: str
    author: Optional[str] = "Anonymous"
    text: str
    metadata: Optional[Dict[str, str]] = {}

class IngestDocumentResponse(BaseModel):
    document_id: str
    title: str
    chunks_indexed: int
    fingerprints_indexed: int
    status: str
