"""Adversarial Evasion & Unicode Homoglyph Detection Engine.

Destroys evasion tricks used to fool plagiarism and AI detectors (e.g. Turnitin bypasses):
  1. Cyrillic & Greek homoglyph letter substitution (e.g. Cyrillic 'а', 'е', 'о', 'р', 'с')
  2. Zero-width and invisible character insertion (\u200b, \ufeff, \u200c, \u200d, \u00ad)
  3. Directional override spoofing (\u200e, \u200f)
  4. Automatic canonicalization to standard Latin ASCII to guarantee match accuracy
"""

import re
import hashlib
from typing import Dict, Any, List, Tuple


class AdversarialDetector:
    """Detects and neutralizes adversarial obfuscation attempts."""

    # Cyrillic and Greek homoglyphs mapped to their visual Latin counterparts
    HOMOGLYPH_MAP = {
        # Cyrillic lowercase
        '\u0430': 'a',  # а -> a
        '\u0441': 'c',  # с -> c
        '\u0435': 'e',  # е -> e
        '\u0456': 'i',  # і -> i
        '\u0458': 'j',  # ј -> j
        '\u043e': 'o',  # о -> o
        '\u0440': 'p',  # р -> p
        '\u0455': 's',  # ѕ -> s
        '\u0445': 'x',  # х -> x
        '\u0443': 'y',  # у -> y

        # Cyrillic uppercase
        '\u0410': 'A',  # А -> A
        '\u0412': 'B',  # В -> B
        '\u0421': 'C',  # С -> C
        '\u0415': 'E',  # Е -> E
        '\u041d': 'H',  # Н -> H
        '\u0406': 'I',  # І -> I
        '\u0408': 'J',  # Ј -> J
        '\u041a': 'K',  # К -> K
        '\u041c': 'M',  # М -> M
        '\u041e': 'O',  # О -> O
        '\u0420': 'P',  # Р -> P
        '\u0422': 'T',  # Т -> T
        '\u0425': 'X',  # Х -> X

        # Greek lowercase & uppercase
        '\u03b1': 'a',  # α -> a
        '\u03bf': 'o',  # ο -> o
        '\u03bd': 'v',  # ν -> v
        '\u03c1': 'p',  # ρ -> p
        '\u03c4': 't',  # τ -> t
        '\u0391': 'A',  # Α -> A
        '\u0392': 'B',  # Β -> B
        '\u0395': 'E',  # Ε -> E
        '\u0397': 'H',  # Η -> H
        '\u0399': 'I',  # Ι -> I
        '\u039a': 'K',  # Κ -> K
        '\u039c': 'M',  # Μ -> M
        '\u039d': 'N',  # Ν -> N
        '\u039f': 'O',  # Ο -> O
        '\u03a1': 'P',  # Ρ -> P
        '\u03a4': 'T',  # Τ -> T
        '\u03a7': 'X',  # Χ -> X
        '\u03a5': 'Y',  # Υ -> Y
    }

    # Invisible, zero-width, and directional spoofing characters
    INVISIBLE_CHARS = {
        '\u200b': "Zero-Width Space",
        '\u200c': "Zero-Width Non-Joiner",
        '\u200d': "Zero-Width Joiner",
        '\ufeff': "Zero-Width No-Break Space (BOM)",
        '\u2060': "Word Joiner",
        '\u00ad': "Soft Hyphen (In-Word Break)",
        '\u180e': "Mongolian Vowel Separator",
        '\u200e': "Left-to-Right Mark",
        '\u200f': "Right-to-Left Mark",
    }

    @classmethod
    def audit_and_unmask(cls, text: str) -> Dict[str, Any]:
        """
        Inspects text for adversarial evasion techniques:
          1. Detects homoglyphic substitution attacks.
          2. Detects zero-width invisible character padding.
          3. Unmasks text to canonical Latin representation so similarity engines match accurately.
          4. Returns comprehensive integrity diagnostics.
        """
        if not text:
            return {
                "tampering_detected": False,
                "integrity_score": 100.0,
                "integrity_status": "Clean",
                "homoglyphs_detected_count": 0,
                "zero_width_chars_count": 0,
                "detected_tampering": [],
                "unmasked_text": "",
                "sha256_hash": hashlib.sha256(b"").hexdigest()
            }

        homoglyph_matches: List[Dict[str, Any]] = []
        invisible_matches: List[Dict[str, Any]] = []
        unmasked_chars: List[str] = []

        total_chars = len(text)
        for idx, ch in enumerate(text):
            if ch in cls.HOMOGLYPH_MAP:
                replacement = cls.HOMOGLYPH_MAP[ch]
                unmasked_chars.append(replacement)
                
                # Context snippet around character
                start_c = max(0, idx - 10)
                end_c = min(total_chars, idx + 11)
                context = text[start_c:idx] + f"[{ch} -> {replacement}]" + text[idx+1:end_c]

                homoglyph_matches.append({
                    "char": ch,
                    "code_point": f"U+{ord(ch):04X}",
                    "script": "Cyrillic" if 0x0400 <= ord(ch) <= 0x04FF else "Greek",
                    "replaced_with": replacement,
                    "index": idx,
                    "context": context
                })
            elif ch in cls.INVISIBLE_CHARS:
                char_name = cls.INVISIBLE_CHARS[ch]
                invisible_matches.append({
                    "char": ch,
                    "code_point": f"U+{ord(ch):04X}",
                    "name": char_name,
                    "index": idx
                })
                # Skip appending invisible characters to unmask cleanly
            else:
                unmasked_chars.append(ch)

        unmasked_text = "".join(unmasked_chars)
        total_evasion_items = len(homoglyph_matches) + len(invisible_matches)
        tampering_detected = total_evasion_items > 0

        # Integrity scoring: 100.0 is completely clean
        # Deduct 5 points per homoglyph and 2 points per zero-width char
        penalty = min(99.0, (len(homoglyph_matches) * 5.0) + (len(invisible_matches) * 2.0))
        integrity_score = round(100.0 - penalty, 1)

        if total_evasion_items == 0:
            status = "Verified Clean"
        elif len(homoglyph_matches) >= 3 or total_evasion_items >= 10:
            status = "Adversarial Evasion Attempted"
        else:
            status = "Suspicious Formatting"

        return {
            "tampering_detected": tampering_detected,
            "integrity_score": integrity_score,
            "integrity_status": status,
            "homoglyphs_detected_count": len(homoglyph_matches),
            "zero_width_chars_count": len(invisible_matches),
            "detected_tampering": {
                "homoglyphs": homoglyph_matches[:20],  # Sample first 20 for payload efficiency
                "invisible_characters": invisible_matches[:20]
            },
            "unmasked_text": unmasked_text,
            "sha256_hash": hashlib.sha256(unmasked_text.encode("utf-8")).hexdigest()
        }
