from typing import List, Tuple, Dict, Any

class IntervalMerger:
    """
    Computes true non-overlapping plagiarism coverage using interval union algorithms.
    Guarantees no double-counting of characters when multiple detection layers match the same text.
    """

    @staticmethod
    def merge_intervals(intervals: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
        """
        Takes a list of [start, end] tuples and returns a list of disjoint,
        merged intervals in ascending order.
        """
        if not intervals:
            return []

        # Sort primarily by start, secondarily by end
        sorted_intervals = sorted(intervals, key=lambda x: (x[0], x[1]))
        merged = []

        cur_start, cur_end = sorted_intervals[0]
        for start, end in sorted_intervals[1:]:
            if start <= cur_end:
                # Overlapping or contiguous interval; expand current
                cur_end = max(cur_end, end)
            else:
                merged.append((cur_start, cur_end))
                cur_start, cur_end = start, end

        merged.append((cur_start, cur_end))
        return merged

    @classmethod
    def calculate_coverage(cls, intervals: List[Tuple[int, int]], total_length: int) -> float:
        """
        Calculates the percentage of text covered by the intervals.
        """
        if total_length <= 0 or not intervals:
            return 0.0

        merged = cls.merge_intervals(intervals)
        total_matched_chars = sum(end - start for start, end in merged)
        percentage = (total_matched_chars / total_length) * 100.0
        return min(100.0, max(0.0, round(percentage, 2)))

    @classmethod
    def calculate_category_breakdown(cls, matches: List[Dict[str, Any]], total_length: int) -> Dict[str, float]:
        """
        Calculates distinct coverage percentages by source category:
        - Internet
        - Submitted Works
        - Publications
        """
        categories = ["Internet", "Submitted Works", "Publications"]
        breakdown = {}

        for cat in categories:
            cat_intervals = [
                (m["start_char"], m["end_char"]) 
                for m in matches 
                if m.get("source_category") == cat
            ]
            breakdown[cat] = cls.calculate_coverage(cat_intervals, total_length)

        return breakdown
