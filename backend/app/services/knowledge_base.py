"""Institutional & Academic Reference Repository Database & Vector Indexing.

Manages the core document corpus from which Poach checks plagiarism.
Provides bidirectional persistence between the relational database (SQLite/PostgreSQL)
and the vector search engine (Qdrant / InMemoryVectorDB).
"""

import logging
import os
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.core_engine import InternalVectorDB
from app.models.db_models import RepositoryDocument

logger = logging.getLogger("plagiarism.knowledge_base")


def chunk_text_sliding_window(text: str, chunk_size: int = 50, overlap: int = 20) -> List[str]:
    """Slices plain text into sliding-window word chunks for dense vector embedding."""
    words = text.split()
    if not words:
        return []
    if len(words) <= chunk_size:
        return [text.strip()]
    chunks = []
    step = max(1, chunk_size - overlap)
    for i in range(0, len(words), step):
        chunk_words = words[i:i + chunk_size]
        if chunk_words:
            chunks.append(" ".join(chunk_words))
        if i + chunk_size >= len(words):
            break
    return chunks


# Comprehensive foundational academic reference corpus
REFERENCE_CORPUS: List[Dict[str, Any]] = [
    {
        "document_id": "doc_ref_cs101_sample",
        "student_name": "Alice Johnson (Spring 2025)",
        "author": "Alice Johnson (Spring 2025)",
        "title": "Introduction to Neural Architectures and Attention Mechanisms",
        "category": "Computer Science & AI",
        "institution": "Global Academic Repository",
        "chunks": [
            "Deep learning is a subset of machine learning, which is essentially a "
            "neural network with three or more layers. These neural networks attempt "
            "to simulate the behavior of the human brain.",
            "Attention Is All You Need introduced the Transformer architecture based "
            "solely on attention mechanisms, dispensing with recurrence and "
            "convolutions entirely.",
            "Convolutional neural networks are commonly used for image classification, "
            "while transformers have revolutionized natural language processing.",
        ],
        "full_text": (
            "Deep learning is a subset of machine learning, which is essentially a neural network with three or more layers. "
            "These neural networks attempt to simulate the behavior of the human brain. "
            "Attention Is All You Need introduced the Transformer architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. "
            "Convolutional neural networks are commonly used for image classification, while transformers have revolutionized natural language processing."
        )
    },
    {
        "document_id": "doc_ref_ml_survey",
        "student_name": "Priya Nair (Fall 2024)",
        "author": "Priya Nair (Fall 2024)",
        "title": "Machine Learning Foundations",
        "category": "Data Science & Statistics",
        "institution": "Stanford University Coursework",
        "chunks": [
            "Supervised learning trains a model on labelled examples so it can predict "
            "targets for unseen data, while unsupervised learning discovers structure "
            "in unlabelled data.",
            "Gradient descent iteratively adjusts model parameters in the direction "
            "that reduces the loss function, with the learning rate controlling step "
            "size.",
            "Regularisation techniques such as dropout and weight decay reduce "
            "overfitting by penalising overly complex models.",
        ],
        "full_text": (
            "Supervised learning trains a model on labelled examples so it can predict targets for unseen data, "
            "while unsupervised learning discovers structure in unlabelled data. "
            "Gradient descent iteratively adjusts model parameters in the direction that reduces the loss function, "
            "with the learning rate controlling step size. "
            "Regularisation techniques such as dropout and weight decay reduce overfitting by penalising overly complex models."
        )
    },
    {
        "document_id": "doc_ref_sioyek_technical",
        "student_name": "Ali H. R. (ahrm/sioyek)",
        "author": "Ali H. R. (ahrm/sioyek)",
        "title": "Sioyek: Research-Oriented Document Viewer Architecture",
        "category": "Software Engineering",
        "institution": "Open Source Research",
        "chunks": [
            "Sioyek is a document viewer designed for reading research papers and technical books, featuring portal navigation for non-linear reading across document sections.",
            "Portals allow linking paragraphs to referenced figures, tables, or mathematical formulas elsewhere in the text, displaying them without losing reading context.",
            "Smart table of contents and outline extraction automatically parses document structures, enabling fast keyboard-centric movement across complex scientific literature.",
            "Visual marks and ruler lines allow researchers to maintain line-level focus when reading complex mathematical derivations and multi-column academic papers.",
        ],
        "full_text": (
            "Sioyek is a document viewer designed for reading research papers and technical books, featuring portal navigation for non-linear reading across document sections. "
            "Portals allow linking paragraphs to referenced figures, tables, or mathematical formulas elsewhere in the text, displaying them without losing reading context. "
            "Smart table of contents and outline extraction automatically parses document structures, enabling fast keyboard-centric movement across complex scientific literature. "
            "Visual marks and ruler lines allow researchers to maintain line-level focus when reading complex mathematical derivations and multi-column academic papers."
        )
    },
    {
        "document_id": "doc_ref_mandelbrot_chaos",
        "student_name": "Benoit B. Mandelbrot et al. (Springer)",
        "author": "Benoit B. Mandelbrot et al. (Springer)",
        "title": "Fractals and Chaos: The Mandelbrot Set and Beyond",
        "category": "Applied Mathematics",
        "institution": "Springer Academic Press",
        "chunks": [
            "The Mandelbrot set is defined in the complex plane as the set of complex numbers c for which the function f_c(z) = z^2 + c does not diverge when iterated from z = 0.",
            "Fractal geometry characterizes irregular natural phenomena that exhibit self-similarity across varying scales of magnification.",
            "Iterative polynomial dynamics reveal connected bifurcation boundaries and chaotic boundary structures in complex mathematical spaces.",
            "Topological boundaries of the Mandelbrot set remain infinitely detailed under continuous zoom transformations while maintaining bounded measure.",
        ],
        "full_text": (
            "The Mandelbrot set is defined in the complex plane as the set of complex numbers c for which the function f_c(z) = z^2 + c does not diverge when iterated from z = 0. "
            "Fractal geometry characterizes irregular natural phenomena that exhibit self-similarity across varying scales of magnification. "
            "Iterative polynomial dynamics reveal connected bifurcation boundaries and chaotic boundary structures in complex mathematical spaces. "
            "Topological boundaries of the Mandelbrot set remain infinitely detailed under continuous zoom transformations while maintaining bounded measure."
        )
    },
    {
        "document_id": "doc_ref_crispr_genomics",
        "student_name": "Dr. Jennifer Doudna & Dr. Emmanuelle Charpentier",
        "author": "Dr. Jennifer Doudna & Dr. Emmanuelle Charpentier",
        "title": "CRISPR-Cas9 Precision Genome Editing and Molecular Therapeutics",
        "category": "Biotechnology & Medicine",
        "institution": "UC Berkeley & Max Planck Institute",
        "chunks": [
            "CRISPR-Cas9 enables targeted RNA-guided genetic modifications in eukaryotic cells through Cas9 endonuclease activity.",
            "By utilizing synthetic single guide RNAs (sgRNA), the Cas9 endonuclease introduces site-specific double-strand breaks at complementary genomic loci.",
            "DNA repair pathways, including non-homologous end joining and homology-directed repair, facilitate targeted sequence replacements.",
            "Off-target cleavage and protospacer adjacent motif (PAM) site restrictions remain primary engineering challenges in clinical therapeutics."
        ],
        "full_text": (
            "CRISPR-Cas9 enables targeted RNA-guided genetic modifications in eukaryotic cells through Cas9 endonuclease activity. "
            "By utilizing synthetic single guide RNAs (sgRNA), the Cas9 endonuclease introduces site-specific double-strand breaks at complementary genomic loci. "
            "DNA repair pathways, including non-homologous end joining and homology-directed repair, facilitate targeted sequence replacements. "
            "Off-target cleavage and protospacer adjacent motif (PAM) site restrictions remain primary engineering challenges in clinical therapeutics."
        )
    },
    {
        "document_id": "doc_ref_keynesian_macro",
        "student_name": "Prof. N. Gregory Mankiw (Harvard Economics)",
        "author": "Prof. N. Gregory Mankiw (Harvard Economics)",
        "title": "Principles of Keynesian Macroeconomics and Monetary Policy Transmission",
        "category": "Economics & Finance",
        "institution": "Harvard Department of Economics",
        "chunks": [
            "Keynesian economic theory asserts that aggregate demand heavily influences overall economic activity and employment levels in the short run.",
            "During economic recessions, prices and wages do not adjust instantaneously to restore market equilibrium due to nominal price rigidities.",
            "Consequently, discretionary fiscal stimulus and central bank monetary interventions are deployed to stabilize output and counter cyclical unemployment."
        ],
        "full_text": (
            "Keynesian economic theory asserts that aggregate demand heavily influences overall economic activity and employment levels in the short run. "
            "During economic recessions, prices and wages do not adjust instantaneously to restore market equilibrium due to nominal price rigidities. "
            "Consequently, discretionary fiscal stimulus and central bank monetary interventions are deployed to stabilize output and counter cyclical unemployment."
        )
    },
    {
        "document_id": "doc_ref_existentialism_freedom",
        "student_name": "Jean-Paul Sartre & Albert Camus",
        "author": "Jean-Paul Sartre & Albert Camus",
        "title": "Existentialism, Subjectivity, and the Ethics of Human Freedom",
        "category": "Philosophy & Ethics",
        "institution": "University of Paris",
        "chunks": [
            "Existentialist philosophy posits that existence precedes essence, meaning that individuals define their own moral identity and purpose through voluntary action.",
            "In the absence of predetermined divine commandments, human freedom is radical and inescapable, engendering profound existential anguish and moral responsibility.",
            "Bad faith characterizes the psychological evasion of authentic freedom through conformism and social role adoption."
        ],
        "full_text": (
            "Existentialist philosophy posits that existence precedes essence, meaning that individuals define their own moral identity and purpose through voluntary action. "
            "In the absence of predetermined divine commandments, human freedom is radical and inescapable, engendering profound existential anguish and moral responsibility. "
            "Bad faith characterizes the psychological evasion of authentic freedom through conformism and social role adoption."
        )
    },
    {
        "document_id": "doc_ref_quantum_entanglement",
        "student_name": "Dr. Alain Aspect et al. (Physical Review Letters)",
        "author": "Dr. Alain Aspect et al. (Physical Review Letters)",
        "title": "Quantum Decoherence, Entanglement, and Non-Locality in Bell State Measurements",
        "category": "Quantum Physics",
        "institution": "Institut d'Optique & Physical Review Letters",
        "chunks": [
            "Quantum entanglement describes a physical phenomenon where pairs of particles interact such that the quantum state of each particle cannot be described independently of the other.",
            "Experimental violations of Bell inequalities definitively demonstrate that quantum mechanics cannot be reproduced by local realistic hidden-variable theories.",
            "State reduction occurs instantaneously across arbitrary spatial intervals, establishing non-local correlation without superluminal signalling."
        ],
        "full_text": (
            "Quantum entanglement describes a physical phenomenon where pairs of particles interact such that the quantum state of each particle cannot be described independently of the other. "
            "Experimental violations of Bell inequalities definitively demonstrate that quantum mechanics cannot be reproduced by local realistic hidden-variable theories. "
            "State reduction occurs instantaneously across arbitrary spatial intervals, establishing non-local correlation without superluminal signalling."
        )
    },
    {
        "document_id": "doc_ref_digital_ip_fairuse",
        "student_name": "Prof. Lawrence Lessig (Stanford Law School)",
        "author": "Prof. Lawrence Lessig (Stanford Law School)",
        "title": "Digital Intellectual Property, Fair Use Doctrine, and Technological Neutrality",
        "category": "Law & Legal Studies",
        "institution": "Stanford Law Review",
        "chunks": [
            "Copyright jurisprudence in the digital epoch balances the economic incentives of rights-holders against societal access and transformative creative reuse.",
            "The statutory four-factor fair use analysis evaluates the purpose of the secondary work, the nature of the copyrighted material, the volume extracted, and the market harm.",
            "Automated content identification algorithms frequently penalize non-infringing scholarly quotation, creating adverse speech externalities."
        ],
        "full_text": (
            "Copyright jurisprudence in the digital epoch balances the economic incentives of rights-holders against societal access and transformative creative reuse. "
            "The statutory four-factor fair use analysis evaluates the purpose of the secondary work, the nature of the copyrighted material, the volume extracted, and the market harm. "
            "Automated content identification algorithms frequently penalize non-infringing scholarly quotation, creating adverse speech externalities."
        )
    },
    {
        "document_id": "doc_ref_coldwar_geopolitics",
        "student_name": "Dr. Henry Kissinger (Foreign Affairs)",
        "author": "Dr. Henry Kissinger (Foreign Affairs)",
        "title": "The Geopolitical Architecture of the Cold War and Nuclear Deterrence",
        "category": "History & Political Science",
        "institution": "Georgetown Center for Strategic Studies",
        "chunks": [
            "The postwar global architecture was defined by bipolar equilibrium between the United States and the Soviet Union, governed by mutual assured destruction.",
            "Strategic containment and ideological rivalry prompted peripheral conflicts across Europe, Southeast Asia, and Latin America while avoiding direct thermonuclear exchange.",
            "Multilateral diplomacy, arms limitation treaties, and crisis communication hotlines maintained structural deterrence throughout the nuclear era."
        ],
        "full_text": (
            "The postwar global architecture was defined by bipolar equilibrium between the United States and the Soviet Union, governed by mutual assured destruction. "
            "Strategic containment and ideological rivalry prompted peripheral conflicts across Europe, Southeast Asia, and Latin America while avoiding direct thermonuclear exchange. "
            "Multilateral diplomacy, arms limitation treaties, and crisis communication hotlines maintained structural deterrence throughout the nuclear era."
        )
    }
]


def _build_vector_db() -> InternalVectorDB:
    qdrant_url = os.getenv("QDRANT_URL")
    if qdrant_url:
        return InternalVectorDB(qdrant_url=qdrant_url)
    return InternalVectorDB(location=":memory:")


vector_db = _build_vector_db()
_corpus_seeded = False


def seed_reference_corpus() -> None:
    """Index the bundled reference papers once per process in memory (idempotent)."""
    global _corpus_seeded
    if _corpus_seeded:
        return
    _corpus_seeded = True
    for entry in REFERENCE_CORPUS:
        try:
            chunks = entry.get("chunks") or chunk_text_sliding_window(entry.get("full_text", ""))
            vector_db.index_submission(
                document_id=entry["document_id"],
                student_name=entry.get("student_name") or entry.get("author", "Academic Reference"),
                title=entry["title"],
                chunks=chunks,
                category=entry.get("category", "Submitted Student Work")
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning(f"Could not index reference document {entry['document_id']}: {exc}")


async def sync_repository_from_db(db: AsyncSession) -> int:
    """
    Synchronizes SQL RepositoryDocument records into the active vector database index.
    If the repository table is empty, auto-seeds with the foundational reference corpus.
    """
    global _corpus_seeded
    try:
        res = await db.execute(select(RepositoryDocument).where(RepositoryDocument.is_active == True))
        docs = res.scalars().all()

        if not docs:
            # Seed foundational documents into SQL database
            for item in REFERENCE_CORPUS:
                chunks = item.get("chunks") or chunk_text_sliding_window(item.get("full_text", ""))
                full_text = item.get("full_text") or "\n\n".join(chunks)
                doc_row = RepositoryDocument(
                    id=item["document_id"],
                    title=item["title"],
                    author=item.get("student_name") or item.get("author", "Academic Reference"),
                    category=item.get("category", "Academic Paper"),
                    institution=item.get("institution", "Institutional Library"),
                    full_text=full_text,
                    chunk_count=len(chunks),
                    word_count=len(full_text.split()),
                    is_active=True
                )
                db.add(doc_row)
                try:
                    vector_db.index_submission(
                        document_id=doc_row.id,
                        student_name=doc_row.author,
                        title=doc_row.title,
                        chunks=chunks,
                        category=doc_row.category
                    )
                except Exception as exc:
                    logger.warning(f"Could not index document {doc_row.id}: {exc}")
            await db.commit()
            _corpus_seeded = True
            logger.info(f"Initialized Repository Database with {len(REFERENCE_CORPUS)} reference papers.")
            return len(REFERENCE_CORPUS)
        else:
            # Index documents from database
            count = 0
            for doc in docs:
                chunks = chunk_text_sliding_window(doc.full_text)
                try:
                    vector_db.index_submission(
                        document_id=doc.id,
                        student_name=doc.author,
                        title=doc.title,
                        chunks=chunks,
                        category=doc.category
                    )
                    count += 1
                except Exception as exc:
                    logger.warning(f"Could not index repository document {doc.id}: {exc}")
            _corpus_seeded = True
            logger.info(f"Loaded {count} institutional documents from database into vector store.")
            return count
    except Exception as e:
        logger.error(f"Error during repository database sync: {e}")
        seed_reference_corpus()
        return len(REFERENCE_CORPUS)
