"""Cohort Collusion & Peer-to-Peer Ring Detection Engine.

Uncovers academic collusion and ghostwriting rings among cohort submissions.
While legacy systems like Turnitin only compare against pre-indexed databases,
Poach analyzes all submissions in an assignment cohort simultaneously, generating
an N x N Cross-Submission Collusion Matrix and identifying suspicious peer-sharing rings.
"""

import re
from typing import List, Dict, Any, Set, Tuple


class CohortCollusionDetector:
    """Analyzes a batch of student submissions for peer-to-peer collusion."""

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        return re.findall(r"\b[a-zA-Z0-9_']+\b", (text or "").lower())

    @classmethod
    def _extract_kgrams(cls, words: List[str], k: int = 5) -> Set[str]:
        if len(words) < k:
            return set([" ".join(words)]) if words else set()
        return set(" ".join(words[i:i + k]) for i in range(len(words) - k + 1))

    @classmethod
    def analyze_cohort(
        cls,
        submissions: List[Dict[str, Any]],
        threshold: float = 35.0,
        k: int = 5
    ) -> Dict[str, Any]:
        """
        Takes a list of submission dicts:
          [{"id": "sub_1", "student_name": "Alice", "title": "Paper 1", "text": "..."}]
        Returns:
          - matrix: N x N grid of pairwise similarity percentages
          - submissions_summary: List of submission metadata
          - suspicious_pairs: Pairs exceeding collusion threshold
          - collusion_clusters: Grouped clusters (collusion rings)
          - overall_cohort_risk: "Clean", "Moderate Suspicion", "High Collusion Risk"
        """
        n = len(submissions)
        if n < 2:
            return {
                "cohort_size": n,
                "matrix": [[100.0]] if n == 1 else [],
                "submissions_summary": submissions,
                "suspicious_pairs": [],
                "collusion_clusters": [],
                "overall_cohort_risk": "Insufficient Submissions (Min 2 required)"
            }

        # Precompute k-grams and word counts for all submissions
        processed = []
        for s in submissions:
            words = cls._tokenize(s.get("text", ""))
            kgrams = cls._extract_kgrams(words, k=k)
            processed.append({
                "id": s.get("id", str(len(processed))),
                "student_name": s.get("student_name", f"Student {len(processed)+1}"),
                "title": s.get("title", f"Submission {len(processed)+1}"),
                "words_count": len(words),
                "kgrams": kgrams
            })

        matrix: List[List[float]] = [[0.0] * n for _ in range(n)]
        suspicious_pairs: List[Dict[str, Any]] = []

        # Adjacency for clustering
        adjacency: Dict[int, Set[int]] = {i: set() for i in range(n)}

        for i in range(n):
            matrix[i][i] = 100.0
            for j in range(i + 1, n):
                kg_a = processed[i]["kgrams"]
                kg_b = processed[j]["kgrams"]

                if not kg_a or not kg_b:
                    sim = 0.0
                    shared = set()
                else:
                    shared = kg_a.intersection(kg_b)
                    union = kg_a.union(kg_b)
                    # Jaccard overlap percentage
                    sim = round(len(shared) / max(1, len(union)) * 100.0, 1)

                matrix[i][j] = sim
                matrix[j][i] = sim

                if sim >= threshold:
                    adjacency[i].add(j)
                    adjacency[j].add(i)

                    sample_overlap = list(shared)[:3]
                    suspicious_pairs.append({
                        "student_a": processed[i]["student_name"],
                        "student_b": processed[j]["student_name"],
                        "submission_a_id": processed[i]["id"],
                        "submission_b_id": processed[j]["id"],
                        "similarity_score": sim,
                        "shared_kgrams_count": len(shared),
                        "sample_overlapping_phrases": sample_overlap,
                        "verdict": "High Collusion Risk" if sim >= 55.0 else "Suspicious Overlap"
                    })

        # Find connected components (collusion clusters / rings)
        visited: Set[int] = set()
        clusters: List[List[str]] = []

        for i in range(n):
            if i not in visited and adjacency[i]:
                # BFS/DFS to find ring
                cluster_members: List[str] = []
                queue = [i]
                visited.add(i)

                while queue:
                    curr = queue.pop(0)
                    cluster_members.append(processed[curr]["student_name"])
                    for neighbor in adjacency[curr]:
                        if neighbor not in visited:
                            visited.add(neighbor)
                            queue.append(neighbor)

                if len(cluster_members) > 1:
                    clusters.append(cluster_members)

        # Cohort risk status
        if any(p["similarity_score"] >= 60.0 for p in suspicious_pairs) or len(clusters) > 1 or (clusters and len(clusters[0]) >= 3):
            overall_risk = "High Collusion Risk Detected"
        elif suspicious_pairs:
            overall_risk = "Moderate Peer Overlap Detected"
        else:
            overall_risk = "Clean - Independent Submissions"

        return {
            "cohort_size": n,
            "threshold_used": threshold,
            "overall_cohort_risk": overall_risk,
            "matrix": matrix,
            "submissions_summary": [
                {
                    "id": p["id"],
                    "student_name": p["student_name"],
                    "title": p["title"],
                    "words_count": p["words_count"]
                }
                for p in processed
            ],
            "suspicious_pairs": sorted(suspicious_pairs, key=lambda x: x["similarity_score"], reverse=True),
            "collusion_clusters": clusters
        }
