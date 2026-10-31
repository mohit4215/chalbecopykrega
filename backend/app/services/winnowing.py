import hashlib
import re
from typing import List, Tuple, Dict, Any

class Fingerprint:
    def __init__(self, hash_value: int, raw_start: int, raw_end: int, kgram: str):
        self.hash_value = hash_value
        self.raw_start = raw_start
        self.raw_end = raw_end
        self.kgram = kgram

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hash_value": self.hash_value,
            "raw_start": self.raw_start,
            "raw_end": self.raw_end,
            "kgram": self.kgram
        }

class WinnowingEngine:
    """
    Implements the Schleimer-Wilkerson-Aiken Winnowing Algorithm.
    Used for local fingerprinting, robust against whitespace modifications,
    and guaranteed to detect any shared substring >= (w + k - 1) characters.
    """

    def __init__(self, k: int = 35, w: int = 25):
        """
        :param k: Noise threshold - length of k-grams (typically 25-50 characters)
        :param w: Window size - any match >= (w + k - 1) is guaranteed to be detected
        """
        self.k = k
        self.w = w

    def _hash_kgram(self, kgram: str) -> int:
        """64-bit integer hash for k-gram using MD5 truncated."""
        return int(hashlib.md5(kgram.encode("utf-8")).hexdigest()[:16], 16)

    def extract_fingerprints(self, raw_text: str) -> List[Fingerprint]:
        """
        Extracts fingerprints from raw text while tracking original character offsets.
        """
        # Step 1: Normalize text to lowercase alphanumeric while preserving mapping to raw_text
        normalized_chars = []
        raw_offsets = []  # raw_offsets[i] gives index in raw_text for normalized_chars[i]

        for idx, ch in enumerate(raw_text):
            if ch.isalnum():
                normalized_chars.append(ch.lower())
                raw_offsets.append(idx)

        total_norm = len(normalized_chars)
        if total_norm < self.k:
            return []

        # Step 2: Form k-grams and their hashes
        kgram_hashes = []
        kgram_spans = []  # (raw_start, raw_end)
        kgrams = []

        for i in range(total_norm - self.k + 1):
            kgram_str = "".join(normalized_chars[i : i + self.k])
            h = self._hash_kgram(kgram_str)
            raw_start = raw_offsets[i]
            raw_end = raw_offsets[i + self.k - 1] + 1
            
            kgram_hashes.append(h)
            kgram_spans.append((raw_start, raw_end))
            kgrams.append(kgram_str)

        # Step 3: Winnowing window selection
        # In each window of size w, pick the minimum hash.
        # Ties broken by choosing the rightmost occurrence.
        fingerprints: List[Fingerprint] = []
        last_min_idx = -1

        num_windows = len(kgram_hashes) - self.w + 1
        if num_windows <= 0:
            # Document smaller than w; select minimum overall
            if kgram_hashes:
                min_idx = min(range(len(kgram_hashes)), key=lambda idx: kgram_hashes[idx])
                fingerprints.append(Fingerprint(
                    hash_value=kgram_hashes[min_idx],
                    raw_start=kgram_spans[min_idx][0],
                    raw_end=kgram_spans[min_idx][1],
                    kgram=kgrams[min_idx]
                ))
            return fingerprints

        for win_start in range(num_windows):
            win_end = win_start + self.w
            window = kgram_hashes[win_start:win_end]

            # Find minimum in window; pick rightmost in case of tie
            min_val = min(window)
            min_offset_in_win = len(window) - 1 - window[::-1].index(min_val)
            min_idx = win_start + min_offset_in_win

            # Only record if the minimum changed or wasn't previously recorded
            if min_idx != last_min_idx:
                fingerprints.append(Fingerprint(
                    hash_value=kgram_hashes[min_idx],
                    raw_start=kgram_spans[min_idx][0],
                    raw_end=kgram_spans[min_idx][1],
                    kgram=kgrams[min_idx]
                ))
                last_min_idx = min_idx

        return fingerprints

    @staticmethod
    def cluster_matched_fingerprints(matches: List[Tuple[int, int, str]], max_gap: int = 80) -> List[Tuple[int, int]]:
        """
        Clusters adjacent or nearby matching spans into continuous highlighted regions.
        :param matches: List of (raw_start, raw_end, source_info)
        :param max_gap: Maximum character gap to bridge into a single match span
        """
        if not matches:
            return []

        sorted_matches = sorted(matches, key=lambda m: (m[0], m[1]))
        clustered = []
        cur_start, cur_end = sorted_matches[0][0], sorted_matches[0][1]

        for s, e, _ in sorted_matches[1:]:
            if s <= cur_end + max_gap:
                cur_end = max(cur_end, e)
            else:
                clustered.append((cur_start, cur_end))
                cur_start, cur_end = s, e

        clustered.append((cur_start, cur_end))
        return clustered
